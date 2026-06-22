import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TEFAS_BASE = 'https://www.tefas.gov.tr/api/funds';
const PAGE_SIZE = 100; // 25 min, 100 max test et

function dateStr(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function lastBusinessDay(): string {
  const d = new Date();
  // Bugün pazar (0) veya cumartesi (6) ise geri git
  do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

async function tefasPost(endpoint: string, body: Record<string, unknown>, token: string) {
  const res = await fetch(`${TEFAS_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Authorization': `Bearer ${token}`,
      'Origin': 'https://www.tefas.gov.tr',
      'Referer': 'https://www.tefas.gov.tr/tr/fon-verileri',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function fetchAllFunds(tarih: string, token: string) {
  const allFunds: Record<string, unknown>[] = [];

  const first = await tefasPost('fonGnlBlgSiraliGetir', {
    fonTipi: 'YAT', fonKodu: null, aramaMetni: null, fonTurKod: null,
    fonGrubu: null, sfonTurKod: null, basTarih: tarih, bitTarih: tarih,
    basSira: 1, bitSira: PAGE_SIZE, fonTurAciklama: null, dil: 'TR', kurucuKod: null,
  }, token);

  if (!first.resultList?.length) return { funds: [], error: first.errorMessage };

  allFunds.push(...first.resultList);
  const total = first.toplamSayi as number;
  console.log(`[TEFAS] ${tarih}: toplam ${total} fon, ${first.toplamSayfa} sayfa`);

  for (let start = PAGE_SIZE + 1; start <= total; start += PAGE_SIZE) {
    await new Promise(r => setTimeout(r, 200));
    const page = await tefasPost('fonGnlBlgSiraliGetir', {
      fonTipi: 'YAT', fonKodu: null, aramaMetni: null, fonTurKod: null,
      fonGrubu: null, sfonTurKod: null, basTarih: tarih, bitTarih: tarih,
      basSira: start, bitSira: start + PAGE_SIZE - 1,
      fonTurAciklama: null, dil: 'TR', kurucuKod: null,
    }, token);
    if (page.resultList) allFunds.push(...page.resultList);
  }

  return { funds: allFunds, error: null };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.TEFAS_BEARER_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'TEFAS_BEARER_TOKEN env var eksik' }, { status: 500 });
  }

  const tarih = lastBusinessDay();
  const { funds, error } = await fetchAllFunds(tarih, token);

  if (error || funds.length === 0) {
    return NextResponse.json({ error: error || 'Veri gelmedi', tarih }, { status: 500 });
  }

  // Supabase'e yaz
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
    );
    const rows = funds.map(f => ({ ...f, created_at: new Date().toISOString() }));
    const { error: dbErr } = await supabase
      .from('tefas_fon_verileri')
      .upsert(rows, { onConflict: 'tarih,fonKodu' });
    if (dbErr) console.error('[SUPABASE]', dbErr.message);
  }

  return NextResponse.json({
    tarih,
    fonSayisi: funds.length,
    ornek: funds.slice(0, 2),
  });
}
