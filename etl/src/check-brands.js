process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { parse } = require('node-html-parser');

async function test(slug) {
  const res = await fetch('https://www.sifiraracal.com/' + slug + '-fiyat-listesi', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const root = parse(html);
  console.log('\n=== ' + slug + ' ===');
  ['h1','h2','h3','h4','h5','h6'].forEach(tag => {
    const els = root.querySelectorAll(tag);
    if (els.length) console.log(tag + ':', els.map(e => e.text.trim().slice(0, 50)).join(' | '));
  });
  // Fiyat içeren text ara
  const idx = html.indexOf('Fiyat Listesi');
  if (idx > -1) console.log('Fiyat Listesi context:', html.slice(idx - 80, idx + 100).replace(/\s+/g, ' '));
}

async function main() {
  for (const slug of ['mercedes-benz', 'mitsubishi', 'mazda']) {
    await test(slug);
  }
}
main().catch(console.error);
