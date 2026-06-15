const { parse } = require('node-html-parser');
const html = require('fs').readFileSync('toyota.html', 'utf8');
const root = parse(html);

const kayitlar = [];
const h5ler = root.querySelectorAll('h5');

for (const h5 of h5ler) {
  const baslik = h5.text.replace('Fiyat Listesi', '').trim();
  if (!baslik) continue;

  const headerDiv = h5.parentNode;
  const grandParent = headerDiv && headerDiv.parentNode;
  if (!grandParent) continue;

  const children = grandParent.childNodes.filter(n => n.tagName);
  const wFullDiv = children[1];
  if (!wFullDiv) continue;

  const satirlar = wFullDiv.querySelectorAll('div');
  for (const satir of satirlar) {
    const spanlar = satir.querySelectorAll('span');
    if (spanlar.length < 5) continue;
    const versiyon = spanlar[0].text.trim();
    if (!versiyon || versiyon === 'Versiyon') continue;
    const fiyatRaw = spanlar[4].text.replace(/[^\d]/g, '');
    const fiyat = parseInt(fiyatRaw);
    if (!fiyat || fiyat < 100000) continue;
    kayitlar.push({ model: baslik, versiyon, fiyat });
  }
}

console.log('Toplam kayıt:', kayitlar.length);
kayitlar.slice(0, 10).forEach(k => console.log(JSON.stringify(k)));
