/**
 * sahibinden.com İkinci El Araç İlan Scraper
 * Kategoriler: Otomobil + SUV/Arazi
 * Playwright headed browser ile sayfa sayfa ilan çeker, JSON kaydeder.
 *
 * Kullanım:
 *   node sahibinden-scrape.js               → otomobil + SUV
 *   KATEGORI=otomobil node sahibinden-scrape.js
 *   MAX_SAYFA=10 node sahibinden-scrape.js  → ilk 10 sayfa (500 ilan)
 *
 * İlk kez: login gerekirse tarayıcıda yapın, script bekler.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const KATEGORILER = {
  otomobil: 'Otomobil',
  'suv-arazi-arac': 'SUV / Arazi Araçları',
};

const OUTPUT_DIR = path.join(__dirname, '..', 'sahibinden-data');
const SAYFA_BOYUTU = 50;
const MAX_SAYFA = parseInt(process.env.MAX_SAYFA || '200');
const DELAY_MS = 1500;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseIlanListesi(html) {
  const ilanlar = [];

  // data-id içeren tr satırları
  const rowRegex = /<tr[^>]*data-id="(\d+)"[^>]*class="[^"]*searchResultsItem[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
  // Alternatif sıra
  const rowRegex2 = /<tr[^>]*class="[^"]*searchResultsItem[^"]*"[^>]*data-id="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;

  const extract = regex => {
    let m;
    while ((m = regex.exec(html)) !== null) {
      const id = m[1];
      const row = m[2];

      const titleM = row.match(/class="classifiedTitle"[^>]*href="([^"]+)"[^>]*>\s*([\s\S]*?)<\/a>/);
      const title = titleM ? titleM[2].replace(/<[^>]+>/g, '').trim() : '';
      const url = titleM ? 'https://www.sahibinden.com' + titleM[1] : '';

      const priceM = row.match(/class="[^"]*searchResultsPriceValue[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
      const priceRaw = priceM ? priceM[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim() : '';
      const fiyat = priceRaw ? parseInt(priceRaw.replace(/\./g, '').replace(/[^\d]/g, '')) || null : null;

      const tdMatch = [...row.matchAll(/<td[^>]*class="[^"]*searchResultsAttributeValue[^"]*"[^>]*>([\s\S]*?)<\/td>/g)];
      const yil = tdMatch[0] ? tdMatch[0][1].replace(/<[^>]+>/g, '').trim() : null;
      const kmRaw = tdMatch[1] ? tdMatch[1][1].replace(/<[^>]+>/g, '').replace(/\./g, '').trim() : null;
      const km = kmRaw ? parseInt(kmRaw.replace(/[^\d]/g, '')) || null : null;

      const lokM = row.match(/class="[^"]*searchResultsLocationValue[^"]*"[^>]*>([\s\S]*?)<\/td>/);
      const lokasyon = lokM ? lokM[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';

      const tarihM = row.match(/class="[^"]*searchResultsDateValue[^"]*"[^>]*>([\s\S]*?)<\/td>/);
      const tarih = tarihM ? tarihM[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';

      if (id && title) {
        ilanlar.push({ id, title, url, fiyat, yil, km, lokasyon, tarih });
      }
    }
  };

  extract(rowRegex);
  if (ilanlar.length === 0) extract(rowRegex2);
  return ilanlar;
}

async function scrapeKategori(context, slug) {
  const ad = KATEGORILER[slug] || slug;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Kategori: ${ad}`);

  const tumIlanlar = [];
  const gorulmus = new Set();

  for (let sayfa = 0; sayfa < MAX_SAYFA; sayfa++) {
    const url = `https://www.sahibinden.com/kategori/${slug}?pagingSize=${SAYFA_BOYUTU}&currentPage=${sayfa}`;
    const page = await context.newPage();

    process.stdout.write(`  Sayfa ${sayfa + 1} (${url.split('?')[1]})... `);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);

      const pageUrl = page.url();
      if (pageUrl.includes('/giris') || pageUrl.includes('secure.sahibinden')) {
        console.log('\n⚠ Login gerekiyor! Lütfen tarayıcıda giriş yapın, sonra devam edin.');
        await page.waitForURL('**/kategori/**', { timeout: 120000 });
        console.log('Giriş yapıldı, devam ediliyor...');
      }

      const html = await page.content();

      // Login sayfasına düşme kontrolü
      if (html.includes('>Giriş Yap<') && !html.includes('searchResultsItem')) {
        console.log('Login sayfası, atlandı.');
        await page.close();
        break;
      }

      const ilanlar = parseIlanListesi(html);
      const yeniIlanlar = ilanlar.filter(i => !gorulmus.has(i.id));

      yeniIlanlar.forEach(i => gorulmus.add(i.id));
      tumIlanlar.push(...yeniIlanlar);

      console.log(`${yeniIlanlar.length} ilan (toplam: ${tumIlanlar.length})`);

      if (yeniIlanlar.length === 0 || ilanlar.length < SAYFA_BOYUTU) {
        console.log('  Son sayfa.');
        await page.close();
        break;
      }

    } catch (e) {
      console.log(`HATA: ${e.message}`);
      await page.close();
      break;
    }

    await page.close();
    await sleep(DELAY_MS + Math.random() * 500);
  }

  return tumIlanlar;
}

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: false, // headed — bot tespitinden kaçınmak için
    ignoreHTTPSErrors: true,
    args: [
      '--no-sandbox',
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'tr-TR',
    viewport: null,
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const hedefKategoriler = process.env.KATEGORI
    ? [process.env.KATEGORI]
    : Object.keys(KATEGORILER);

  const bugun = new Date().toISOString().slice(0, 10);

  for (const slug of hedefKategoriler) {
    const ilanlar = await scrapeKategori(context, slug);
    if (ilanlar.length > 0) {
      const dosya = path.join(OUTPUT_DIR, `sahibinden-${slug}-${bugun}.json`);
      fs.writeFileSync(dosya, JSON.stringify(ilanlar, null, 2));
      console.log(`\n✓ ${ilanlar.length} ilan → ${dosya}`);
    }
  }

  await browser.close();
  console.log('\nTamamlandı!');
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
