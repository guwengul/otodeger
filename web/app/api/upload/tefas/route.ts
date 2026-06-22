import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UPLOAD_SECRET = process.env.UPLOAD_SECRET || '';

export async function POST(request: Request) {
  // Basit secret koruması
  const auth = request.headers.get('x-upload-secret');
  if (UPLOAD_SECRET && auth !== UPLOAD_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase env eksik' }, { status: 500 });
  }

  const { records, fonTipi } = await request.json() as { records: Record<string, unknown>[]; fonTipi: string };
  if (!records?.length) return NextResponse.json({ inserted: 0 });

  const supabase = createClient(supabaseUrl, supabaseKey);

  const rows = records.map((r: Record<string, unknown>) => ({
    tarih: r.tarih,
    fonTipi,
    fonKodu: r.fonKodu,
    fonUnvan: r.fonUnvan,
    fiyat: r.fiyat,
    tedPaySayisi: r.tedPaySayisi,
    kisiSayisi: r.kisiSayisi,
    portfoyBuyukluk: r.portfoyBuyukluk,
    borsaBultenFiyat: r.borsaBultenFiyat ?? null,
  }));

  const { error } = await supabase
    .from('tefas_fon_verileri')
    .upsert(rows, { onConflict: 'tarih,fonTipi,fonKodu' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: rows.length });
}
