process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true, ignoreHTTPSErrors: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'tr-TR',
  });

  console.log('Sayfaya gidiliyor...');
  await page.goto('https://www.audi.com.tr/tr/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const title = await page.title();
  console.log('Title:', title);

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('Body preview:', bodyText);

  await page.screenshot({ path: 'audi-screenshot.png' });
  console.log('Screenshot kaydedildi: audi-screenshot.png');

  await browser.close();
}
main().catch(err => { console.error('Hata:', err); process.exit(1); });
