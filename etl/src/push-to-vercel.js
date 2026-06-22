/**
 * TEFAS → Vercel → Supabase uploader
 * Local JSON dosyalarını Vercel API'ye chunk'layarak gönderir.
 * Vercel Supabase'e yazar. Resume edilebilir (uploaded.json takibi).
 *
 * Kullanım:
 *   node push-to-vercel.js
 *   VERCEL_URL=https://fonendeks.vercel.app node push-to-vercel.js
 */

const fs = require('fs');
const path = require('path');

const VERCEL_URL = process.env.VERCEL_URL || 'https://fonendeks.vercel.app';
const UPLOAD_SECRET = process.env.UPLOAD_SECRET || '';
const ENDPOINT = `${VERCEL_URL}/api/upload/tefas`;

const DATA_DIR = path.join(__dirname, '..', 'tefas-data');
const STATE_FILE = path.join(DATA_DIR, 'uploaded.json');
const CHUNK_SIZE = 500; // Vercel 60s limit için küçük chunk
const DELAY_MS = 300;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadState() {
  if (fs.existsSync(STATE_FILE)) return new Set(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
  return new Set();
}

function saveState(uploaded) {
  fs.writeFileSync(STATE_FILE, JSON.stringify([...uploaded]));
}

function parseDosyaAdi(name) {
  const m = name.match(/^tefas-([a-z]+)-(\d{6})\.json$/);
  if (!m) return null;
  return { fonTipi: m[1].toUpperCase(), label: m[2] };
}

async function sendChunk(records, fonTipi, retry = 0) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-upload-secret': UPLOAD_SECRET,
    },
    body: JSON.stringify({ records, fonTipi }),
  });
  if (r.status === 429 || r.status >= 500) {
    if (retry >= 3) throw new Error(`HTTP ${r.status}`);
    await sleep(5000 * (retry + 1));
    return sendChunk(records, fonTipi, retry + 1);
  }
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data.inserted;
}

(async () => {
  const uploaded = loadState();
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && f !== 'uploaded.json' && f !== 'test-dosya-export.bin')
    .sort();

  console.log(`\nTEFAS → Vercel (${ENDPOINT})`);
  console.log(`${files.length} dosya | ${uploaded.size} zaten yüklendi\n`);

  let done = 0;
  const start = Date.now();

  for (const file of files) {
    if (uploaded.has(file)) {
      console.log(`[${file}] Atlandı`);
      done++;
      continue;
    }

    const parsed = parseDosyaAdi(file);
    if (!parsed) { done++; continue; }
    const { fonTipi } = parsed;

    const records = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    if (records.length === 0) {
      uploaded.add(file); saveState(uploaded); done++; continue;
    }

    process.stdout.write(`[${file}] ${records.length} kayıt... `);
    let total = 0;
    let ok = true;

    try {
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        const inserted = await sendChunk(chunk, fonTipi);
        total += inserted;
        await sleep(DELAY_MS);
      }
      console.log(`✓ (${total})`);
      uploaded.add(file);
      saveState(uploaded);
    } catch (e) {
      console.log(`HATA: ${e.message}`);
      ok = false;
    }

    done++;
    const gecen = (Date.now() - start) / 1000;
    const kalan = files.length - done;
    if (kalan > 0 && ok) {
      const tahmini = ((gecen / done) * kalan / 60).toFixed(0);
      console.log(`  İlerleme: ${done}/${files.length} | Tahmini kalan: ${tahmini} dk`);
    }
  }

  const sure = ((Date.now() - start) / 60000).toFixed(1);
  console.log(`\nTamamlandı! Süre: ${sure} dk`);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
