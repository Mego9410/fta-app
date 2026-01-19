/* eslint-disable no-console */

async function fetchOnce(url, headers) {
  const res = await fetch(url, { method: 'GET', headers });
  const html = await res.text();
  const checks = {
    status: res.status,
    contentType: res.headers.get('content-type'),
    len: html.length,
    hasItempropReviewBody: /itemprop="reviewBody"/i.test(html),
    hasItempropAuthor: /itemprop="author"/i.test(html),
    hasHeadingLink: /<(h2|h3)[^>]*>\s*<a[^>]+href="[^"]+"/i.test(html),
    hasStrong: /<strong[^>]*>[^<]{2,80}<\/strong>/i.test(html),
    hasCloudflare: /cf-ray|cloudflare|attention required/i.test(html),
    hasWp: /wp-content|wordpress/i.test(html),
    hasTestimonialWord: /testimonial/i.test(html),
    hasStrongView: /strong-view/i.test(html),
    hasWpmtst: /wpmtst/i.test(html),
    hasSchemaReview: html.toLowerCase().includes('schema.org/review'),
    hasBlockquote: /<blockquote/i.test(html),
  };

  const idx = html.toLowerCase().indexOf('testimonial');
  const snippet =
    idx >= 0 ? html.slice(Math.max(0, idx - 120), Math.min(html.length, idx + 280)).replace(/\s+/g, ' ') : '';

  const nameParaRe = /<strong[^>]*>([^<]{2,80})<\/strong>[\s\S]{0,400}?<p[^>]*>([\s\S]*?)<\/p>/gi;
  let count = 0;
  while (nameParaRe.exec(html)) count++;

  // New layout parser candidate: testi-row1 blocks
  const rowRe =
    /<div[^>]+class="[^"]*\btesti-row1\b[^"]*"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)<p[^>]*>\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*<\/p>/gi;
  const parsed = [];
  let mm;
  while ((mm = rowRe.exec(html))) {
    const heading = (mm[1] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const body = (mm[2] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const author = (mm[3] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const quote = [heading, body].filter(Boolean).join(' — ');
    if (author && quote) parsed.push({ author, quote: quote.slice(0, 140) });
    if (parsed.length >= 3) break;
  }

  function around(marker) {
    const i = html.toLowerCase().indexOf(marker.toLowerCase());
    if (i < 0) return '';
    return html.slice(Math.max(0, i - 200), Math.min(html.length, i + 500)).replace(/\s+/g, ' ');
  }

  function after(marker, charsAfter = 3000) {
    const i = html.toLowerCase().indexOf(marker.toLowerCase());
    if (i < 0) return '';
    return html.slice(i, Math.min(html.length, i + charsAfter)).replace(/\s+/g, ' ');
  }

  return {
    checks,
    head: html.slice(0, 350).replace(/\s+/g, ' '),
    testimonialSnippet: snippet,
    nameParaMatches: count,
    testiRowParsed: parsed,
    aroundStrongView: around('strong-view'),
    aroundWpmtst: around('wpmtst'),
    aroundBlockquote: around('<blockquote'),
    aroundLdJson: around('application/ld+json'),
    aroundJson: around('application/json'),
    aroundScriptTestimonials: around('testimonials'),
    aroundMain: around('<main'),
    aroundEntryContent: around('entry-content'),
    aroundEntryTitle: around('entry-title'),
    aroundElementor: around('elementor'),
    aroundSwiper: around('swiper'),
    aroundCarousel: around('carousel'),
    aroundReview: around('review'),
    aroundReadWhat: after('Read what our sellers say about us', 5000),
    afterMiddleSection: after('section class="middle-', 5000),
  };
}

async function main() {
  const url = 'https://www.ft-associates.com/sell-a-dental-practice/testimonials/';

  const withUa = await fetchOnce(url, {
    Accept: 'text/html,application/xhtml+xml',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'en-GB,en;q=0.9',
  });

  const withoutUa = await fetchOnce(url, {
    Accept: 'text/html,application/xhtml+xml',
  });

  console.log('--- with UA ---');
  console.log(withUa.checks);
  console.log('nameParaMatches', withUa.nameParaMatches);
  console.log('testiRowParsed', withUa.testiRowParsed);
  console.log('head', withUa.head);
  console.log('testimonialSnippet', withUa.testimonialSnippet);
  if (withUa.aroundStrongView) console.log('aroundStrongView', withUa.aroundStrongView);
  if (withUa.aroundWpmtst) console.log('aroundWpmtst', withUa.aroundWpmtst);
  if (withUa.aroundBlockquote) console.log('aroundBlockquote', withUa.aroundBlockquote);
  if (withUa.aroundLdJson) console.log('aroundLdJson', withUa.aroundLdJson);
  if (withUa.aroundJson) console.log('aroundJson', withUa.aroundJson);
  if (withUa.aroundMain) console.log('aroundMain', withUa.aroundMain);
  if (withUa.aroundEntryContent) console.log('aroundEntryContent', withUa.aroundEntryContent);
  if (withUa.aroundEntryTitle) console.log('aroundEntryTitle', withUa.aroundEntryTitle);
  if (withUa.aroundElementor) console.log('aroundElementor', withUa.aroundElementor);
  if (withUa.aroundSwiper) console.log('aroundSwiper', withUa.aroundSwiper);
  if (withUa.aroundCarousel) console.log('aroundCarousel', withUa.aroundCarousel);
  if (withUa.aroundReview) console.log('aroundReview', withUa.aroundReview);
  if (withUa.aroundReadWhat) console.log('aroundReadWhat', withUa.aroundReadWhat);
  if (withUa.afterMiddleSection) console.log('afterMiddleSection', withUa.afterMiddleSection);

  console.log('--- without UA ---');
  console.log(withoutUa.checks);
  console.log('nameParaMatches', withoutUa.nameParaMatches);
  console.log('testiRowParsed', withoutUa.testiRowParsed);
  console.log('head', withoutUa.head);
  console.log('testimonialSnippet', withoutUa.testimonialSnippet);
  if (withoutUa.aroundStrongView) console.log('aroundStrongView', withoutUa.aroundStrongView);
  if (withoutUa.aroundWpmtst) console.log('aroundWpmtst', withoutUa.aroundWpmtst);
  if (withoutUa.aroundBlockquote) console.log('aroundBlockquote', withoutUa.aroundBlockquote);
  if (withoutUa.aroundLdJson) console.log('aroundLdJson', withoutUa.aroundLdJson);
  if (withoutUa.aroundJson) console.log('aroundJson', withoutUa.aroundJson);
  if (withoutUa.aroundMain) console.log('aroundMain', withoutUa.aroundMain);
  if (withoutUa.aroundEntryContent) console.log('aroundEntryContent', withoutUa.aroundEntryContent);
  if (withoutUa.aroundEntryTitle) console.log('aroundEntryTitle', withoutUa.aroundEntryTitle);
  if (withoutUa.aroundElementor) console.log('aroundElementor', withoutUa.aroundElementor);
  if (withoutUa.aroundSwiper) console.log('aroundSwiper', withoutUa.aroundSwiper);
  if (withoutUa.aroundCarousel) console.log('aroundCarousel', withoutUa.aroundCarousel);
  if (withoutUa.aroundReview) console.log('aroundReview', withoutUa.aroundReview);
  if (withoutUa.aroundReadWhat) console.log('aroundReadWhat', withoutUa.aroundReadWhat);
  if (withoutUa.afterMiddleSection) console.log('afterMiddleSection', withoutUa.afterMiddleSection);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

