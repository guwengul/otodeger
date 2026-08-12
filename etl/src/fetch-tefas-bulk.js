/**
 * TEFAS Bulk Historical Fetcher
 * fonGnlBlgSiraliGetirDosya: tek istekte tüm ayın verisi
 * 2021-06 → bugün, ay ay çeker. Resume edilebilir.
 * Fon tipleri: YAT (yatırım), EMK (emeklilik), BYF (borsa yatırım fonu)
 *
 * Kullanım:
 *   node fetch-tefas-bulk.js            → tüm tipler
 *   TEFAS_TOKEN=xxx node fetch-tefas-bulk.js
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TEFAS_TOKEN || 'ST-tefaswebwse3irfmSBj4iRAzGPbAlS94Se';
const COOKIE = process.env.TEFAS_COOKIE || 'xidaaaaaaaaaaaaaaaa_session_=CLLAHHEIDNAEKFDABFDLEJNMPFENNHINGMEOKMBKOFPHAPMCGPCHICBIJHAJHHFANLKDPFDCDCPGDOFFKKOAGGAGMEAPIPFHGANANOKLEJDEIPNHLJJELKMFCNPJFEBB; tefas.clientDeviceId=d4cb6387-cec3-4621-a812-f8e1207d5afe.ityz9gWgzwq2OIy2MlDUQi0PP4-MGQKdv2cW3sPUo1k; NEXT_LOCALE=tr';

const OUTPUT_DIR = path.join(__dirname, '..', 'tefas-data');
const DELAY_MS = 10000;  // istekler arası bekleme
const BURST_EVERY = 5;   // kaç istekte bir uzun mola
const BURST_PAUSE = 45000; // uzun mola süresi (ms)

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchMonth(basTarih, bitTarih, fonTipi = 'YAT', retry = 0) {
  const r = await fetch('https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetirDosya', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
      'Cookie': COOKIE,
      'Origin': 'https://www.tefas.gov.tr',
      'Referer': 'https://www.tefas.gov.tr/tr/fon-verileri',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: JSON.stringify({ dil:'TR', fonTipi, fonKod:null, fonGrup:null, basTarih, bitTarih, fonTurKod:null, fonUnvanTip:null, kurucuKod:null, fonTurAciklama:null, sfonTurKod:null }),
  });

  if (r.status === 429) {
    if (retry >= 8) throw new Error('HTTP 429: max retry');
    const wait = 30000 * (retry + 1);
    console.log(`  [429] ${wait/1000}s bekleniyor (retry ${retry+1})...`);
    await sleep(wait);
    return fetchMonth(basTarih, bitTarih, fonTipi, retry + 1);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();

  if (data.errorCode === 'ERR-224') {
    if (retry >= 5) throw new Error('ERR-224: max retry');
    const wait = 15000 * (retry + 1);
    console.log(`  [THROTTLE] ${wait/1000}s bekleniyor...`);
    await sleep(wait);
    return fetchMonth(basTarih, bitTarih, fonTipi, retry + 1);
  }

  return data.resultList || [];
}

function monthList(from, to) {
  const months = [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const ms = String(m).padStart(2, '0');
    const lastDay = new Date(y, m, 0).getDate();
    months.push({ label: `${y}${ms}`, basTarih: `${y}${ms}01`, bitTarih: `${y}${ms}${lastDay}` });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

const FON_TIPLERI = ['YAT', 'EMK', 'BYF'];

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const now = new Date();
  const toMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const months = monthList('2021-06', toMonth);

  const tumKombinasyonlar = FON_TIPLERI.flatMap(tip => months.map(m => ({ ...m, tip })));

  console.log(`\nTEFAS Bulk Fetcher — fonGnlBlgSiraliGetirDosya`);
  console.log(`Toplam: ${months.length} ay × ${FON_TIPLERI.length} tip = ${tumKombinasyonlar.length} istek\n`);

  let tamamlanan = 0;
  const baslangic = Date.now();

  for (const { label, basTarih, bitTarih, tip } of tumKombinasyonlar) {
    const dosya = path.join(OUTPUT_DIR, `tefas-${tip.toLowerCase()}-${label}.json`);

    if (fs.existsSync(dosya)) {
      const size = fs.statSync(dosya).size;
      console.log(`[${label}] Atlandı (${(size/1024/1024).toFixed(1)} MB)`);
      tamamlanan++;
      continue;
    }

    process.stdout.write(`[${tip} ${label}] Çekiliyor... `);
    try {
      const records = await fetchMonth(basTarih, bitTarih, tip);

      if (records.length === 0) {
        console.log(`boş, atlandı`);
      } else {
        fs.writeFileSync(dosya, JSON.stringify(records));
        const mb = (fs.statSync(dosya).size / 1024 / 1024).toFixed(1);
        console.log(`✓ ${records.length} kayıt (${mb} MB)`);
      }

      tamamlanan++;
      const gecen = (Date.now() - baslangic) / 1000;
      const kalan = tumKombinasyonlar.length - tamamlanan;
      if (kalan > 0) {
        const tahmini = ((gecen / tamamlanan) * kalan / 60).toFixed(0);
        console.log(`  İlerleme: ${tamamlanan}/${tumKombinasyonlar.length} | Tahmini kalan: ${tahmini} dk`);
      }

      if (kalan > 0) {
        if (tamamlanan % BURST_EVERY === 0) {
          console.log(`  [MOLA] ${BURST_PAUSE/1000}s dinleniyor...`);
          await sleep(BURST_PAUSE);
        } else {
          await sleep(DELAY_MS);
        }
      }
    } catch (e) {
      console.log(`[${tip} ${label}] HATA: ${e.message}`);
      console.log(`  15s bekleniyor...`);
      await sleep(15000);
    }
  }

  const sure = ((Date.now() - baslangic) / 60000).toFixed(1);
  console.log(`\nTamamlandı! Süre: ${sure} dk`);
  console.log(`Dosyalar: ${OUTPUT_DIR}`);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
