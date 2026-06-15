// Tek marka için dry-run — Supabase'e yazmaz, sadece parse sonucunu gösterir
import { parse as parseHtml } from 'node-html-parser';

const MARKA_SLUG = 'toyota'; // bunu değiştirerek test edin
const URL = `https://www.sifiraracal.com/${MARKA_SLUG}-fiyat-listesi`;

function parseFiyat(raw: string): number | null {
  const temiz = raw.replace(/[^\d]/g, '');
  const sayi = parseInt(temiz, 10);
  return isNaN(sayi) || sayi < 100_000 ? null : sayi;
}

async function main() {
  console.log(`Fetching: ${URL}\n`);
  const res = await fetch(URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36',
      'Accept-Language': 'tr-TR,tr;q=0.9',
    },
  });

  console.log(`HTTP Status: ${res.status}`);
  const html = await res.text();
  console.log(`HTML boyutu: ${html.length} karakter\n`);

  const root = parseHtml(html);

  // Tablolar
  const tablolar = root.querySelectorAll('table');
  console.log(`Tablo sayısı: ${tablolar.length}`);
  for (const [i, t] of tablolar.entries()) {
    const satirlar = t.querySelectorAll('tr');
    console.log(`  Tablo[${i}]: ${satirlar.length} satır`);
    // İlk 3 satırı göster
    satirlar.slice(0, 3).forEach((s, j) => {
      const hucreler = s.querySelectorAll('td,th').map(h => h.text.trim().slice(0, 40));
      console.log(`    Satır[${j}]:`, hucreler);
    });
  }

  // Fiyat içeren tüm text node'ları bul
  console.log('\n--- Fiyat benzeri değerler (ilk 20) ---');
  const tumMetin = root.text;
  const satirlar2 = tumMetin.split('\n').map(s => s.trim()).filter(Boolean);
  let bulunan = 0;
  for (const satir of satirlar2) {
    const f = parseFiyat(satir);
    if (f && f > 500_000) {
      console.log(`  "${satir}" → ${f.toLocaleString('tr-TR')} TL`);
      if (++bulunan >= 20) break;
    }
  }

  // Yaygın class'lar
  console.log('\n--- CSS class örnekleri (fiyat/model içeren) ---');
  const tumElemanlar = root.querySelectorAll('[class]');
  const ilgiliClass = new Set<string>();
  for (const el of tumElemanlar) {
    const cls = el.getAttribute('class') ?? '';
    if (/price|fiyat|model|car|ara[cç]/i.test(cls)) {
      ilgiliClass.add(cls);
    }
  }
  console.log([...ilgiliClass].slice(0, 15).join('\n') || '  (bulunamadı)');
}

main().catch(console.error);
