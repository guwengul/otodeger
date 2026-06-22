import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TEFAS_BASE = 'https://www.tefas.gov.tr/api/funds';

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

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
  return res.json();
}

async function fetchFundTypes(): Promise<{ sfonTuru: number; sfonTurAciklama: string }[]> {
  const data = await tefasPost('fonTurGetir', {});
  return data.resultList || [];
}

async function fetchFundList(basTarih: string, bitTarih: string): Promise<unknown[]> {
  const PAGE_SIZE = 100;
  const allFunds: unknown[] = [];

  // İlk sayfayı çek, toplam sayı öğren
  const first = await tefasPost('fonGnlBlgSiraliGetir', {
    basTarih,
    bitTarih,
    sayfaNo: 1,
    sayfaBoyutu: PAGE_SIZE,
  });

  if (first.errorMessage || !first.resultList) {
    // Fallback: farklı param kombinasyonları dene
    const fallbacks = [
      { basTarih, bitTarih, pageIndex: 1, pageSize: PAGE_SIZE },
      { basTarih, bitTarih, page: 1, size: PAGE_SIZE },
      { basTarih, bitTarih },
    ];
    for (const params of fallbacks) {
      const r = await tefasPost('fonGnlBlgSiraliGetir', params);
      if (r.resultList && r.resultList.length > 0) {
        allFunds.push(...r.resultList);
        return allFunds;
      }
    }
    return [];
  }

  allFunds.push(...(first.resultList || []));
  const totalPages = first.toplamSayfa || 1;

  for (let page = 2; page <= totalPages; page++) {
    await new Promise(r => setTimeout(r, 300));
    const data = await tefasPost('fonGnlBlgSiraliGetir', {
      basTarih,
      bitTarih,
      sayfaNo: page,
      sayfaBoyutu: PAGE_SIZE,
    });
    if (data.resultList) allFunds.push(...data.resultList);
  }

  return allFunds;
}

// GET /api/cron/tefas-daily
export async function GET(request: Request) {
  // Vercel cron güvenlik kontrolü
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tarih = dateStr(0); // bugün
    console.log(`[TEFAS] ${tarih} verisi çekiliyor...`);

    // Önce endpoint'lerin çalışıp çalışmadığını test et
    const fonTurleri = await fetchFundTypes();
    console.log(`[TEFAS] Fon türleri: ${fonTurleri.length}`);

    const fonlar = await fetchFundList(tarih, tarih);
    console.log(`[TEFAS] Fonlar: ${fonlar.length}`);

    if (fonlar.length === 0) {
      // Hafta sonu/tatil durumu — önceki iş günü dene
      const oncekiGun = dateStr(1);
      const fonlar2 = await fetchFundList(oncekiGun, oncekiGun);
      console.log(`[TEFAS] ${oncekiGun} önceki gün: ${fonlar2.length} fon`);

      return NextResponse.json({
        tarih,
        oncekiGun,
        fonTurleri: fonTurleri.length,
        sonuc: fonlar2.length,
        ornekVeri: fonlar2.slice(0, 2),
        mesaj: 'Bugün veri yok, önceki gün denendi',
      });
    }

    // Supabase'e yaz (env var varsa)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY,
      );

      const rows = (fonlar as Record<string, unknown>[]).map(f => ({
        tarih,
        ...f,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('tefas_fon_verileri')
        .upsert(rows, { onConflict: 'tarih,fonKodu' });

      if (error) console.error('[SUPABASE]', error.message);
    }

    return NextResponse.json({
      tarih,
      fonSayisi: fonlar.length,
      ornekVeri: (fonlar as Record<string, unknown>[]).slice(0, 2),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[TEFAS HATA]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
