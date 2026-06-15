import * as fs from 'fs';
import * as path from 'path';
import { parseTSB } from './parse-tsb';

function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (v: string | number | null) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
}

const dosya = process.argv[2];
if (!dosya) {
  console.error('Kullanım: ts-node export-csv.ts <dosya.xlsx>');
  process.exit(1);
}

const result = parseTSB(dosya);
const base = path.basename(dosya, '.xlsx');

// arac_tipleri.csv
const aracCsv = toCsv(
  ['marka_kodu', 'tip_kodu', 'marka_adi', 'tip_adi'],
  result.arac_tipleri.map(a => [a.marka_kodu, a.tip_kodu, a.marka_adi, a.tip_adi])
);
fs.writeFileSync(`${base}-arac_tipleri.csv`, aracCsv);
console.log(`${base}-arac_tipleri.csv yazıldı (${result.arac_tipleri.length} satır)`);

// kasko_degerleri.csv (tip_kodu ile, join sonrası ID eklenecek)
const kaskoCsv = toCsv(
  ['marka_kodu', 'tip_kodu', 'arac_yili', 'kasko_degeri', 'veri_yili', 'veri_ay'],
  result.kasko_degerleri.map(k => [
    k.marka_kodu, k.tip_kodu, k.arac_yili, k.kasko_degeri,
    result.veri_yili, result.veri_ay
  ])
);
fs.writeFileSync(`${base}-kasko_degerleri.csv`, kaskoCsv);
console.log(`${base}-kasko_degerleri.csv yazıldı (${result.kasko_degerleri.length} satır)`);
