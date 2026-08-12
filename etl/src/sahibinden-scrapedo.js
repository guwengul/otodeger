/**
 * sahibinden.com scraper — scrape.do proxy üzerinden
 * TR IP'si sorununu atlar, JS render eder.
 *
 * Kullanım:
 *   SCRAPEDO_TOKEN=xxx node sahibinden-scrapedo.js
 *   SCRAPEDO_TOKEN=xxx MAX_SAYFA=5 node sahibinden-scrapedo.js
 *   SCRAPEDO_TOKEN=xxx KATEGORI=otomobil node sahibinden-scrapedo.js
 */

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.SCRAPEDO_TOKEN;
if (!TOKEN) { console.error('SCRAPEDO_TOKEN env var eksik'); process.exit(1); }

const KATEGORILER = {
  otomobil: 'Otomobil',
  'suv-arazi-arac': 'SUV / Arazi',
};

const OUTPUT_DIR = path.join(__dirname, '..', 'sahibinden-data');
const SAYFA_BOYUTU = 50;
const MAX_SAYFA = parseInt(process.env.MAX_SAYFA || '200');
const DELAY_MS = 1000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchViaScrapeDo(targetUrl, retry = 0) {
  const params = new URLSearchParams({
    token: TOKEN,
    url: targetUrl,
    geoCode: 'tr',       // Türk IP kullan
    render: 'false',     // sahibinden SSR, JS render gerekmez
    super: 'false',
  });

  const r = await fetch(`https://api.scrape.do/?${params}`, {
    signal: AbortSignal.timeout(30000),
  });

  if (r.status === 429 || r.status >= 500) {
    if (retry >= 3) throw new Error(`scrape.do HTTP ${r.status}`);
    await sleep(5000 * (retry + 1));
    return fetchViaScrapeDo(targetUrl, retry + 1);
  }

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`scrape.do ${r.status}: ${err.slice(0, 200)}`);
  }

  return r.text();
}

function parseIlanlar(html) {
  const ilanlar = [];

  // <tr data-id="..." class="...searchResultsItem...">
  const rowRegex = /<tr[^>]*data-id="(\d+)"[^>]*class="[^"]*searchResultsItem[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
  const rowRegex2 = /<tr[^>]*class="[^"]*searchResultsItem[^"]*"[^>]*data-id="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;

  const extract = (re) => {
    let m;
    while ((m = re.exec(html)) !== null) {
      const id = m[1];
      const row = m[2];

      const titleM = row.match(/class="classifiedTitle"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const title = titleM ? titleM[2].replace(/<[^>]+>/g, '').trim() : '';
      const url = titleM ? 'https://www.sahibinden.com' + titleM[1] : '';

      const priceM = row.match(/class="[^"]*searchResultsPriceValue[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
      const priceRaw = priceM ? priceM[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim() : '';
      const fiyat = priceRaw ? parseInt(priceRaw.replace(/\./g, '').replace(/[^\d]/g, '')) || null : null;

      const tds = [...row.matchAll(/<td[^>]*class="[^"]*searchResultsAttributeValue[^"]*"[^>]*>([\s\S]*?)<\/td>/g)];
      const yil = tds[0] ? tds[0][1].replace(/<[^>]+>/g, '').trim() : null;
      const km = tds[1] ? parseInt(tds[1][1].replace(/<[^>]+>/g, '').replace(/\./g, '').replace(/[^\d]/g, '')) || null : null;

      const lokM = row.match(/class="[^"]*searchResultsLocationValue[^"]*"[^>]*>([\s\S]*?)<\/td>/);
      const lokasyon = lokM ? lokM[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';

      const tarihM = row.match(/class="[^"]*searchResultsDateValue[^"]*"[^>]*>([\s\S]*?)<\/td>/);
      const tarih = tarihM ? tarihM[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';

      if (id && title) ilanlar.push({ id, title, url, fiyat, yil, km, lokasyon, tarih });
    }
  };

  extract(rowRegex);
  if (ilanlar.length === 0) extract(rowRegex2);
  return ilanlar;
}

async function scrapeKategori(slug) {
  const ad = KATEGORILER[slug] || slug;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Kategori: ${ad}`);
  console.log('='.repeat(60));

  const tumIlanlar = [];
  const gorulmus = new Set();

  for (let sayfa = 0; sayfa < MAX_SAYFA; sayfa++) {
    const targetUrl = `https://www.sahibinden.com/kategori/${slug}?pagingSize=${SAYFA_BOYUTU}&currentPage=${sayfa}`;
    process.stdout.write(`  Sayfa ${sayfa + 1}... `);

    let html;
    try {
      html = await fetchViaScrapeDo(targetUrl);
    } catch (e) {
      console.log(`HATA: ${e.message}`);
      break;
    }

    // Login duvarı kontrolü
    if (html.includes('sahibinden.com Giriş') || (html.includes('Giriş Yap') && !html.includes('searchResultsItem'))) {
      console.log('Login duvarı — scrape.do TR IP çalışmıyor.');
      break;
    }

    const ilanlar = parseIlanlar(html);
    const yeni = ilanlar.filter(i => !gorulmus.has(i.id));
    yeni.forEach(i => gorulmus.add(i.id));
    tumIlanlar.push(...yeni);

    console.log(`${yeni.length} ilan (toplam: ${tumIlanlar.length})`);

    if (yeni.length === 0 || ilanlar.length < SAYFA_BOYUTU) {
      console.log('  Son sayfa.');
      break;
    }

    await sleep(DELAY_MS);
  }

  return tumIlanlar;
}

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const hedefler = process.env.KATEGORI
    ? [process.env.KATEGORI]
    : Object.keys(KATEGORILER);

  const bugun = new Date().toISOString().slice(0, 10);

  for (const slug of hedefler) {
    const ilanlar = await scrapeKategori(slug);
    if (ilanlar.length > 0) {
      const dosya = path.join(OUTPUT_DIR, `sahibinden-${slug}-${bugun}.json`);
      fs.writeFileSync(dosya, JSON.stringify(ilanlar, null, 2));
      console.log(`\n✓ ${ilanlar.length} ilan → ${dosya}`);
    } else {
      console.log('\n⚠ Hiç ilan çekilemedi.');
    }
  }
  console.log('\nTamamlandı!');
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
