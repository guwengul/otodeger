require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

function modelCikar(tipAdi) {
  return tipAdi.trim().split(/\s+/)[0];
}

function titleCase(s) {
  return s.toLowerCase().replace(/(?:^|\s|-)\S/g, c => c.toUpperCase());
}

async function fetchAll(tablo, kolonlar) {
  const all = [];
  let offset = 0;
  while (true) {
    const { data } = await sb.from(tablo).select(kolonlar).range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

async function main() {
  console.log('Veriler yükleniyor...');
  const [tipler, sifir] = await Promise.all([
    fetchAll('arac_tipleri', 'id,marka_adi,tip_adi'),
    fetchAll('sifir_fiyatlari', 'id,marka_adi,model_adi'),
  ]);
  console.log(`  arac_tipleri: ${tipler.length}, sifir_fiyatlari: ${sifir.length}`);

  // Master model seti oluştur
  // Önce sıfır fiyattan ekle (temiz isimler)
  const master = new Map(); // "MARKA|MODEL_UPPER" → { marka, model }
  for (const s of sifir) {
    const key = s.marka_adi.toUpperCase() + '|' + s.model_adi.toUpperCase();
    master.set(key, { marka_adi: s.marka_adi, model_adi: s.model_adi });
  }

  // TSB'den ekle — sıfır'da yoksa
  for (const t of tipler) {
    const tsb_model = modelCikar(t.tip_adi);
    const key = t.marka_adi.toUpperCase() + '|' + tsb_model.toUpperCase();
    if (!master.has(key)) {
      master.set(key, { marka_adi: t.marka_adi, model_adi: titleCase(tsb_model) });
    }
  }

  const masterList = [...master.values()];
  console.log(`\nMaster model sayısı: ${masterList.length}`);

  // master_modeller tablosuna upsert
  console.log('master_modeller yükleniyor...');
  const BATCH = 500;
  for (let i = 0; i < masterList.length; i += BATCH) {
    const { error } = await sb.from('master_modeller')
      .upsert(masterList.slice(i, i + BATCH), { onConflict: 'marka_adi,model_adi' });
    if (error) throw new Error(`master_modeller upsert: ${error.message}`);
    process.stdout.write(`\r  ${Math.min(i + BATCH, masterList.length)}/${masterList.length}`);
  }
  console.log('\n');

  // master_modeller'den id'leri çek
  const { data: masterData } = await sb.from('master_modeller').select('id,marka_adi,model_adi');
  const masterIdMap = new Map(masterData.map(m => [m.marka_adi.toUpperCase() + '|' + m.model_adi.toUpperCase(), m.id]));

  // sifir_fiyatlari.master_model_id güncelle
  console.log('sifir_fiyatlari güncelleniyor...');
  let sfGuncellenen = 0;
  for (const s of sifir) {
    const key = s.marka_adi.toUpperCase() + '|' + s.model_adi.toUpperCase();
    const mid = masterIdMap.get(key);
    if (!mid) continue;
    const { error } = await sb.from('sifir_fiyatlari').update({ master_model_id: mid }).eq('id', s.id);
    if (error) console.warn(`  sifir ${s.id} güncelleme hatası: ${error.message}`);
    else sfGuncellenen++;
  }
  console.log(`  ${sfGuncellenen} kayıt güncellendi\n`);

  // arac_tipleri.master_model_id güncelle — batch ile
  console.log('arac_tipleri güncelleniyor...');
  let atGuncellenen = 0, atEslesmedi = 0;

  // Marka+model bazında grupla, sonra tek sorguda güncelle
  const tipGruplari = new Map(); // master_model_id → [arac_tip_id, ...]
  for (const t of tipler) {
    const tsb_model = modelCikar(t.tip_adi);
    const key = t.marka_adi.toUpperCase() + '|' + tsb_model.toUpperCase();
    const mid = masterIdMap.get(key);
    if (!mid) { atEslesmedi++; continue; }
    if (!tipGruplari.has(mid)) tipGruplari.set(mid, []);
    tipGruplari.get(mid).push(t.id);
  }

  for (const [mid, ids] of tipGruplari) {
    for (let i = 0; i < ids.length; i += 500) {
      const dilim = ids.slice(i, i + 500);
      const { error } = await sb.from('arac_tipleri').update({ master_model_id: mid }).in('id', dilim);
      if (error) console.warn(`  arac_tipleri güncelleme hatası: ${error.message}`);
      else atGuncellenen += dilim.length;
    }
    process.stdout.write(`\r  ${atGuncellenen}/${tipler.length}`);
  }
  console.log(`\n  ${atGuncellenen} kayıt güncellendi, ${atEslesmedi} eşleşmedi\n`);

  console.log('Tamamlandı.');
}
main().catch(err => { console.error('Hata:', err); process.exit(1); });
