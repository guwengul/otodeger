/**
 * TEFAS → Supabase uploader
 * tefas-data/ klasöründeki tüm JSON dosyalarını tefas_fon_verileri tablosuna yükler.
 * Resume edilebilir: zaten yüklenmiş dosyaları atlar (uploaded.json takibi).
 *
 * Kullanım:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node upload-tefas-supabase.js
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hfopgoxtrxlsovlvefwi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY env var eksik');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, '..', 'tefas-data');
const STATE_FILE = path.join(DATA_DIR, 'uploaded.json');
const BATCH_SIZE = 1000;
const DELAY_MS = 200;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadState() {
  if (fs.existsSync(STATE_FILE)) return new Set(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
  return new Set();
}

function saveState(uploaded) {
  fs.writeFileSync(STATE_FILE, JSON.stringify([...uploaded]));
}

// fonTipi'ni dosya adından çıkar: tefas-yat-202601.json → YAT
function parseDosyaAdi(name) {
  const m = name.match(/^tefas-([a-z]+)-(\d{6})\.json$/);
  if (!m) return null;
  return { fonTipi: m[1].toUpperCase(), label: m[2] };
}

async function upsertBatch(rows) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/tefas_fon_verileri`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Supabase hata: ${r.status} ${err.slice(0, 200)}`);
  }
}

(async () => {
  const uploaded = loadState();
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && f !== 'uploaded.json')
    .sort();

  console.log(`\nTEFAS → Supabase Uploader`);
  console.log(`${files.length} dosya bulundu, ${uploaded.size} zaten yüklendi\n`);

  let dosyaTamamlanan = 0;
  const baslangic = Date.now();

  for (const file of files) {
    if (uploaded.has(file)) {
      console.log(`[${file}] Atlandı`);
      dosyaTamamlanan++;
      continue;
    }

    const parsed = parseDosyaAdi(file);
    if (!parsed) { console.log(`[${file}] Tanınmayan format, atlandı`); continue; }

    const { fonTipi } = parsed;
    const records = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));

    if (records.length === 0) {
      uploaded.add(file);
      saveState(uploaded);
      dosyaTamamlanan++;
      continue;
    }

    // fonTipi ekle + alan adlarını normalize et
    const rows = records.map(r => ({
      tarih: r.tarih,
      fonTipi,
      fonKodu: r.fonKodu,
      fonUnvan: r.fonUnvan,
      fiyat: r.fiyat,
      tedPaySayisi: r.tedPaySayisi,
      kisiSayisi: r.kisiSayisi,
      portfoyBuyukluk: r.portfoyBuyukluk,
      borsaBultenFiyat: r.borsaBultenFiyat ?? null,
    }));

    process.stdout.write(`[${file}] ${rows.length} kayıt yükleniyor... `);
    try {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        await upsertBatch(rows.slice(i, i + BATCH_SIZE));
        await sleep(DELAY_MS);
      }
      console.log(`✓`);
      uploaded.add(file);
      saveState(uploaded);
    } catch (e) {
      console.log(`HATA: ${e.message}`);
    }

    dosyaTamamlanan++;
    const gecen = (Date.now() - baslangic) / 1000;
    const kalan = files.length - dosyaTamamlanan;
    if (kalan > 0) {
      const tahmini = ((gecen / dosyaTamamlanan) * kalan / 60).toFixed(0);
      console.log(`  İlerleme: ${dosyaTamamlanan}/${files.length} | Tahmini kalan: ${tahmini} dk`);
    }
  }

  const sure = ((Date.now() - baslangic) / 60000).toFixed(1);
  console.log(`\nTamamlandı! Süre: ${sure} dk`);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
