process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, ignoreHTTPSErrors: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'tr-TR',
  });
  const page = await ctx.newPage();
  await page.goto('https://www.sahibinden.com/kategori/otomobil', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(4000);

  const title = await page.title();
  const url = page.url();
  const ilanCount = await page.locator('tr.searchResultsItem').count().catch(() => 0);

  console.log('Title:', title);
  console.log('URL:', url);
  console.log('İlan sayısı:', ilanCount);

  const cookies = await ctx.cookies();
  const cfCookie = cookies.find(c => c.name === 'cf_clearance');
  console.log('cf_clearance:', cfCookie ? cfCookie.value.slice(0, 40) + '...' : 'YOK');

  // İlk birkaç ilan varsa göster
  if (ilanCount > 0) {
    const ilkIlan = await page.locator('tr.searchResultsItem').first().innerText().catch(() => '');
    console.log('İlk ilan:', ilkIlan.slice(0, 200));
  }

  await browser.close();
})().catch(e => { console.log('Hata:', e.message); process.exit(1); });
