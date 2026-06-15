require('dotenv/config');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });
const fs = require('fs');

async function main() {
  // Eşleşmeyen sıfır fiyatlar
  const { data: eslesme } = await sb.from('sifir_fiyat_eslesme').select('sifir_fiyat_id');
  const { data: sifir } = await sb.from('sifir_fiyatlari').select('id,marka_adi,model_adi,versiyon');
  const eslesmisIdler = new Set((eslesme ?? []).map(e => e.sifir_fiyat_id));
  const eslesmeyen = sifir.filter(s => !eslesmisIdler.has(s.id));

  // 2026 aktif arac_tipleri
  const { data: aktif } = await sb.from('kasko_degerleri').select('arac_tip_id').eq('veri_yili', 2026);
  const aktifIdSet = new Set((aktif ?? []).map(r => r.arac_tip_id));
  const { data: tumTipler } = await sb.from('arac_tipleri').select('id,marka_adi,tip_adi');
  const aktifTipler = tumTipler.filter(t => aktifIdSet.has(t.id));

  // Marka bazında TSB tiplerini grupla
  const tsbGrubu = {};
  for (const t of aktifTipler) {
    const marka = t.marka_adi.toUpperCase();
    if (!tsbGrubu[marka]) tsbGrubu[marka] = [];
    tsbGrubu[marka].push(t);
  }

  // Her eşleşmeyen sıfır fiyat için aynı marka+model TSB versiyonlarını bul
  const satirlar = [['SF_MARKA', 'SF_MODEL', 'SF_VERSIYON', 'TSB_TIP_ADI']];

  for (const sf of eslesmeyen) {
    const marka = sf.marka_adi.toUpperCase();
    const modelNorm = sf.model_adi.toLowerCase().replace(/[\s\-\:]/g, '');
    const tsbAdaylar = (tsbGrubu[marka] ?? []).filter(t => {
      const tipNorm = t.tip_adi.toLowerCase().replace(/[\s\-\:]/g, '');
      return tipNorm.includes(modelNorm) || modelNorm.includes(tipNorm.split(' ')[0]);
    });

    if (tsbAdaylar.length === 0) {
      satirlar.push([sf.marka_adi, sf.model_adi, sf.versiyon, '(TSB\'de bulunamadı)']);
    } else {
      // İlk satır sıfır fiyat + ilk tsb versiyonu
      satirlar.push([sf.marka_adi, sf.model_adi, sf.versiyon, tsbAdaylar[0].tip_adi]);
      // Geri kalan tsb versiyonları sadece sağ sütunda
      for (let i = 1; i < tsbAdaylar.length; i++) {
        satirlar.push(['', '', '', tsbAdaylar[i].tip_adi]);
      }
      satirlar.push(['', '', '', '']); // boş ayırıcı satır
    }
  }

  // CSV yaz
  const csv = satirlar.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  fs.writeFileSync('eslesme-rapor.csv', '﻿' + csv, 'utf8'); // BOM for Excel Turkish chars
  console.log(`Rapor oluşturuldu: eslesme-rapor.csv (${satirlar.length} satır)`);
}
main().catch(console.error);
