import 'dotenv/config';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';
import { parse as parseHtml } from 'node-html-parser';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws } }
);

const MARKALAR: { adi: string; slug: string }[] = [
  { adi: 'TOYOTA', slug: 'toyota' },
  { adi: 'VOLKSWAGEN', slug: 'volkswagen' },
  { adi: 'RENAULT', slug: 'renault' },
  { adi: 'FORD', slug: 'ford' },
  { adi: 'HYUNDAI', slug: 'hyundai' },
  { adi: 'FIAT', slug: 'fiat' },
  { adi: 'OPEL', slug: 'opel' },
  { adi: 'BMW', slug: 'bmw' },
  { adi: 'MERCEDES', slug: 'mercedes-benz' },
  { adi: 'KIA', slug: 'kia' },
  { adi: 'DACIA', slug: 'dacia' },
  { adi: 'PEUGEOT', slug: 'peugeot' },
  { adi: 'SKODA', slug: 'skoda' },
  { adi: 'NISSAN', slug: 'nissan' },
  { adi: 'HONDA', slug: 'honda' },
  { adi: 'ALFA ROMEO', slug: 'alfa-romeo' },
  { adi: 'AUDI', slug: 'audi' },
  { adi: 'CITROEN', slug: 'citroen' },
  { adi: 'SEAT', slug: 'seat' },
  { adi: 'SUZUKI', slug: 'suzuki' },
  { adi: 'MITSUBISHI', slug: 'mitsubishi' },
  { adi: 'VOLVO', slug: 'volvo' },
  { adi: 'SUBARU', slug: 'subaru' },
  { adi: 'MAZDA', slug: 'mazda' },
];

interface SifirFiyat {
  marka_adi: string;
  model_adi: string;
  versiyon: string;
  fiyat: number;
  kaynak_url: string;
  guncelleme_tarihi: string;
}

function parseFiyat(raw: string): number | null {
  const temiz = raw.replace(/[^\d]/g, '');
  const sayi = parseInt(temiz, 10);
  return isNaN(sayi) || sayi < 100_000 ? null : sayi;
}

function parseSayfa(html: string, markaAdi: string, url: string): SifirFiyat[] {
  const root = parseHtml(html);
  const kayitlar: SifirFiyat[] = [];
  const simdi = new Date().toISOString();

  // Yapı: grandParent(div) → [headerDiv(h5 içerir), wFullDiv(satırlar)]
  // Satırlar: div.flex.items-center.h-[30px] — ilk div başlık (Versiyon/Güç...), gerisinde veri
  // Her veri satırı: span[0]=versiyon, span[1]=güç, span[2]=vites, span[3]=yakıt, span[4]=liste fiyatı

  const h5ler = root.querySelectorAll('h5');

  for (const h5 of h5ler) {
    const baslikMetin = h5.text.replace('Fiyat Listesi', '').trim();
    if (!baslikMetin) continue;

    // h5 → headerDiv → grandParent → wFullDiv (ikinci child)
    const headerDiv = h5.parentNode;
    const grandParent = headerDiv?.parentNode;
    if (!grandParent) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children = (grandParent.childNodes as any[]).filter((n: any) => n.tagName);
    const wFullDiv = children[1];
    if (!wFullDiv) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const satirlar = (wFullDiv as any).querySelectorAll('div');

    for (const satir of satirlar) {
      const spanlar = satir.querySelectorAll('span');
      if (spanlar.length < 5) continue;

      const versiyon = spanlar[0].text.trim();
      if (!versiyon || versiyon === 'Versiyon') continue; // başlık satırını atla

      const fiyat = parseFiyat(spanlar[4].text);
      if (!fiyat) continue;

      kayitlar.push({
        marka_adi: markaAdi,
        model_adi: baslikMetin,
        versiyon,
        fiyat,
        kaynak_url: url,
        guncelleme_tarihi: simdi,
      });
    }
  }

  return kayitlar;
}

async function sayfaCek(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
      },
    });
    if (!res.ok) { console.warn(`  HTTP ${res.status}: ${url}`); return null; }
    return res.text();
  } catch (err) {
    console.warn(`  Fetch hatası (${url}): ${(err as Error).message}`);
    return null;
  }
}

function dedupKayitlar(kayitlar: SifirFiyat[]): SifirFiyat[] {
  const goruldu = new Set<string>();
  return kayitlar.filter(k => {
    const key = `${k.marka_adi}|${k.model_adi}|${k.versiyon}`;
    if (goruldu.has(key)) return false;
    goruldu.add(key);
    return true;
  });
}

async function upsertKayitlar(kayitlar: SifirFiyat[]) {
  const BATCH = 200;
  for (let i = 0; i < kayitlar.length; i += BATCH) {
    const { error } = await supabase
      .from('sifir_fiyatlari')
      .upsert(kayitlar.slice(i, i + BATCH), { onConflict: 'marka_adi,model_adi,versiyon' });
    if (error) throw new Error(`Upsert hatası: ${error.message}`);
  }
}

async function main() {
  console.log('=== Sıfır Araç Fiyat Scraper ===\n');
  let toplamKayit = 0;
  let basarisizMarka = 0;

  for (const marka of MARKALAR) {
    const url = `https://www.sifiraracal.com/${marka.slug}-fiyat-listesi`;
    process.stdout.write(`[${marka.adi}] ... `);

    const html = await sayfaCek(url);
    if (!html) { basarisizMarka++; continue; }

    const kayitlar = parseSayfa(html, marka.adi, url);
    if (kayitlar.length === 0) {
      console.log('veri bulunamadı');
      basarisizMarka++;
      continue;
    }

    await upsertKayitlar(dedupKayitlar(kayitlar));
    console.log(`${kayitlar.length} kayıt`);
    toplamKayit += kayitlar.length;

    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\nToplam: ${toplamKayit} kayıt, ${basarisizMarka} marka başarısız`);
}

main().catch((err) => { console.error('Kritik hata:', err); process.exit(1); });
