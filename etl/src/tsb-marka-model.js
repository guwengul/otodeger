require('dotenv/config');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const fs = require('fs');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

const DONANIM = new Set([
  'SEDAN','COUPE','CABRIO','HATCHBACK','HB','KOMBI','SW','ESTATE','WAGON',
  'CROSS','PLUS','COMFORT','ELEGANT','ELEGANCE','EXECUTIVE','PREMIUM',
  'SPORT','SPORTIVE','ACTIVE','ADVANCE','DYNAMIC','EXCLUSIVE','PRESTIGE',
  'ADVANTAGE','AMBIANCE','EXPERIENCE','TECHNO','EVOLUTION','EXPRESSION',
  'TITANIUM','TITANIUMX','TREND','TRENDLINE','HIGHLINE','COMFORTLINE',
  'JOY','ICON','STYLE','DESIGN','SIGNATURE','INITIALE','INTENS','ZENITH',
  'ALLURE','FELINE','PALLAS','BERLINA','DISTINCTIVE','PROGRESSION',
  'BUSINESS','URBAN','CITY','COUNTRY','LIMITED','EDITION','SPECIAL',
  'NEW','FACELIFT','LIFE','MOVE','SKY','PLAY','NAVI','VISION',
  'M','S','R','GT','GTS','GTE','GTI','GLE','AMG','RS',
  'AWD','FWD','RWD','4WD','4X4','XDRIVE','SDRIVE','QDRIVE','QUATTRO','ALLROAD',
]);

function sayisalMi(token) {
  return /^\d+[.,]?\d*[diltsvhp]?$/i.test(token) || /^\d{2,4}$/.test(token);
}

function modelCikar(tipAdi) {
  const parcalar = tipAdi.trim().split(/\s+/);
  const modelParcalar = [];
  for (const p of parcalar) {
    const temiz = p.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (sayisalMi(p) || DONANIM.has(temiz)) break;
    modelParcalar.push(p);
  }
  return modelParcalar.join(' ').trim() || parcalar[0];
}

async function main() {
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

  const [tipler, sifir] = await Promise.all([
    fetchAll('arac_tipleri', 'marka_adi,tip_adi'),
    fetchAll('sifir_fiyatlari', 'marka_adi,model_adi'),
  ]);

  const master = new Map(); // key: "MARKA|MODEL"

  // TSB'den ekle
  for (const t of tipler) {
    const model = modelCikar(t.tip_adi);
    const key = t.marka_adi.toUpperCase() + '|' + model.toUpperCase();
    if (!master.has(key)) master.set(key, { marka: t.marka_adi, tsb_model: model, sf_model: '', kaynak: 'TSB' });
  }

  // Sıfır fiyattan ekle
  for (const s of sifir) {
    const marka = s.marka_adi.toUpperCase();
    const model = s.model_adi.toUpperCase();
    const key = marka + '|' + model;
    if (master.has(key)) {
      master.get(key).sf_model = s.model_adi;
      master.get(key).kaynak = 'HER İKİSİ';
    } else {
      master.set(key, { marka: s.marka_adi, tsb_model: '', sf_model: s.model_adi, kaynak: 'SIFIR' });
    }
  }

  const satirlar = [['MARKA', 'TSB_MODEL', 'SIFIR_MODEL', 'KAYNAK', 'MASTER_MODEL_ADI']];
  [...master.values()]
    .sort((a, b) => a.marka.localeCompare(b.marka) || (a.tsb_model || a.sf_model).localeCompare(b.tsb_model || b.sf_model))
    .forEach(r => satirlar.push([r.marka, r.tsb_model, r.sf_model, r.kaynak, '']));

  const csv = satirlar.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  fs.writeFileSync('tsb-marka-model.csv', '﻿' + csv, 'utf8');
  console.log(`Oluşturuldu: tsb-marka-model.csv (${satirlar.length - 1} satır)`);
  console.log(`  TSB: ${[...master.values()].filter(v=>v.kaynak==='TSB').length}`);
  console.log(`  Sıfır: ${[...master.values()].filter(v=>v.kaynak==='SIFIR').length}`);
  console.log(`  Her ikisi: ${[...master.values()].filter(v=>v.kaynak==='HER İKİSİ').length}`);
}
main().catch(console.error);
