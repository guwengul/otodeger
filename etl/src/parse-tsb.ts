import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

interface AracTipi {
  marka_kodu: number;
  tip_kodu: number;
  marka_adi: string;
  tip_adi: string;
}

interface KaskoDegeri {
  marka_kodu: number;
  tip_kodu: number;
  arac_yili: number;
  kasko_degeri: number;
}

interface ParseResult {
  dosya_adi: string;
  veri_yili: number;
  veri_ay: number;
  ham_json: unknown[][];
  arac_tipleri: AracTipi[];
  kasko_degerleri: KaskoDegeri[];
}

function parseAyYil(baslik: string): { veri_yili: number; veri_ay: number } {
  // "Haziran 2026" → { veri_yili: 2026, veri_ay: 6 }
  const AYLAR: Record<string, number> = {
    'Ocak': 1, 'Şubat': 2, 'Mart': 3, 'Nisan': 4,
    'Mayıs': 5, 'Haziran': 6, 'Temmuz': 7, 'Ağustos': 8,
    'Eylül': 9, 'Ekim': 10, 'Kasım': 11, 'Aralık': 12,
  };

  const parts = baslik.trim().split(' ');
  const ay = AYLAR[parts[0]];
  const yil = parseInt(parts[1]);

  if (!ay || isNaN(yil)) {
    throw new Error(`Geçersiz başlık formatı: "${baslik}"`);
  }

  return { veri_yili: yil, veri_ay: ay };
}

export function parseTSB(dosyaYolu: string): ParseResult {
  const dosyaAdi = path.basename(dosyaYolu);
  const wb = XLSX.readFile(dosyaYolu);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

  // Satır 0: "Haziran 2026"
  const { veri_yili, veri_ay } = parseAyYil(rows[0][0] as string);

  // Satır 1: header — ["Marka Kodu", "Tip Kodu", "Marka Adı", "Tip Adı", 2026, 2025, ...]
  const header = rows[1] as (string | number)[];
  const yillar = header.slice(4) as number[];

  const aracTipleriMap = new Map<string, AracTipi>();
  const kaskoDegerleri: KaskoDegeri[] = [];

  // Satır 2+: veri
  for (const row of rows.slice(2)) {
    const r = row as (number | string)[];
    const marka_kodu = r[0] as number;
    const tip_kodu = r[1] as number;
    const marka_adi = (r[2] as string)?.trim();
    const tip_adi = (r[3] as string)?.trim();

    if (!marka_kodu || !tip_kodu || !marka_adi || !tip_adi) continue;

    const key = `${marka_kodu}-${tip_kodu}`;
    if (!aracTipleriMap.has(key)) {
      aracTipleriMap.set(key, { marka_kodu, tip_kodu, marka_adi, tip_adi });
    }

    yillar.forEach((arac_yili, idx) => {
      const kasko_degeri = r[4 + idx] as number;
      if (kasko_degeri && kasko_degeri > 0) {
        kaskoDegerleri.push({ marka_kodu, tip_kodu, arac_yili, kasko_degeri });
      }
    });
  }

  return {
    dosya_adi: dosyaAdi,
    veri_yili,
    veri_ay,
    ham_json: rows as unknown[][],
    arac_tipleri: Array.from(aracTipleriMap.values()),
    kasko_degerleri: kaskoDegerleri,
  };
}

// Test
if (require.main === module) {
  const dosya = process.argv[2];
  if (!dosya) {
    console.error('Kullanım: ts-node parse-tsb.ts <dosya.xlsx>');
    process.exit(1);
  }

  const result = parseTSB(dosya);
  console.log(`Dönem: ${result.veri_ay}/${result.veri_yili}`);
  console.log(`Araç tipi sayısı: ${result.arac_tipleri.length}`);
  console.log(`Kasko değeri kaydı: ${result.kasko_degerleri.length}`);
  console.log('\nÖrnek araç tipleri (ilk 3):');
  result.arac_tipleri.slice(0, 3).forEach(a => console.log(' ', a));
  console.log('\nÖrnek kasko değerleri (ilk 5):');
  result.kasko_degerleri.slice(0, 5).forEach(k => console.log(' ', k));

  // Sonucu JSON olarak kaydet
  const ciktiYolu = dosya.replace('.xlsx', '-parsed.json');
  fs.writeFileSync(ciktiYolu, JSON.stringify(result, null, 2));
  console.log(`\nSonuç kaydedildi: ${ciktiYolu}`);
}
