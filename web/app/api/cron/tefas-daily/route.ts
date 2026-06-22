import { NextResponse } from 'next/server';

const TEFAS_BASE = 'https://www.tefas.gov.tr/api/funds';
const TEFAS_HOME = 'https://www.tefas.gov.tr';

async function getSessionCookies(): Promise<string> {
  // Önce ana sayfayı çek — JSESSIONID veya benzeri session cookie al
  const urls = [
    `${TEFAS_HOME}/tr/fon-verileri`,
    `${TEFAS_HOME}/`,
    `${TEFAS_HOME}/tr`,
  ];
  for (const url of urls) {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    }).catch(() => null);
    if (!r) continue;

    const setCookieHeader = r.headers.get('set-cookie');
    if (setCookieHeader) {
      // Tüm cookie değerlerini al (ad=değer kısmını)
      const cookies = setCookieHeader
        .split(/,(?=[^ ][^=]+=)/)
        .map(c => c.split(';')[0].trim())
        .filter(Boolean)
        .join('; ');
      if (cookies) return cookies;
    }
  }
  return '';
}

async function tefasPost(endpoint: string, body: Record<string, unknown>, cookies = '') {
  const res = await fetch(`${TEFAS_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Referer': `${TEFAS_HOME}/tr/fon-verileri`,
      'Origin': TEFAS_HOME,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...(cookies ? { 'Cookie': cookies } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 300) }; }
}

function dateStr(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Session cookie al
  const cookies = await getSessionCookies();

  const debug: Record<string, unknown> = { cookies: cookies.slice(0, 200) };

  // 2. Session cookie ile fonGnlBlgSiraliGetir dene
  const tarihler = ['20260620', '20260619', '20260618'];
  const paramSetleri = [
    {},
    { sayfaNo: 1, sayfaBoyutu: 5 },
    { sayfaNo: 1, sayfaBoyutu: 5, sfonTuru: 100 },
  ];

  for (const t of tarihler) {
    for (const p of paramSetleri) {
      const r = await tefasPost('fonGnlBlgSiraliGetir', { basTarih: t, bitTarih: t, ...p }, cookies);
      const key = `${t}_${JSON.stringify(p)}`;
      debug[key] = {
        errorMessage: r.errorMessage ?? null,
        count: r.resultList?.length ?? null,
        ornek: r.resultList?.[0] ?? r.raw ?? null,
      };
      if (r.resultList?.length > 0) {
        return NextResponse.json({ success: true, tarih: t, params: p, cookies: cookies.slice(0, 100), ornek: r.resultList.slice(0, 2) });
      }
      await new Promise(res => setTimeout(res, 400));
    }
  }

  return NextResponse.json({ tarih: dateStr(0), debug });
}
