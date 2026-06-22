import { NextResponse } from 'next/server';

const TEFAS_BASE = 'https://www.tefas.gov.tr/api/funds';

function dateStr(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function tefasPost(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${TEFAS_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Referer': 'https://www.tefas.gov.tr/tr/fon-verileri',
      'Origin': 'https://www.tefas.gov.tr',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 200) }; }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const debug: Record<string, unknown> = {};

  // 1. Fon türleri
  const fonTurleri = await tefasPost('fonTurGetir', {});
  debug.fonTurGetir = {
    count: fonTurleri.resultList?.length,
    ornek: fonTurleri.resultList?.slice(0, 2),
  };

  // 2. Fon grupları
  const fonGruplari = await tefasPost('fonGrupGetir', {});
  debug.fonGrupGetir = {
    count: fonGruplari.resultList?.length,
    ornek: fonGruplari.resultList?.slice(0, 2),
  };

  // 3. fonGnlBlgSiraliGetir — son 5 iş gününü dene, farklı param kombinasyonları
  const tarihler = [dateStr(0), dateStr(1), dateStr(2), dateStr(3), dateStr(4), dateStr(5)];
  const paramSetleri = [
    { sayfaNo: 1, sayfaBoyutu: 5 },
    { page: 1, pageSize: 5 },
    {},
    { sayfaNo: 1, sayfaBoyutu: 5, sfonTuru: '' },
  ];

  const gnlResults: Record<string, unknown> = {};
  let found = false;

  for (const t of tarihler) {
    for (const p of paramSetleri) {
      const body = { basTarih: t, bitTarih: t, ...p };
      const r = await tefasPost('fonGnlBlgSiraliGetir', body);
      const key = `${t}_${JSON.stringify(p)}`;
      gnlResults[key] = {
        errorMessage: r.errorMessage ?? null,
        toplamSayi: r.toplamSayi ?? null,
        count: r.resultList?.length ?? null,
        alanlar: r.resultList?.[0] ? Object.keys(r.resultList[0]) : null,
        ornek: r.resultList?.[0] ?? null,
      };
      if (r.resultList?.length > 0) { found = true; break; }
      await new Promise(res => setTimeout(res, 400));
    }
    if (found) break;
  }
  debug.fonGnlBlgSiraliGetir = gnlResults;

  // 4. dagilimSiraliGetirT de dene
  const dagRes = await tefasPost('dagilimSiraliGetirT', { basTarih: dateStr(3), bitTarih: dateStr(3) });
  debug.dagilimSiraliGetirT = {
    errorMessage: dagRes.errorMessage ?? null,
    count: dagRes.resultList?.length ?? null,
    alanlar: dagRes.resultList?.[0] ? Object.keys(dagRes.resultList[0]) : null,
  };

  // 5. fonDetayGetir — tür kodu ile
  const detayRes = await tefasPost('fonDetayGetir', { basTarih: dateStr(3), bitTarih: dateStr(3) });
  debug.fonDetayGetir = {
    errorMessage: detayRes.errorMessage ?? null,
    count: detayRes.resultList?.length ?? null,
    alanlar: detayRes.resultList?.[0] ? Object.keys(detayRes.resultList[0]) : null,
    ornek: detayRes.resultList?.[0] ?? null,
  };

  return NextResponse.json({ tarih: dateStr(0), debug });
}
