process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');

const URL = 'https://www.renault.com.tr/bize-ulasin/yeni-arac-model-secimi.html';
const BASELINE_PATH = path.join(__dirname, '../renault-fiyat-baseline.json');

async function fetchHtml() {
  const res = await fetch(URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function extractModelFiyatlari(html) {
  // <div class="VehicleModelCard__modelName_price">MODEL<div class="ModelStartingPrice">...başlangıç fiyatı <!-- -->₺N
  const re = /VehicleModelCard__modelName_price">([^<]+)<div class="ModelStartingPrice">.*?başlangıç fiyatı <!-- -->₺([\d.]+)/gs;
  const sonuc = {};
  let m;
  while ((m = re.exec(html)) !== null) {
    const fiyat = parseInt(m[2].replace(/\./g, ''), 10);
    sonuc[m[1].trim()] = { minPrice: fiyat };
  }
  return sonuc;
}

async function main() {
  console.log('Renault model sayfası çekiliyor...');
  const html = await fetchHtml();
  const guncel = extractModelFiyatlari(html);

  if (Object.keys(guncel).length === 0) {
    console.error('UYARI: Hiç model verisi bulunamadı — site yapısı değişmiş olabilir.');
    process.exit(1);
  }

  if (!fs.existsSync(BASELINE_PATH)) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(guncel, null, 2));
    console.log(`Baseline oluşturuldu: ${BASELINE_PATH} (${Object.keys(guncel).length} model)`);
    return;
  }

  const eski = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const degisenler = [];

  for (const [model, veri] of Object.entries(guncel)) {
    const eskiVeri = eski[model];
    if (!eskiVeri) {
      degisenler.push(`YENİ MODEL: ${model} — ${veri.minPrice} TL`);
    } else if (eskiVeri.minPrice !== veri.minPrice) {
      degisenler.push(`FİYAT DEĞİŞTİ: ${model} — ${eskiVeri.minPrice} TL → ${veri.minPrice} TL`);
    }
  }
  for (const model of Object.keys(eski)) {
    if (!guncel[model]) degisenler.push(`KALKTI: ${model}`);
  }

  if (degisenler.length > 0) {
    console.log('\n=== DEĞİŞİKLİK TESPİT EDİLDİ ===');
    degisenler.forEach(d => console.log(' - ' + d));
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(guncel, null, 2));
    console.log('\nBaseline güncellendi.');
    process.exitCode = 2; // değişiklik var sinyali
  } else {
    console.log('Değişiklik yok.');
  }
}

main().catch(err => { console.error('Hata:', err); process.exit(1); });
