// Debug helper: fetch the articles index and print the first extracted URLs.
// Run: node FTA/scripts/debugArticlesIndex.js

const INDEX_URL = 'https://www.ft-associates.com/article/';

const postRe =
  /<(h2|h3)[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/(h2|h3)>[\s\S]{0,700}?(?:<time[^>]*>([^<]+)<\/time>)?[\s\S]{0,700}?(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;

async function main() {
  const res = await fetch(INDEX_URL, { headers: { Accept: 'text/html,application/xhtml+xml' } });
  console.log('status', res.status, 'finalUrl', res.url);
  const html = await res.text();
  const urls = [];
  let m;
  while ((m = postRe.exec(html))) urls.push(m[2]);
  const uniq = [...new Set(urls)];
  console.log('matches', urls.length, 'uniq', uniq.length);
  console.log('first 30 urls:');
  uniq.slice(0, 30).forEach((u, i) => console.log(i + 1, u));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

