import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parse as parseHtml } from 'node-html-parser';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
  // "1.250.000 TL" veya "1.250.000" gibi formatları parse et
  const temiz = raw.replace(/[^\d]/g, '');
  const sayi = parseInt(temiz, 10);
  return isNaN(sayi) || sayi < 100_000 ? null : sayi;
}

function satirlariBol(baslik: string): { model: string; versiyon: string } {
  // "Corolla 1.8 Hybrid Passion" → model: "Corolla", versiyon: "1.8 Hybrid Passion"
  const parcalar = baslik.trim().split(/\s+/);
  const model = parcalar[0] ?? baslik;
  const versiyon = parcalar.slice(1).join(' ') || 'Standart';
  return { model, versiyon };
}

async function sayfaCek(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9',
      },
    });
    if (!res.ok) {
      console.warn(`  HTTP ${res.status}: ${url}`);
      return null;
    }
    return res.text();
  } catch (err) {
    console.warn(`  Fetch hatası (${url}): ${(err as Error).message}`);
    return null;
  }
}

function parseSayfa(
  html: string,
  markaAdi: string,
  url: string
): SifirFiyat[] {
  const root = parseHtml(html);
  const kayitlar: SifirFiyat[] = [];
  const simdi = new Date().toISOString();

  // Strateji 1: <table> içindeki satırları tara
  const tablolar = root.querySelectorAll('table');
  for (const tablo of tablolar) {
    const satirlar = tablo.querySelectorAll('tr');
    for (const satir of satirlar) {
      const hucreler = satir.querySelectorAll('td');
      if (hucreler.length < 2) continue;

      // Son hücre genelde fiyat
      const sonHucre = hucreler[hucreler.length - 1].text.trim();
      const fiyat = parseFiyat(sonHucre);
      if (!fiyat) continue;

      // İlk hücre araç adı
      const aracAdi = hucreler[0].text.trim();
      if (!aracAdi) continue;

      const { model, versiyon } =
        hucreler.length >= 3
          ? { model: hucreler[0].text.trim(), versiyon: hucreler[1].text.trim() || 'Standart' }
          : satirlariBol(aracAdi);

      if (!model) continue;
      kayitlar.push({ marka_adi: markaAdi, model_adi: model, versiyon, fiyat, kaynak_url: url, guncelleme_tarihi: simdi });
    }
  }

  if (kayitlar.length > 0) return kayitlar;

  // Strateji 2: yaygın CSS class'larını tara (liste formatı)
  const listeSatirlari = root.querySelectorAll(
    '.price-row, .car-row, .model-row, .fiyat-row, [class*="model"], [class*="price"], [class*="fiyat"]'
  );
  for (const el of listeSatirlari) {
    const text = el.text.trim();
    // Fiyat içeren satırı bul
    const fiyatEslesmesi = text.match(/[\d.,]{7,}/);
    if (!fiyatEslesmesi) continue;
    const fiyat = parseFiyat(fiyatEslesmesi[0]);
    if (!fiyat) continue;

    const aracAdi = text.replace(fiyatEslesmesi[0], '').replace(/TL|₺/gi, '').trim();
    if (!aracAdi) continue;
    const { model, versiyon } = satirlariBol(aracAdi);
    kayitlar.push({ marka_adi: markaAdi, model_adi: model, versiyon, fiyat, kaynak_url: url, guncelleme_tarihi: simdi });
  }

  if (kayitlar.length > 0) return kayitlar;

  // Strateji 3: metin içinde fiyat + araç adı regex taraması
  const govde = root.querySelector('main, #content, .content, article, body')?.text ?? root.text;
  const satirlar = govde.split('\n');
  let bekleyenAd: string | null = null;
  for (const satir of satirlar) {
    const temiz = satir.trim();
    if (!temiz) continue;
    const fiyat = parseFiyat(temiz);
    if (fiyat) {
      if (bekleyenAd) {
        const { model, versiyon } = satirlariBol(bekleyenAd);
        kayitlar.push({ marka_adi: markaAdi, model_adi: model, versiyon, fiyat, kaynak_url: url, guncelleme_tarihi: simdi });
        bekleyenAd = null;
      }
    } else if (temiz.length > 3 && temiz.length < 120 && !/^(TL|₺|Fiyat|Model|Versiyon|Liste)$/i.test(temiz)) {
      bekleyenAd = temiz;
    }
  }

  return kayitlar;
}

async function upsertKayitlar(kayitlar: SifirFiyat[]) {
  const BATCH = 200;
  for (let i = 0; i < kayitlar.length; i += BATCH) {
    const dilim = kayitlar.slice(i, i + BATCH);
    const { error } = await supabase
      .from('sifir_fiyatlari')
      .upsert(dilim, { onConflict: 'marka_adi,model_adi,versiyon' });
    if (error) throw new Error(`Upsert hatası: ${error.message}`);
  }
}

async function main() {
  console.log('=== Sıfır Araç Fiyat Scraper ===\n');
  let toplamKayit = 0;
  let basarisizMarka = 0;

  for (const marka of MARKALAR) {
    const url = `https://www.sifiraracal.com/${marka.slug}-fiyat-listesi`;
    process.stdout.write(`[${marka.adi}] ${url} ... `);

    const html = await sayfaCek(url);
    if (!html) {
      basarisizMarka++;
      continue;
    }

    const kayitlar = parseSayfa(html, marka.adi, url);
    if (kayitlar.length === 0) {
      console.log('veri bulunamadı');
      basarisizMarka++;
      continue;
    }

    await upsertKayitlar(kayitlar);
    console.log(`${kayitlar.length} kayıt yüklendi`);
    toplamKayit += kayitlar.length;

    // Rate limiting — siteyi boğmamak için
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\nToplam: ${toplamKayit} kayıt, ${basarisizMarka} marka başarısız`);
}

main().catch((err) => {
  console.error('Kritik hata:', err);
  process.exit(1);
});
