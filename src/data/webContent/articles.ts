import { getCachedJson, setCachedJson } from '@/src/data/metaRepo';
import { absolutizeUrl, decodeHtmlEntities, stripHtml } from '@/src/data/webContent/html';

export type ArticlePreview = {
  title: string;
  url: string;
  dateText?: string | null;
  excerpt?: string | null;
};

export type ArticleDetail = {
  title: string;
  url: string;
  dateText?: string | null;
  contentText: string;
  blocks?: ArticleBlock[];
};

export type ArticleInline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

export type ArticleBlock =
  | { type: 'p'; inlines: ArticleInline[] }
  | { type: 'h2' | 'h3'; inlines: ArticleInline[] }
  | { type: 'li'; inlines: ArticleInline[] };

const ARTICLES_INDEX_URL = 'https://www.ft-associates.com/article/';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

export async function fetchLatestArticlePreviews({ limit }: { limit: number }): Promise<ArticlePreview[]> {
  const key = `web.articles.index.v2.limit.${limit}`;
  const cached = await getCachedJson<ArticlePreview[]>(key, CACHE_TTL_MS);
  if (cached?.length) return cached;

  const html = await fetchHtml(ARTICLES_INDEX_URL);
  const items = parseArticleIndex(html, ARTICLES_INDEX_URL).slice(0, Math.max(1, limit));
  await setCachedJson(key, items);
  return items;
}

export async function fetchArticleDetail(url: string): Promise<ArticleDetail | null> {
  if (!url) return null;
  const key = `web.article.detail.v4.${url}`;
  const cached = await getCachedJson<ArticleDetail>(key, CACHE_TTL_MS);
  if (cached) return cached;

  const html = await fetchHtml(url);
  const parsed = parseArticleDetail(html, url);
  if (parsed) await setCachedJson(key, parsed);
  return parsed;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

function parseArticleIndex(html: string, baseUrl: string): ArticlePreview[] {
  const cleaned = html.replace(/\s+/g, ' ');

  // Heuristic: capture links with "Continue reading" nearby, then backtrack to find the heading/title.
  const continueRe = /Continue reading\s*“([^”"]+)”|Continue reading\s*\"([^\"]+)\"/gi;
  const titlesFromContinue: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = continueRe.exec(cleaned))) {
    const t = (m[1] ?? m[2] ?? '').trim();
    if (t) titlesFromContinue.push(decodeHtmlEntities(t));
  }

  // Generic post card extraction: heading link + optional date + excerpt paragraph.
  const postRe =
    /<(h2|h3)[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/(h2|h3)>[\s\S]{0,700}?(?:<time[^>]*>([^<]+)<\/time>)?[\s\S]{0,700}?(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;
  const out: ArticlePreview[] = [];
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

  // De-dupe by URL.
  const uniq = new Map<string, ArticlePreview>();
  for (const item of out) {
    if (!uniq.has(item.url)) uniq.set(item.url, item);
  }
  const list = Array.from(uniq.values());

  // If our heuristic fails, fall back to titles we saw in "Continue reading ..." (but without URLs we can't use them).
  // So only use list from postRe for now.
  return list;
}

function parseArticleDetail(html: string, url: string): ArticleDetail | null {
  const title =
    pickFirst(stripHtml(pickMeta(html, 'property="og:title"')), stripHtml(pickTagText(html, 'h1'))) || 'Article';

  const dateText =
    pickFirst(
      pickTimeText(html),
      pickByRegex(html, /\b(\d{2}-\d{2}-\d{4})\b/),
      pickByRegex(html, /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/),
    ) || null;

  // IMPORTANT:
  // Many FTA pages include nested <div>s inside the content container (e.g. Google Reviews / widgets).
  // A non-greedy regex like "<div ...>.*?</div>" will stop at the first inner </div> and can accidentally
  // return only a widget. So we extract a balanced element.
  const mainHtml =
    extractFirstBalancedTagByRegex(
      html,
      /<(div|main|article|section)[^>]*class="[^"]*(entry-content|post-content)[^"]*"[^>]*>/i,
    ) ||
    extractFirstBalancedTagByRegex(html, /<(article)\b[^>]*>/i) ||
    extractFirstBalancedTagByRegex(html, /<(main)\b[^>]*>/i) ||
    html;

  // Prefer content starting at the H1 if present (often skips header widgets like Google Reviews).
  const cleanedHtml = trimArticleBoilerplate(mainHtml);

  const contentText = stripHtml(cleanedHtml);
  if (!contentText) return null;
  const blocks = extractArticleBlocks(cleanedHtml);
  return { title, url, dateText, contentText, blocks };
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

function trimArticleBoilerplate(html: string): string {
  let out = html;

  // Skip header widgets by starting at the first H1 if possible.
  const h1Idx = out.search(/<h1\b/i);
  if (h1Idx >= 0) out = out.slice(h1Idx);

  // Trim off the contact form / footer sections that are appended to article pages.
  const cutPatterns: RegExp[] = [
    // Social/share / print blocks that sit after the article body.
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

