process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true, ignoreHTTPSErrors: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'tr-TR',
  });

  const apiCalls = [];
  page.on('response', async (res) => {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json') && !url.includes('.js')) {
      apiCalls.push(url);
    }
  });

  console.log('Sayfaya gidiliyor...');
  await page.goto('https://www.renault.com.tr/bize-ulasin/yeni-arac-model-secimi/yeni-arac-al.html?modelAdminId=clio-cl6-ph1', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  try {
    await page.click('text=kabul ediyorum', { timeout: 5000 });
    console.log('Çerez onayı kabul edildi.');
  } catch { console.log('Çerez butonu bulunamadı.'); }
  await page.waitForTimeout(5000);

  console.log('\nJSON API çağrıları:');
  apiCalls.forEach(u => console.log(' ', u));

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
  console.log('\nBody preview:\n', bodyText);

  await page.screenshot({ path: 'renault-clio-screenshot.png', fullPage: false });

  await browser.close();
}
main().catch(err => { console.error('Hata:', err); process.exit(1); });
