require('dotenv/config');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

async function main() {
  const { data: eslesme } = await sb.from('sifir_fiyat_eslesme').select('sifir_fiyat_id');
  const { data: sifir } = await sb.from('sifir_fiyatlari').select('id,marka_adi,model_adi,versiyon');

  const eslesmisIdler = new Set((eslesme ?? []).map(e => e.sifir_fiyat_id));
  const eslesmis = sifir.filter(s => eslesmisIdler.has(s.id));
  const eslesmeyen = sifir.filter(s => !eslesmisIdler.has(s.id));

  console.log(`Toplam sıfır fiyat: ${sifir.length}`);
  console.log(`Eşleşen: ${eslesmis.length} (%${((eslesmis.length/sifir.length)*100).toFixed(1)})`);
  console.log(`Eşleşmeyen: ${eslesmeyen.length} (%${((eslesmeyen.length/sifir.length)*100).toFixed(1)})\n`);

  // Marka bazında kapsama
  const markaAnaliz = {};
  for (const s of sifir) {
    if (!markaAnaliz[s.marka_adi]) markaAnaliz[s.marka_adi] = { toplam: 0, eslesen: 0 };
    markaAnaliz[s.marka_adi].toplam++;
    if (eslesmisIdler.has(s.id)) markaAnaliz[s.marka_adi].eslesen++;
  }
  console.log('--- Marka bazında kapsama ---');
  Object.entries(markaAnaliz)
    .sort((a, b) => b[1].toplam - a[1].toplam)
    .forEach(([marka, v]) => {
      const oran = ((v.eslesen / v.toplam) * 100).toFixed(0);
      console.log(`  ${marka.padEnd(15)} ${v.eslesen}/${v.toplam} (%${oran})`);
    });

  console.log('\n--- Eşleşmeyen tüm kayıtlar ---');
  const markaGruplari = {};
  for (const s of eslesmeyen) {
    if (!markaGruplari[s.marka_adi]) markaGruplari[s.marka_adi] = [];
    markaGruplari[s.marka_adi].push(`${s.model_adi} | ${s.versiyon}`);
  }
  for (const [marka, kayitlar] of Object.entries(markaGruplari)) {
    console.log(`\n[${marka}]`);
    kayitlar.forEach(k => console.log(`  ${k}`));
  }
}
main().catch(console.error);
