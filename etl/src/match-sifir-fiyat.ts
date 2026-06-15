import 'dotenv/config';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws } }
);

// ---------------------------------------------------------------------------
// Normalizasyon
// ---------------------------------------------------------------------------

const KISALTMALAR: Record<string, string> = {
  'quattro': 'quattro', 'q': '',
  'tiptronic': 'tiptronic', 'dsg': 'dsg', 'cvt': 'cvt', 'dct': 'dct',
  'hybrid': 'hybrid', 'hibrit': 'hybrid', 'hev': 'hybrid', 'phev': 'phev',
  'mhev': 'mhev', 'bev': 'bev', 'electric': 'electric', 'elektrik': 'electric',
  'benzin': 'benzin', 'dizel': 'dizel', 'diesel': 'dizel',
  'otomatik': 'otomatik', 'manuel': 'manuel', 'automatic': 'otomatik',
  'tfsi': 'tfsi', 'tdi': 'tdi', 'tsi': 'tsi', 'gdi': 'gdi', 'crdi': 'crdi',
  'hdi': 'hdi', 'dci': 'dci', 'jtd': 'jtd', 'jtdm': 'jtdm',
  'sline': 'sline', 's-line': 'sline', 'amg': 'amg', 'msport': 'msport',
  'm-sport': 'msport', 'xdrive': 'xdrive', 'sdrive': 'sdrive', 'edrive': 'edrive',
  'allroad': 'allroad', 'sportback': 'sportback', 'avant': 'avant',
  'pi': '', // "PI" suffix anlamsız
};

function normalize(s: string): Set<string> {
  const tokens = s
    .toLowerCase()
    .replace(/[^a-z0-9ışğüöçışğüöç\s]/gi, ' ')
    .split(/\s+/)
    .map(t => KISALTMALAR[t] ?? t)
    .filter(t => t.length > 0)
    // Sadece sayısal token'ları kısa tutma (hp değerleri gibi: 286, 265)
    // Motor hacmi token'ları tut (3.0, 2.0 vb → 30, 20 gibi normalize et)
    .map(t => t.replace(/\./, ''));

  return new Set(tokens.filter(t => t.length > 0));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const kesisim = [...a].filter(t => b.has(t)).length;
  const birlesim = new Set([...a, ...b]).size;
  return birlesim === 0 ? 0 : kesisim / birlesim;
}

// TSB tip_adi'nden model adını çıkar
// Örn: "Q7 S LINE 45 TFSI 265 QUATTRO TIPTRONIC PI" → model="Q7", kalan="S LINE 45 TFSI..."
// Bazı modeller çok kelimeli: "A 180", "GLE 450", "COROLLA CROSS"
function modelVeVersiyonAyir(tipAdi: string): { model: string; kalanTokenlar: Set<string> } {
  const parcalar = tipAdi.trim().split(/\s+/);

  // İlk 1-3 kelimeyi model adayı olarak dene, en uzun modeli al
  // (Gerçek eşleşme sırasında sifir_fiyat tarafındaki model_adi ile kontrol edilecek)
  const model = parcalar[0];
  const kalan = parcalar.slice(1).join(' ');

  return { model, kalanTokenlar: normalize(kalan) };
}

// ---------------------------------------------------------------------------
// Veri yükleme
// ---------------------------------------------------------------------------

interface AracTipi {
  id: number;
  marka_adi: string;
  tip_adi: string;
}

interface SifirFiyat {
  id: number;
  marka_adi: string;
  model_adi: string;
  versiyon: string;
}

async function tumunuCek<T>(tablo: string, kolonlar: string): Promise<T[]> {
  const sonuc: T[] = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tablo)
      .select(kolonlar)
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`${tablo} okuma hatası: ${error.message}`);
    if (!data || data.length === 0) break;
    sonuc.push(...(data as T[]));
    if (data.length < limit) break;
    offset += limit;
  }
  return sonuc;
}

// ---------------------------------------------------------------------------
// Eşleştirme
// ---------------------------------------------------------------------------

interface Eslesme {
  arac_tip_id: number;
  sifir_fiyat_id: number;
  eslesme_skoru: number;
  tsb_tip_adi: string;
  sf_tam_adi: string;
}

function eslesmeleriHesapla(
  aracTipleri: AracTipi[],
  sifirFiyatlar: SifirFiyat[]
): { eslesme: Eslesme; tip: AracTipi; sf: SifirFiyat }[] {
  // Marka bazında arac_tipleri grupla
  const markaGrubu = new Map<string, AracTipi[]>();
  for (const tip of aracTipleri) {
    const marka = tip.marka_adi.toUpperCase();
    if (!markaGrubu.has(marka)) markaGrubu.set(marka, []);
    markaGrubu.get(marka)!.push(tip);
  }

  const sonuclar: { eslesme: Eslesme; tip: AracTipi; sf: SifirFiyat }[] = [];
  const ESIK = 0.25;

  // Sıfır fiyattan kasko'ya: her sıfır fiyat için en iyi kasko eşleşmesini bul
  for (const sf of sifirFiyatlar) {
    const adaylar = markaGrubu.get(sf.marka_adi.toUpperCase()) ?? [];
    if (adaylar.length === 0) continue;

    const sfModelNorm = sf.model_adi.toLowerCase().replace(/[\s-]/g, '');
    const sfTokenlar = normalize(sf.versiyon);

    let enIyiSkor = -1;
    let enIyiTip: AracTipi | null = null;

    for (const tip of adaylar) {
      const { model: tipModel, kalanTokenlar: tipTokenlar } = modelVeVersiyonAyir(tip.tip_adi);
      const tipModelNorm = tipModel.toLowerCase().replace(/\s+/g, '');

      if (!sfModelNorm.includes(tipModelNorm) && !tipModelNorm.includes(sfModelNorm)) continue;

      const skor = jaccard(tipTokenlar, sfTokenlar);
      if (skor > enIyiSkor) {
        enIyiSkor = skor;
        enIyiTip = tip;
      }
    }

    if (enIyiTip && enIyiSkor >= ESIK) {
      sonuclar.push({
        eslesme: {
          arac_tip_id: enIyiTip.id,
          sifir_fiyat_id: sf.id,
          eslesme_skoru: Math.round(enIyiSkor * 1000) / 1000,
          tsb_tip_adi: `${enIyiTip.marka_adi} ${enIyiTip.tip_adi}`,
          sf_tam_adi: `${sf.marka_adi} ${sf.model_adi} ${sf.versiyon}`,
        },
        tip: enIyiTip,
        sf,
      });
    }
  }

  return sonuclar;
}

// ---------------------------------------------------------------------------
// Ana akış
// ---------------------------------------------------------------------------

async function main() {
  console.log('Veriler yükleniyor...');
  const [aracTipleri, sifirFiyatlar] = await Promise.all([
    tumunuCek<AracTipi>('arac_tipleri', 'id,marka_adi,tip_adi'),
    tumunuCek<SifirFiyat>('sifir_fiyatlari', 'id,marka_adi,model_adi,versiyon'),
  ]);
  console.log(`  arac_tipleri: ${aracTipleri.length}, sifir_fiyatlari: ${sifirFiyatlar.length}`);

  console.log('Eşleştiriliyor...');
  const sonuclar = eslesmeleriHesapla(aracTipleri, sifirFiyatlar);
  console.log(`  ${sonuclar.length} eşleşme bulundu\n`);

  // Yüksek skorlu örnekler
  const yuksekSkorlu = [...sonuclar].sort((a, b) => b.eslesme.eslesme_skoru - a.eslesme.eslesme_skoru).slice(0, 10);
  console.log('--- En iyi 10 eşleşme ---');
  yuksekSkorlu.forEach(({ tip, sf, eslesme }) => {
    console.log(`  [${eslesme.eslesme_skoru.toFixed(3)}] TSB: "${tip.marka_adi} ${tip.tip_adi}"`);
    console.log(`         SF:  "${sf.model_adi} ${sf.versiyon}"\n`);
  });

  // Supabase'e yükle
  console.log('Supabase\'e yükleniyor...');
  const BATCH = 500;
  // arac_tip_id başına sadece en yüksek skorlu kaydı tut
  const enIyiMap = new Map<number, Eslesme>();
  for (const s of sonuclar) {
    const mevcut = enIyiMap.get(s.eslesme.arac_tip_id);
    if (!mevcut || s.eslesme.eslesme_skoru > mevcut.eslesme_skoru) {
      enIyiMap.set(s.eslesme.arac_tip_id, s.eslesme);
    }
  }
  const kayitlar = [...enIyiMap.values()];
  for (let i = 0; i < kayitlar.length; i += BATCH) {
    const { error } = await supabase
      .from('sifir_fiyat_eslesme')
      .upsert(kayitlar.slice(i, i + BATCH), { onConflict: 'arac_tip_id' });
    if (error) throw new Error(`Upsert hatası: ${error.message}`);
    process.stdout.write(`\r  ${Math.min(i + BATCH, kayitlar.length)}/${kayitlar.length}`);
  }
  console.log('\n\nTamamlandı.');

  // İstatistik
  const skorDagilimi = { yuksek: 0, orta: 0, dusuk: 0 };
  for (const { eslesme } of sonuclar) {
    if (eslesme.eslesme_skoru >= 0.5) skorDagilimi.yuksek++;
    else if (eslesme.eslesme_skoru >= 0.35) skorDagilimi.orta++;
    else skorDagilimi.dusuk++;
  }
  console.log(`Skor dağılımı: yüksek(≥0.5)=${skorDagilimi.yuksek}, orta(0.35-0.5)=${skorDagilimi.orta}, düşük(<0.35)=${skorDagilimi.dusuk}`);
  console.log(`Eşleşmeyen arac_tipleri: ${aracTipleri.length - sonuclar.length}`);
}

main().catch(err => { console.error('Hata:', err); process.exit(1); });
