import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CHROMIUM_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar';
const TEFAS_FON = 'https://www.tefas.gov.tr/tr/fon-verileri';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const steps: string[] = [];

  try {
    steps.push('1_start');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const chromium = require('@sparticuz/chromium-min');
    const executablePath = await chromium.executablePath(CHROMIUM_URL);
    steps.push('2_chromium_ok');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require('puppeteer-core');
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
    steps.push('3_browser_ok');

    const page = await browser.newPage();

    // Puppeteer native response interception
    const captured: { ep: string; reqBody: string; resBody: string }[] = [];

    page.on('response', async (res: { url: () => string; text: () => Promise<string>; request: () => { postData: () => string | null } }) => {
      const url = res.url();
      if (url.includes('tefas.gov.tr/api/')) {
        const ep = url.split('/api/')[1] || url;
        let resBody = '';
        let reqBody = '';
        try { resBody = await res.text(); } catch { /* ignore */ }
        try { reqBody = res.request().postData() || ''; } catch { /* ignore */ }
        captured.push({ ep, reqBody, resBody: resBody.slice(0, 600) });
      }
    });

    steps.push('4_listeners_set');

    await page.goto(TEFAS_FON, { waitUntil: 'networkidle2', timeout: 40000 });
    const title1 = await page.title();
    steps.push('5_goto_done_title=' + title1.slice(0, 40));

    // F5 challenge sonrası sayfa yeniden yüklenebilir — bekle
    await new Promise((r) => setTimeout(r, 12000));
    const title2 = await page.title();
    steps.push('6_after_wait_title=' + title2.slice(0, 40));

    await browser.close();
    steps.push('7_done');

    return NextResponse.json({
      ok: true,
      steps,
      captured_count: captured.length,
      tefas_apis: captured,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 500), steps }, { status: 500 });
  }
}
