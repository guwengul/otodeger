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

async function tefasRaw(endpoint: string, body: Record<string, unknown>) {
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
  return res.text();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // errorMessage:null döndüren kombinasyonların raw response'ını göster
  const rawResults: Record<string, string> = {};

  const testCases = [
    { tarih: '20260620', params: {} },
    { tarih: '20260620', params: { sayfaNo: 1, sayfaBoyutu: 5 } },
    { tarih: '20260619', params: {} },
    { tarih: '20260621', params: {} },
    { tarih: '20260621', params: { sfonTuru: '' } },
  ];

  for (const { tarih, params } of testCases) {
    const body = { basTarih: tarih, bitTarih: tarih, ...params };
    const raw = await tefasRaw('fonGnlBlgSiraliGetir', body);
    rawResults[`${tarih}_${JSON.stringify(params)}`] = raw.slice(0, 800);
    await new Promise(r => setTimeout(r, 500));
  }

  // fonDetayGetir raw - tarih ile
  const detayRaw = await tefasRaw('fonDetayGetir', { basTarih: '20260620', bitTarih: '20260620' });
  rawResults['fonDetayGetir_20260620'] = detayRaw.slice(0, 800);

  return NextResponse.json({ tarih: dateStr(0), rawResults });
}
