/**
 * sahibinden.com ilan keşif scripti
 * Otomobil ve SUV kategorilerindeki network isteklerini yakalar,
 * API endpoint'lerini ve yapısını analiz eder.
 *
 * Kullanım:
 *   node explore-sahibinden.js
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..');

// sahibinden otomobil kategori kodları
// 160 = Otomobil, 2882 = SUV (Spor Amaçlı)
const URLS = [
  'https://www.sahibinden.com/kategori/otomobil',
  'https://www.sahibinden.com/kategori/suv-arazi-arac',
];

async function main() {
  const browser = await chromium.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'tr-TR',
    extraHTTPHeaders: {
      'Accept-Language': 'tr-TR,tr;q=0.9',
    },
  });

  const page = await context.newPage();

  const apiRequests = [];

  // Tüm network isteklerini yakala
  page.on('request', req => {
    const url = req.url();
    const type = req.resourceType();
    if (type === 'xhr' || type === 'fetch' || url.includes('/api/') || url.includes('.json')) {
      apiRequests.push({
        url,
        method: req.method(),
        headers: req.headers(),
        postData: req.postData(),
        type,
      });
    }
  });

  page.on('response', async resp => {
    const url = resp.url();
    if (url.includes('/api/') || url.includes('search') || url.includes('list') || url.includes('ilan')) {
      try {
        const ct = resp.headers()['content-type'] || '';
        if (ct.includes('json')) {
          const body = await resp.text();
          console.log(`\n[API JSON] ${url}`);
          console.log(body.slice(0, 500));
        }
      } catch {}
    }
  });

  for (const url of URLS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Sayfa: ${url}`);
    console.log('='.repeat(60));

    apiRequests.length = 0;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      const title = await page.title();
      console.log('Title:', title);

      // Sayfa HTML'ini kaydet
      const slug = url.includes('suv') ? 'sahibinden-suv' : 'sahibinden-oto';
      const html = await page.content();
      fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.html`), html);
      console.log(`HTML kaydedildi: ${slug}.html (${(html.length/1024).toFixed(0)} KB)`);

      // API isteklerini göster
      if (apiRequests.length > 0) {
        console.log(`\nYakalanan API istekleri (${apiRequests.length}):`);
        apiRequests.forEach(r => {
          console.log(`  [${r.method}] ${r.url}`);
          if (r.postData) console.log(`    Body: ${r.postData.slice(0, 200)}`);
        });
      } else {
        console.log('\nHiç API isteği yakalanmadı.');
      }

      // İlan elementlerini bul
      const ilanCount = await page.$$eval('tr.searchResultsItem, .classified-item, [data-id]', els => els.length);
      console.log(`\nİlan elementi sayısı: ${ilanCount}`);

      // İlk ilana bak
      const firstIlan = await page.evaluate(() => {
        const el = document.querySelector('tr.searchResultsItem') ||
                   document.querySelector('.classified-item') ||
                   document.querySelector('[data-id]');
        if (!el) return null;
        return {
          tag: el.tagName,
          id: el.dataset.id || el.id || '',
          classes: el.className,
          text: el.innerText?.slice(0, 300),
          html: el.outerHTML?.slice(0, 500),
        };
      });

      if (firstIlan) {
        console.log('\nİlk ilan elementi:');
        console.log(JSON.stringify(firstIlan, null, 2));
      }

      // URL'lere bak — JSON endpoint var mı
      const links = await page.$$eval('a[href]', els =>
        els.map(e => e.href).filter(h => h.includes('json') || h.includes('api'))
      );
      if (links.length) {
        console.log('\nAPI linkleri:', links.slice(0, 10));
      }

      // __NEXT_DATA__ veya window değişkenlerini kontrol et
      const windowData = await page.evaluate(() => {
        const nd = window.__NEXT_DATA__;
        const sd = window.__sahibinden__;
        const ld = window.__LISTING_DATA__;
        return {
          hasNextData: !!nd,
          nextDataKeys: nd ? Object.keys(nd) : [],
          hasSahibinden: !!sd,
          hasListingData: !!ld,
          listingDataPreview: ld ? JSON.stringify(ld).slice(0, 300) : null,
        };
      });
      console.log('\nWindow değişkenleri:', JSON.stringify(windowData, null, 2));

      // __NEXT_DATA__ içinde ilan var mı
      const nextData = await page.evaluate(() => {
        if (!window.__NEXT_DATA__) return null;
        return JSON.stringify(window.__NEXT_DATA__).slice(0, 2000);
      });
      if (nextData) {
        console.log('\n__NEXT_DATA__ önizleme:');
        console.log(nextData);
      }

    } catch (e) {
      console.log('Hata:', e.message);
    }
  }

  await browser.close();
  console.log('\n\nKeşif tamamlandı!');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
