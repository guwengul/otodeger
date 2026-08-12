/**
 * sahibinden.com Cookie Yakalayıcı
 * Görünür (headed) browser açar, kullanıcı giriş yapınca cookies kaydeder.
 *
 * Kullanım:
 *   node sahibinden-get-cookies.js
 *
 * Tarayıcı açılınca:
 *   1. sahibinden.com'a giriş yapın
 *   2. Otomobil listesi görününce bu terminalde ENTER'a basın
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COOKIES_FILE = path.join(__dirname, '..', 'sahibinden-cookies.json');

async function main() {
  console.log('Görünür tarayıcı açılıyor...');
  const browser = await chromium.launch({
    headless: false,
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
    // Otomasyon bayraklarını gizle
    javaScriptEnabled: true,
  });

  // navigator.webdriver'ı gizle
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    delete window.__playwright;
    delete window.__pw_manual;
  });

  const page = await context.newPage();

  console.log('\n================================');
  console.log('1. sahibinden.com açılıyor...');
  console.log('2. Giriş yapın veya ilanları görmek için bekleyin');
  console.log('3. Otomobil listesi yüklenince buraya ENTER basın');
  console.log('================================\n');

  await page.goto('https://www.sahibinden.com/kategori/otomobil', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('İlanlar yüklenince ENTER > ', () => { rl.close(); resolve(); });
  });

  const cookies = await context.cookies();
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  console.log(`\n✓ ${cookies.length} cookie kaydedildi: ${COOKIES_FILE}`);

  const kritik = cookies.filter(c =>
    ['cf_clearance', '__cf_bm', 'SID', 'JSESSIONID'].some(n => c.name.includes(n))
  );
  if (kritik.length) {
    console.log('\nKritik cookie\'ler:');
    kritik.forEach(c => console.log(`  ${c.name}`));
  }

  // Test: şimdi fetch ile dene
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  console.log('\nTest isteği yapılıyor...');
  try {
    const r = await fetch('https://www.sahibinden.com/kategori/otomobil?pagingSize=20', {
      headers: {
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'Referer': 'https://www.sahibinden.com/',
      },
    });
    const html = await r.text();
    const ilanCount = (html.match(/searchResultsItem/g) || []).length;
    if (ilanCount > 0) {
      console.log(`✓ Cookie çalışıyor! ${ilanCount} ilan elementi bulundu.`);
      console.log('\nArtık sahibinden-scrape.js çalıştırabilirsiniz:');
      console.log('  node sahibinden-scrape.js');
    } else if (html.includes('Giriş')) {
      console.log('⚠ Cookie ile direkt fetch çalışmıyor (bot tespiti).');
      console.log('  Browser-based scraping gerekebilir.');
    } else {
      console.log(`? HTTP ${r.status} — ilan bulunamadı ama login değil.`);
    }
  } catch (e) {
    console.log('Test başarısız:', e.message);
  }

  await browser.close();
}

main().catch(e => { console.error('Hata:', e.message); process.exit(1); });
