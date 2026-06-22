import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const chromium = require('@sparticuz/chromium-min');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium: playwrightChromium } = require('playwright-core');

const TEFAS_URL = 'https://www.tefas.gov.tr/tr/fon-verileri';

function dateStr(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// Son iş gününü bul (hafta sonu değil)
function lastBusinessDay() {
  const d = new Date();
  d.setDate(d.getDate() - 1); // dünden başla
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isLocal = process.env.NODE_ENV === 'development';

  let executablePath: string | undefined;
  try {
    executablePath = isLocal
      ? undefined
      : await chromium.executablePath(
          'https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar'
        );
  } catch (e) {
    return NextResponse.json({ error: 'executablePath hatası', detail: String(e).slice(0, 200) }, { status: 500 });
  }

  let browser;
  try {
    browser = await playwrightChromium.launch({
      args: isLocal ? [] : chromium.args,
      executablePath,
      headless: true,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Browser launch hatası', detail: String(e).slice(0, 300) }, { status: 500 });
  }

  const capturedRequests: { url: string; body: string; response: string }[] = [];
  const context = await browser.newContext();
  const page = await context.newPage();

  // API çağrılarını yakala
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page.on('request', (req: any) => {
    if (req.url().includes('/api/funds/') && req.method() === 'POST') {
      capturedRequests.push({
        url: req.url(),
        body: req.postData() || '',
        response: '',
      });
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page.on('response', async (res: any) => {
    if (res.url().includes('/api/funds/') && res.request().method() === 'POST') {
      const idx = capturedRequests.findLastIndex((r: { url: string; response: string }) => r.url === res.url() && !r.response);
      if (idx >= 0) {
        try { capturedRequests[idx].response = await res.text(); } catch { /* ignore */ }
      }
    }
  });

  try {
    await page.goto(TEFAS_URL, { waitUntil: 'networkidle', timeout: 45000 });
    // Sayfanın veri yüklemesi için bekle
    await page.waitForTimeout(5000);
  } catch (e) {
    await browser.close();
    return NextResponse.json({ error: 'Sayfa yüklenemedi: ' + String(e).slice(0, 100) });
  }

  await browser.close();

  // Yakalanan çağrıları analiz et
  const fonGnlCalls = capturedRequests.filter(r => r.url.includes('fonGnlBlgSiraliGetir'));
  const digerleri = capturedRequests.filter(r => !r.url.includes('fonGnlBlgSiraliGetir'));

  if (fonGnlCalls.length === 0) {
    return NextResponse.json({
      mesaj: 'fonGnlBlgSiraliGetir çağrısı yakalanmadı',
      diger_cagrilar: digerleri.map(r => ({ url: r.url.split('/').pop(), body: r.body.slice(0, 100) })),
      toplam: capturedRequests.length,
    });
  }

  // İlk başarılı çağrıyı döndür
  const ilk = fonGnlCalls[0];
  let parsed: unknown = null;
  try { parsed = JSON.parse(ilk.response); } catch { /* ignore */ }

  return NextResponse.json({
    mesaj: `${fonGnlCalls.length} fonGnlBlgSiraliGetir çağrısı yakalandı`,
    ilkBody: ilk.body,
    ilkResponseOrnek: ilk.response.slice(0, 500),
    responseAyristi: parsed,
    digerleri: digerleri.map(r => r.url.split('/').pop()),
  });
}
