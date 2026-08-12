const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

(async () => {
  // Chrome profili kopyala (cookie'ler için)
  const srcProfile = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Default');
  const tmpDir = path.join(os.tmpdir(), 'tefas-chrome-' + Date.now());
  const tmpDefault = path.join(tmpDir, 'Default');
  fs.mkdirSync(tmpDefault, { recursive: true });

  // Sadece cookie dosyasını kopyala
  for (const f of ['Cookies', 'Cookies-journal', 'Local Storage', 'Session Storage']) {
    const src = path.join(srcProfile, f);
    const dst = path.join(tmpDefault, f);
    try {
      if (fs.statSync(src).isDirectory()) {
        fs.cpSync(src, dst, { recursive: true });
      } else {
        fs.copyFileSync(src, dst);
      }
      console.log('Kopyalandı:', f);
    } catch (e) { /* skip */ }
  }

  const browser = await chromium.launchPersistentContext(tmpDir, {
    headless: false,
    channel: 'chrome',
    args: ['--profile-directory=Default'],
  });

  const page = await browser.newPage();
  const captured = [];

  page.on('request', req => {
    const url = req.url();
    if (url.includes('tefas.gov.tr/api') && !url.includes('TSPD') && !url.includes('security.f5')) {
      let body = null;
      try { body = req.postData(); } catch {}
      console.log('\n[REQ]', req.method(), url.split('funds/')[1] || url);
      if (body) console.log('[BODY]', body);
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('tefas.gov.tr/api') && !url.includes('TSPD')) {
      let body = null;
      try { body = await res.text(); } catch {}
      console.log('[RES]', res.status(), url.split('/').pop());
      if (body) console.log('[DATA]', body.slice(0, 400));
      captured.push({ url, body });
    }
  });

  console.log('\nTEFAS açılıyor...');
  try {
    await page.goto('https://www.tefas.gov.tr/tr/fon-verileri', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  } catch (e) {
    console.log('Goto hatası (devam):', e.message.slice(0, 80));
  }

  console.log('Title:', await page.title().catch(() => '?'));
  console.log('45 saniye bekleniyor — sayfayı gözlemle...');
  await page.waitForTimeout(45000);

  await browser.close();
  console.log('\nYakalanan:', captured.length, 'API çağrısı');

  // Temizle
  fs.rmSync(tmpDir, { recursive: true, force: true });
})();
