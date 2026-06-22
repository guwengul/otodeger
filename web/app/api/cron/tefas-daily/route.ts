import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

    const executablePath = await chromium.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar'
    );
    steps.push('3_executablePath:' + executablePath.slice(0, 50));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { chromium: pw } = require('playwright-core');
    steps.push('4_playwright_required');

    const browser = await pw.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
    steps.push('5_browser_launched');

    await browser.close();
    steps.push('6_browser_closed');

    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    return NextResponse.json({
      error: String(e).slice(0, 400),
      steps,
    }, { status: 500 });
  }
}
