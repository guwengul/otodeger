require('dotenv/config');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

async function main() {
  const { data: sifir } = await sb.from('sifir_fiyatlari').select('marka_adi,model_adi');
  const { data: aktif } = await sb.from('kasko_degerleri').select('arac_tip_id').eq('veri_yili', 2026);
  const aktifIdSet = new Set((aktif ?? []).map(r => r.arac_tip_id));
  const { data: tipler } = await sb.from('arac_tipleri').select('marka_adi,tip_adi').in('id', [...aktifIdSet]);

  // Sıfır fiyattaki unique marka+model'ler
  const sfModeller = [...new Map(sifir.map(s => [`${s.marka_adi}|${s.model_adi}`, s])).values()];

  console.log('--- Sıfır fiyat modeli | TSB\'de var mı? ---\n');
  let var_ = 0, yok = 0;
  for (const sf of sfModeller) {
    const modelNorm = sf.model_adi.toLowerCase().replace(/[\s\-:]/g, '');
    const marka = sf.marka_adi.toUpperCase();
    const tsbEslesen = tipler.filter(t =>
      t.marka_adi.toUpperCase() === marka &&
      t.tip_adi.toLowerCase().replace(/[\s\-:]/g, '').includes(modelNorm)
    );
    const durum = tsbEslesen.length > 0 ? `VAR (${tsbEslesen.length} versiyon)` : 'YOK';
    if (tsbEslesen.length > 0) var_++; else yok++;
    console.log(`${sf.marka_adi.padEnd(15)} ${sf.model_adi.padEnd(20)} → ${durum}`);
  }
  console.log(`\nToplam: ${sfModeller.length} model | TSB'de var: ${var_} | TSB'de yok: ${yok}`);
}
main().catch(console.error);
