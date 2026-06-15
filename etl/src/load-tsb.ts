import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parseTSB } from './parse-tsb';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws } }
);

const BATCH_SIZE = 500;

async function insertBatch<T extends object>(table: string, rows: T[]) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch);
    if (error) throw new Error(`${table} insert hatası: ${error.message}`);
    process.stdout.write(`\r  ${table}: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
  console.log();
}

async function loadTSB(dosyaYolu: string) {
  console.log(`\nParsing: ${dosyaYolu}`);
  const result = parseTSB(dosyaYolu);
  console.log(`Dönem: ${result.veri_ay}/${result.veri_yili}`);
  console.log(`Araç tipi: ${result.arac_tipleri.length}, Kasko kaydı: ${result.kasko_degerleri.length}`);

  // 1. Ham veriyi kaydet
  console.log('\n1. Ham veri yükleniyor...');
  const { data: upload, error: uploadError } = await supabase
    .from('raw_tsb_uploads')
    .upsert({
      dosya_adi: result.dosya_adi,
      veri_yili: result.veri_yili,
      veri_ay: result.veri_ay,
      ham_json: result.ham_json,
    }, { onConflict: 'veri_yili,veri_ay' })
    .select('id')
    .single();

  if (uploadError) throw new Error(`Ham veri hatası: ${uploadError.message}`);
  const kaynak_id = upload.id;
  console.log(`  Upload ID: ${kaynak_id}`);

  // 2. Araç tiplerini yükle
  console.log('\n2. Araç tipleri yükleniyor...');
  await insertBatch('arac_tipleri', result.arac_tipleri.map(a => ({
    marka_kodu: a.marka_kodu,
    tip_kodu: a.tip_kodu,
    marka_adi: a.marka_adi,
    tip_adi: a.tip_adi,
  })));

  // 3. Araç tip ID'lerini çek
  console.log('\n3. Araç tip ID\'leri alınıyor...');
  const { data: tipler, error: tipError } = await supabase
    .from('arac_tipleri')
    .select('id, marka_kodu, tip_kodu');

  if (tipError) throw new Error(`Tip ID hatası: ${tipError.message}`);

  const tipIdMap = new Map<string, number>();
  tipler.forEach(t => tipIdMap.set(`${t.marka_kodu}-${t.tip_kodu}`, t.id));

  // 4. Kasko değerlerini yükle
  console.log('\n4. Kasko değerleri yükleniyor...');
  const kaskoRows = result.kasko_degerleri.map(k => ({
    arac_tip_id: tipIdMap.get(`${k.marka_kodu}-${k.tip_kodu}`),
    arac_yili: k.arac_yili,
    kasko_degeri: k.kasko_degeri,
    veri_yili: result.veri_yili,
    veri_ay: result.veri_ay,
    kaynak_id,
  })).filter(k => k.arac_tip_id);

  await insertBatch('kasko_degerleri', kaskoRows);

  console.log('\nTamamlandı!');
}

// Ana akış
const dosya = process.argv[2];
if (!dosya) {
  console.error('Kullanım: ts-node load-tsb.ts <dosya.xlsx>');
  process.exit(1);
}

loadTSB(dosya).catch(err => {
  console.error('\nHata:', err.message);
  process.exit(1);
});
