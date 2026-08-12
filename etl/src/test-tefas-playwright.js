process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true, ignoreHTTPSErrors: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'tr-TR',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });
  const page = await context.newPage();

  let apiResponse = null;
  page.on('response', async (res) => {
    if (res.url().includes('BindHistoryInfo')) {
      try { apiResponse = await res.text(); } catch {}
    }
  });

  console.log('Önce ana sayfaya gidiliyor (session ısıtma)...');
  await page.goto('https://www.tefas.gov.tr/', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Ana sayfa title:', await page.title());
  await page.waitForTimeout(3000);

  console.log('Tarihsel Veriler sayfasına gidiliyor...');
  await page.goto('https://www.tefas.gov.tr/TarihselVeriler.aspx', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const title = await page.title();
  console.log('Title:', title);
  const bodyLen = await page.evaluate(() => document.body.innerHTML.length);
  console.log('Body HTML length:', bodyLen);

  await page.screenshot({ path: 'tefas-screenshot.png' });
  console.log('Screenshot kaydedildi.');

  if (apiResponse) {
    console.log('BindHistoryInfo yanıtı yakalandı, ilk 500 karakter:');
    console.log(apiResponse.slice(0, 500));
  } else {
    console.log('BindHistoryInfo çağrısı yapılmadı.');
  }

  await browser.close();
}
main().catch(err => { console.error('Hata:', err); process.exit(1); });
