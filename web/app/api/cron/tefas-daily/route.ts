import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CHROMIUM_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar';

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
    steps.push('2_chromium_required');

    const executablePath = await chromium.executablePath(CHROMIUM_URL);
    steps.push('3_executablePath:' + executablePath.slice(0, 40));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require('puppeteer-core');
    steps.push('4_puppeteer_required');

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
    steps.push('5_browser_launched');

    const captured: { url: string; body: string; response: string }[] = [];

    const page = await browser.newPage();
    steps.push('6_page_created');

    // Intercept CDP ile network isteklerini yakala
    const client = await page.createCDPSession();
    await client.send('Network.enable');

    const requestBodies: Record<string, string> = {};

    client.on('Network.requestWillBeSent', (e: { requestId: string; request: { url: string; method: string; postData?: string } }) => {
      if (e.request.url.includes('/api/funds/') && e.request.method === 'POST') {
        requestBodies[e.requestId] = e.request.postData || '';
      }
    });

    client.on('Network.responseReceived', async (e: { requestId: string; response: { url: string } }) => {
      if (e.response.url.includes('/api/funds/')) {
        try {
          const resp = await client.send('Network.getResponseBody', { requestId: e.requestId });
          captured.push({
            url: e.response.url,
            body: requestBodies[e.requestId] || '',
            response: resp.body?.slice(0, 600) || '',
          });
        } catch { /* ignore */ }
      }
    });

    steps.push('7_cdp_setup');

    await page.goto('https://www.tefas.gov.tr/tr/fon-verileri', {
      waitUntil: 'networkidle2',
      timeout: 40000,
    });
    steps.push('8_page_loaded');

    await new Promise(r => setTimeout(r, 5000));
    steps.push('9_waited');

    await browser.close();
    steps.push('10_done');

    const fonGnl = captured.filter(r => r.url.includes('fonGnlBlgSiraliGetir'));
    const diger = captured.filter(r => !r.url.includes('fonGnlBlgSiraliGetir'));

    return NextResponse.json({
      ok: true,
      steps,
      fonGnlBlgSiraliGetir: fonGnl,
      diger_apiler: diger.map(r => ({ ep: r.url.split('/').pop(), body: r.body.slice(0, 100), resp: r.response.slice(0, 100) })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 500), steps }, { status: 500 });
  }
}
