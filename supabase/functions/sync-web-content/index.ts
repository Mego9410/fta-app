// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1?target=deno';

import { corsHeaders } from '../_shared/cors.ts';

const ARTICLES_INDEX_URL = 'https://www.ft-associates.com/article/';
const TESTIMONIALS_URL = 'https://www.ft-associates.com/sell-a-dental-practice/testimonials/';

// Helper functions ported from the app
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, '…')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h1|h2|h3|h4|h5|h6)>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/(ul|ol)>/gi, '\n\n')
      .replace(/<\/(div|section|article|main|header|footer)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

function absolutizeUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function hashStringDjb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function slugify(input: string): string {
  const raw = (input ?? '').trim().toLowerCase();
  if (!raw) return 'client';
  const ascii = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || 'client';
}

function makeArticleId(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.replace(/\/$/, '');
    const slug = path.split('/').pop() || 'article';
    return slugify(slug) + '-' + hashStringDjb2(url).slice(0, 8);
  } catch {
    return hashStringDjb2(url).slice(0, 16);
  }
}

function makeTestimonialId(author: string, quote: string, url: string | null): string {
  const authorSlug = slugify(author);
  const seed = `${author}|${quote}|${url ?? ''}`;
  const hash = hashStringDjb2(seed);
  return `${authorSlug}-${hash}`;
}

// Article parsing functions
function pickMeta(html: string, attrMatch: string): string {
  const re = new RegExp(`<meta[^>]*${attrMatch}[^>]*content="([^"]+)"[^>]*>`, 'i');
  const m = html.match(re);
  return m?.[1] ?? '';
}

function pickTagText(html: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = html.match(re);
  return m?.[1] ?? '';
}

function pickTimeText(html: string): string {
  const m = html.match(/<time[^>]*>([^<]+)<\/time>/i);
  return m?.[1]?.trim() ?? '';
}

function pickByRegex(html: string, re: RegExp): string {
  const m = html.match(re);
  return (m?.[1] ?? m?.[0] ?? '').toString().trim();
}

function pickFirst(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (s) return s;
  }
  return '';
}

function extractBalancedTagFrom(html: string, startIndex: number, tagName: string): string | null {
  const openToken = `<${tagName}`;
  const closeToken = `</${tagName}`;

  const openAt = html.indexOf(openToken, startIndex);
  if (openAt < 0) return null;

  const openEnd = html.indexOf('>', openAt);
  if (openEnd < 0) return null;

  let depth = 1;
  let pos = openEnd + 1;

  while (pos < html.length) {
    const nextOpen = html.indexOf(openToken, pos);
    const nextClose = html.indexOf(closeToken, pos);
    if (nextClose < 0) return null;

    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      pos = nextOpen + openToken.length;
      continue;
    }

    depth -= 1;
    const closeEnd = html.indexOf('>', nextClose);
    if (closeEnd < 0) return null;
    pos = closeEnd + 1;

    if (depth === 0) {
      return html.slice(openAt, pos);
    }
  }

  return null;
}

function extractFirstBalancedTagByRegex(html: string, re: RegExp): string | null {
  const m = html.match(re);
  if (!m) return null;
  const tag = (m[1] ?? '').toLowerCase();
  if (!tag) return null;
  const idx = html.search(re);
  if (idx < 0) return null;
  return extractBalancedTagFrom(html, idx, tag);
}

function trimArticleBoilerplate(html: string): string {
  let out = html;

  const h1Idx = out.search(/<h1\b/i);
  if (h1Idx >= 0) out = out.slice(h1Idx);

  const cutPatterns: RegExp[] = [
    /<[^>]+class="[^"]*(sharedaddy|share|social)[^"]*"[^>]*>/i,
    /<a[^>]*>\s*(share|Tweet|LinkedIn|Email|Print)\s*<\/a>/i,
    /<li[^>]*>\s*(share|Tweet|LinkedIn|Email|Print)\s*<\/li>/i,
    /<h2[^>]*>[\s\S]*?Get in touch/i,
    /<h2[^>]*>[\s\S]*?Find a dental practice/i,
    /<h3[^>]*>[\s\S]*?for sale in the UK/i,
    /<footer\b/i,
    /<form\b/i,
  ];
  let cutAt = -1;
  for (const p of cutPatterns) {
    const idx = out.search(p);
    if (idx >= 0 && (cutAt < 0 || idx < cutAt)) cutAt = idx;
  }
  if (cutAt > 0) out = out.slice(0, cutAt);

  return out;
}

function parseArticleIndex(html: string, baseUrl: string): Array<{ title: string; url: string; dateText: string | null; excerpt: string | null }> {
  const postRe =
    /<(h2|h3)[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/(h2|h3)>[\s\S]{0,700}?(?:<time[^>]*>([^<]+)<\/time>)?[\s\S]{0,700}?(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;
  const out: Array<{ title: string; url: string; dateText: string | null; excerpt: string | null }> = [];
  let m: RegExpExecArray | null;
  while ((m = postRe.exec(html))) {
    const href = m[2]?.trim();
    const rawTitle = m[3] ?? '';
    const title = stripHtml(rawTitle).trim();
    const url = href ? absolutizeUrl(baseUrl, href) : '';
    const dateText = m[5]?.trim() || null;
    const excerpt = m[6] ? stripHtml(m[6]).trim() : null;
    if (!title || !url) continue;
    out.push({ title, url, dateText, excerpt });
  }

  const uniq = new Map<string, { title: string; url: string; dateText: string | null; excerpt: string | null }>();
  for (const item of out) {
    if (!uniq.has(item.url)) uniq.set(item.url, item);
  }
  return Array.from(uniq.values());
}

// Type definitions for article blocks (matching the app's structure)
type ArticleInline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

type ArticleBlock =
  | { type: 'p'; inlines: ArticleInline[] }
  | { type: 'h2' | 'h3'; inlines: ArticleInline[] }
  | { type: 'li'; inlines: ArticleInline[] };

function extractArticleBlocks(html: string): ArticleBlock[] {
  // Lightweight HTML-to-block parser. Not a full HTML parser, but enough for WP-style content.
  // - Extracts h2/h3, paragraphs, and list items.
  // - Preserves inline <strong>/<b>/<em>/<i>.
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  type InlineStyle = { bold: boolean; italic: boolean };
  const styleStack: InlineStyle[] = [{ bold: false, italic: false }];

  const blocks: ArticleBlock[] = [];
  let buf: ArticleInline[] = [];
  let currentBlock: 'p' | 'h2' | 'h3' | 'li' | null = null;

  function curStyle() {
    return styleStack[styleStack.length - 1] ?? { bold: false, italic: false };
  }

  function pushText(text: string) {
    const s = decodeHtmlEntities(text)
      .replace(/\s+/g, ' ')
      .trim();
    if (!s) return;
    const st = curStyle();
    const last = buf[buf.length - 1];
    if (last && last.bold === st.bold && last.italic === st.italic) {
      last.text = `${last.text} ${s}`.trim();
      return;
    }
    buf.push({ text: s, bold: st.bold || undefined, italic: st.italic || undefined });
  }

  function flush() {
    if (!currentBlock) return;
    const inlines = buf.filter((x) => x.text.trim().length > 0);
    buf = [];
    if (!inlines.length) {
      currentBlock = null;
      return;
    }
    blocks.push({ type: currentBlock, inlines } as ArticleBlock);
    currentBlock = null;
  }

  function startBlock(next: typeof currentBlock) {
    flush();
    currentBlock = next;
  }

  // Tokenize into tags and text.
  const tokenRe = /(<[^>]+>)/g;
  const parts = cleaned.split(tokenRe);
  for (const part of parts) {
    if (!part) continue;
    if (part[0] !== '<') {
      if (currentBlock) pushText(part);
      continue;
    }

    const tag = part.toLowerCase();
    const isClosing = /^<\//.test(tag);
    const nameMatch = tag.match(/^<\/?\s*([a-z0-9]+)/i);
    const name = nameMatch?.[1] ?? '';
    if (!name) continue;

    // Block boundaries
    if (!isClosing) {
      if (name === 'p') startBlock('p');
      if (name === 'h2') startBlock('h2');
      if (name === 'h3') startBlock('h3');
      if (name === 'li') startBlock('li');
    } else {
      if (name === 'p' || name === 'h2' || name === 'h3' || name === 'li') flush();
    }

    // Inline style stack
    if (!isClosing && (name === 'strong' || name === 'b')) {
      const prev = curStyle();
      styleStack.push({ bold: true, italic: prev.italic });
    } else if (isClosing && (name === 'strong' || name === 'b')) {
      if (styleStack.length > 1) styleStack.pop();
    } else if (!isClosing && (name === 'em' || name === 'i')) {
      const prev = curStyle();
      styleStack.push({ bold: prev.bold, italic: true });
    } else if (isClosing && (name === 'em' || name === 'i')) {
      if (styleStack.length > 1) styleStack.pop();
    }

    // Line breaks inside blocks
    if (name === 'br' && currentBlock) {
      // Treat line breaks as sentence separation; we keep it simple by inserting a space.
      pushText(' ');
    }
  }
  flush();

  // De-junk: drop tiny trailing blocks that look like just social labels.
  const junk = new Set(['share', 'tweet', 'linkedin', 'email', 'print']);
  return blocks.filter((b) => {
    const t = b.inlines.map((x) => x.text).join(' ').trim().toLowerCase();
    if (t.length <= 12 && junk.has(t)) return false;
    return true;
  });
}

function parseArticleDetail(html: string, url: string): { title: string; url: string; dateText: string | null; contentText: string; blocksJson: ArticleBlock[] | null } | null {
  const title = pickFirst(stripHtml(pickMeta(html, 'property="og:title"')), stripHtml(pickTagText(html, 'h1'))) || 'Article';

  const dateText =
    pickFirst(
      pickTimeText(html),
      pickByRegex(html, /\b(\d{2}-\d{2}-\d{4})\b/),
      pickByRegex(html, /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/),
    ) || null;

  const mainHtml =
    extractFirstBalancedTagByRegex(
      html,
      /<(div|main|article|section)[^>]*class="[^"]*(entry-content|post-content)[^"]*"[^>]*>/i,
    ) ||
    extractFirstBalancedTagByRegex(html, /<(article)\b[^>]*>/i) ||
    extractFirstBalancedTagByRegex(html, /<(main)\b[^>]*>/i) ||
    html;

  const cleanedHtml = trimArticleBoilerplate(mainHtml);
  const contentText = stripHtml(cleanedHtml);
  if (!contentText) return null;

  // Extract structured blocks with formatting preserved (bold, bullet points, etc.)
  const blocks = extractArticleBlocks(cleanedHtml);
  
  return { title, url, dateText, contentText, blocksJson: blocks.length > 0 ? blocks : null };
}

function parseTestimonials(html: string, baseUrl: string): Array<{ id: string; author: string; quote: string; dateText: string | null; url: string | null }> {
  const out: Array<{ id: string; author: string; quote: string; dateText: string | null; url: string | null }> = [];

  // itemprop style
  const reviewRe =
    /itemprop="reviewBody"[^>]*>([\s\S]*?)<\/[^>]+>[\s\S]{0,500}?(?:itemprop="author"[^>]*>[\s\S]*?<[^>]*itemprop="name"[^>]*>([^<]+)<\/[^>]+>|itemprop="author"[^>]*>([^<]+)<\/[^>]+)?/gi;
  let m: RegExpExecArray | null;
  while ((m = reviewRe.exec(html))) {
    const quote = stripHtml(m[1] ?? '').trim();
    const author = (m[2] ?? m[3] ?? '').trim() || 'Client';
    if (!quote) continue;
    const id = makeTestimonialId(author, quote, baseUrl);
    out.push({ id, author, quote, dateText: null, url: baseUrl });
  }

  if (out.length >= 3) {
    const seen = new Set<string>();
    return out.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }

  // Heading + paragraph fallback
  const blockRe =
    /<(h2|h3)[^>]*>\s*<a[^>]+href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>\s*<\/(h2|h3)>[\s\S]{0,800}?<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = blockRe.exec(html))) {
    const href = (m[2] ?? m[3] ?? '').trim();
    const author = stripHtml(m[4] ?? '').trim();
    const quote = stripHtml(m[6] ?? '').trim();
    if (!author || !quote) continue;
    const url = href ? absolutizeUrl(baseUrl, href) : baseUrl;
    const id = makeTestimonialId(author, quote, url);
    out.push({ id, author, quote, dateText: null, url });
  }

  if (out.length >= 3) {
    const seen = new Set<string>();
    return out.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }

  // Current site layout
  const rowRe =
    /<div[^>]+class=(?:"[^"]*\btesti-row1\b[^"]*"|'[^']*\btesti-row1\b[^']*')[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)<p[^>]*>\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*<\/p>/gi;
  while ((m = rowRe.exec(html))) {
    const heading = stripHtml(m[1] ?? '').trim();
    const body = stripHtml(m[2] ?? '').trim();
    const author = stripHtml(m[3] ?? '').trim();
    const quote = [heading, body].filter(Boolean).join(' — ');
    if (!author || !quote) continue;
    const id = makeTestimonialId(author, quote, baseUrl);
    out.push({ id, author, quote, dateText: null, url: baseUrl });
  }

  // Last resort
  if (!out.length) {
    const nameParaRe = /<strong[^>]*>([^<]{2,80})<\/strong>[\s\S]{0,400}?<p[^>]*>([\s\S]*?)<\/p>/gi;
    while ((m = nameParaRe.exec(html))) {
      const author = stripHtml(m[1] ?? '').trim();
      const quote = stripHtml(m[2] ?? '').trim();
      if (!author || !quote) continue;
      const id = makeTestimonialId(author, quote, baseUrl);
      out.push({ id, author, quote, dateText: null, url: baseUrl });
    }
  }

  // De-dupe
  const seen = new Set<string>();
  return out.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

async function syncArticles(supabase: any) {
  console.log('Fetching articles index...');
  const htmlRes = await fetch(ARTICLES_INDEX_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!htmlRes.ok) throw new Error(`Failed to fetch articles index: ${htmlRes.status}`);
  const html = await htmlRes.text();

  const previews = parseArticleIndex(html, ARTICLES_INDEX_URL);
  console.log(`Found ${previews.length} article previews`);

  const now = new Date().toISOString();
  let synced = 0;
  let errors = 0;

  for (const preview of previews) {
    try {
      // Fetch full article detail
      const detailRes = await fetch(preview.url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!detailRes.ok) {
        console.warn(`Failed to fetch article ${preview.url}: ${detailRes.status}`);
        errors++;
        continue;
      }

      const detailHtml = await detailRes.text();
      const detail = parseArticleDetail(detailHtml, preview.url);
      if (!detail) {
        console.warn(`Failed to parse article ${preview.url}`);
        errors++;
        continue;
      }

      const id = makeArticleId(preview.url);

      // Upsert article
      const { error } = await supabase
        .from('articles')
        .upsert(
          {
            id,
            title: detail.title,
            url: detail.url,
            date_text: detail.dateText,
            excerpt: preview.excerpt,
            content_text: detail.contentText,
            blocks_json: detail.blocksJson,
            updated_at: now,
            synced_at: now,
          },
          { onConflict: 'id' },
        );

      if (error) {
        console.error(`Error upserting article ${id}:`, error);
        errors++;
      } else {
        synced++;
      }
    } catch (e) {
      console.error(`Error processing article ${preview.url}:`, e);
      errors++;
    }
  }

  return { synced, errors, total: previews.length };
}

async function syncTestimonials(supabase: any) {
  console.log('Fetching testimonials...');
  const htmlRes = await fetch(TESTIMONIALS_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
  });
  if (!htmlRes.ok) throw new Error(`Failed to fetch testimonials: ${htmlRes.status}`);
  const html = await htmlRes.text();

  const testimonials = parseTestimonials(html, TESTIMONIALS_URL);
  console.log(`Found ${testimonials.length} testimonials`);

  const now = new Date().toISOString();
  let synced = 0;
  let errors = 0;

  for (const testimonial of testimonials) {
    try {
      const { error } = await supabase
        .from('testimonials')
        .upsert(
          {
            id: testimonial.id,
            author: testimonial.author,
            quote: testimonial.quote,
            date_text: testimonial.dateText,
            url: testimonial.url,
            updated_at: now,
            synced_at: now,
          },
          { onConflict: 'id' },
        );

      if (error) {
        console.error(`Error upserting testimonial ${testimonial.id}:`, error);
        errors++;
      } else {
        synced++;
      }
    } catch (e) {
      console.error(`Error processing testimonial ${testimonial.id}:`, e);
      errors++;
    }
  }

  return { synced, errors, total: testimonials.length };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'all'; // 'articles', 'testimonials', or 'all'

    const results: any = {};

    if (type === 'articles' || type === 'all') {
      results.articles = await syncArticles(supabase);
    }

    if (type === 'testimonials' || type === 'all') {
      results.testimonials = await syncTestimonials(supabase);
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
