import { getCachedJson, setCachedJson } from '@/src/data/metaRepo';
import { absolutizeUrl, stripHtml } from '@/src/data/webContent/html';

export type TestimonialPreview = {
  id: string;
  author: string;
  quote: string;
  dateText?: string | null;
  url?: string | null;
};

const TESTIMONIALS_URL = 'https://www.ft-associates.com/sell-a-dental-practice/testimonials/';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export async function fetchAllTestimonials(): Promise<TestimonialPreview[]> {
  // v4: more robust parsing (supports single-quoted attributes)
  const key = `web.testimonials.v4.all`;
  const cached = await getCachedJson<TestimonialPreview[]>(key, CACHE_TTL_MS);
  if (cached?.length) return cached;

  const html = await fetchHtml(TESTIMONIALS_URL);
  const items = parseTestimonials(html, TESTIMONIALS_URL);
  try {
    await setCachedJson(key, items);
  } catch {
    // If caching fails (e.g. very large payload), still return the fetched items.
  }
  return items;
}

export async function fetchLatestTestimonials({ limit }: { limit: number }): Promise<TestimonialPreview[]> {
  const all = await fetchAllTestimonials();
  return all.slice(0, Math.max(1, limit));
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      // Helps avoid “bot” variants of the page on some devices/networks.
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

function slugify(input: string): string {
  const raw = (input ?? '').trim().toLowerCase();
  if (!raw) return 'client';
  const ascii = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || 'client';
}

function hashStringDjb2(input: string): string {
  // Simple, stable, non-crypto hash for IDs and cache keys.
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  // Unsigned 32-bit → base36 for compactness.
  return (h >>> 0).toString(36);
}

function makeTestimonialId(t: { author: string; quote: string; url?: string | null }): string {
  const authorSlug = slugify(t.author);
  const seed = `${t.author}|${t.quote}|${t.url ?? ''}`;
  const hash = hashStringDjb2(seed);
  return `${authorSlug}-${hash}`;
}

function parseTestimonials(html: string, baseUrl: string): TestimonialPreview[] {
  // Heuristics:
  // - Prefer structured review markup if present (e.g. itemprop="reviewBody")
  // - Otherwise fall back to heading + first paragraph style extraction.
  const out: TestimonialPreview[] = [];

  // itemprop style
  const reviewRe =
    /itemprop="reviewBody"[^>]*>([\s\S]*?)<\/[^>]+>[\s\S]{0,500}?(?:itemprop="author"[^>]*>[\s\S]*?<[^>]*itemprop="name"[^>]*>([^<]+)<\/[^>]+>|itemprop="author"[^>]*>([^<]+)<\/[^>]+)?/gi;
  let m: RegExpExecArray | null;
  while ((m = reviewRe.exec(html))) {
    const quote = stripHtml(m[1] ?? '').trim();
    const author = (m[2] ?? m[3] ?? '').trim() || 'Client';
    if (!quote) continue;
    out.push({ id: makeTestimonialId({ author, quote, url: TESTIMONIALS_URL }), author, quote, dateText: null, url: TESTIMONIALS_URL });
  }

  if (out.length >= 3) return out;

  // Heading + paragraph fallback
  const blockRe =
    /<(h2|h3)[^>]*>\s*<a[^>]+href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>\s*<\/(h2|h3)>[\s\S]{0,800}?<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = blockRe.exec(html))) {
    const href = (m[2] ?? m[3] ?? '').trim();
    const author = stripHtml(m[4] ?? '').trim();
    const quote = stripHtml(m[6] ?? '').trim();
    if (!author || !quote) continue;
    const url = href ? absolutizeUrl(baseUrl, href) : TESTIMONIALS_URL;
    out.push({ id: makeTestimonialId({ author, quote, url }), author, quote, dateText: null, url });
  }

  if (out.length >= 3) return out;

  // Current site layout (as of 2026): blocks like
  // <div class="testi-row1"><h2>Heading</h2>Quote...<p><strong>Author</strong></p>...</div>
  const rowRe =
    /<div[^>]+class=(?:"[^"]*\btesti-row1\b[^"]*"|'[^']*\btesti-row1\b[^']*')[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)<p[^>]*>\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*<\/p>/gi;
  while ((m = rowRe.exec(html))) {
    const heading = stripHtml(m[1] ?? '').trim();
    const body = stripHtml(m[2] ?? '').trim();
    const author = stripHtml(m[3] ?? '').trim();
    const quote = [heading, body].filter(Boolean).join(' — ');
    if (!author || !quote) continue;
    out.push({
      id: makeTestimonialId({ author, quote, url: TESTIMONIALS_URL }),
      author,
      quote,
      dateText: null,
      url: TESTIMONIALS_URL,
    });
  }

  // Last resort: scrape any strong-ish name lines + next paragraph.
  if (!out.length) {
    const nameParaRe = /<strong[^>]*>([^<]{2,80})<\/strong>[\s\S]{0,400}?<p[^>]*>([\s\S]*?)<\/p>/gi;
    while ((m = nameParaRe.exec(html))) {
      const author = stripHtml(m[1] ?? '').trim();
      const quote = stripHtml(m[2] ?? '').trim();
      if (!author || !quote) continue;
      out.push({ id: makeTestimonialId({ author, quote, url: TESTIMONIALS_URL }), author, quote, dateText: null, url: TESTIMONIALS_URL });
    }
  }

  // De-dupe by author+quote prefix.
  const seen = new Set<string>();
  const deduped: TestimonialPreview[] = [];
  for (const t of out) {
    const key = t.id || `${t.author}|${t.quote.slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(t);
  }
  return deduped;
}

