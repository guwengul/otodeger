process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const TOKEN = process.env.TEFAS_TOKEN || 'ST-tefaswebwse3irfmSBj4iRAzGPbAlS94Se';
const COOKIE = process.env.TEFAS_COOKIE || 'xidaaaaaaaaaaaaaaaa_session_=CLLAHHEIDNAEKFDABFDLEJNMPFENNHINGMEOKMBKOFPHAPMCGPCHICBIJHAJHHFANLKDPFDCDCPGDOFFKKOAGGAGMEAPIPFHGANANOKLEJDEIPNHLJJELKMFCNPJFEBB; tefas.clientDeviceId=d4cb6387-cec3-4621-a812-f8e1207d5afe.ityz9gWgzwq2OIy2MlDUQi0PP4-MGQKdv2cW3sPUo1k; NEXT_LOCALE=tr; wid00000000076=08ce165641ab2800a682ee5c6ea1fd7a9803238e7ce00f2e66d07b2b3cd83e55bd351fb27fe42c694b98b399513d0cb90806a1cb0409d0004a7f1fa840156c96d9ae76b1731d34bf7c1b94014687879aa11d05b5d351e55b61ec1472d8b279be4edb03093b0b108b4c073d25a0c68938d979c816f8bc00dc596f084bbc0fa995cd8fa1af733a516458b531d3e6e008da18d2e9fd28bfdbbfa558bcb1d707b0d389c6e9c972ce6ee5855a78d89821e013d8a6ad7006b0bebadf2e4d1563f792a2e0e18e6a93aa1a6de352a1a5dae6d015397cd18fa0074f2ce8f6a8f083340a6b568b815b56dad9629c28a01938f35b0ecce8c52a89db76f30c02bfcf04b143543905271401ce0b2f';
const PAGE_SIZE = 25;
const DELAY_MS = 500;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function tefasPost(body, retry = 0) {
  const r = await fetch('https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Authorization': `Bearer ${TOKEN}`,
      'Cookie': COOKIE,
      'Origin': 'https://www.tefas.gov.tr',
      'Referer': 'https://www.tefas.gov.tr/tr/fon-verileri',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  // Throttle — bekle ve tekrar dene
  if (data.faultCode === 'ERR-224') {
    if (retry >= 5) throw new Error('Max retry aşıldı, throttle devam ediyor');
    const wait = 5000 * (retry + 1);
    process.stdout.write(`\n  [THROTTLE] ${wait/1000}s bekleniyor...\r`);
    await sleep(wait);
    return tefasPost(body, retry + 1);
  }
  return data;
}

function buildBody(tarih, basSira, bitSira) {
  return {
    fonTipi: 'YAT', fonKodu: null, aramaMetni: null, fonTurKod: null,
    fonGrubu: null, sfonTurKod: null, basTarih: tarih, bitTarih: tarih,
    basSira, bitSira, fonTurAciklama: null, dil: 'TR', kurucuKod: null,
  };
}

async function fetchDate(tarih) {
  const first = await tefasPost(buildBody(tarih, 1, PAGE_SIZE));
  if (!first.resultList?.length) {
    console.log(`[${tarih}] Veri yok: ${first.errorMessage || 'boş'}`);
    return [];
  }

  const total = first.toplamSayi;
  // API'nin gerçekte döndürdüğü kayıt sayısını baz al
  const actualPageSize = first.resultList.length;
  const pages = Math.ceil(total / actualPageSize);
  console.log(`[${tarih}] ${total} fon, ${pages} sayfa (sayfa boyutu: ${actualPageSize})`);

  const all = [...first.resultList];

  for (let start = actualPageSize + 1; start <= total; start += actualPageSize) {
    process.stdout.write(`  Sayfa ${Math.ceil(start / actualPageSize)}/${pages}...\r`);
    await sleep(DELAY_MS);
    const end = Math.min(start + actualPageSize - 1, total);
    const d = await tefasPost(buildBody(tarih, start, end));
    if (d.resultList?.length) {
      all.push(...d.resultList);
    } else {
      process.stdout.write(`\n  [UYARI] Sayfa ${Math.ceil(start / actualPageSize)}: ${d.errorMessage || JSON.stringify(d).slice(0, 80)}\n`);
    }
  }
  console.log(`  [${tarih}] Tamamlandı: ${all.length} fon     `);
  return all;
}

// Tarih aralığı üret (iş günleri)
function dateRange(from, to) {
  const dates = [];
  const d = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}${m}${dd}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// Args: node fetch-tefas.js [basTarih] [bitTarih]
// Örnek: node fetch-tefas.js 2024-01-01 2026-06-20
// Varsayılan: sadece dün
const args = process.argv.slice(2);
const from = args[0] || (() => {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10);
})();
const to = args[1] || from;

console.log(`Tarih aralığı: ${from} → ${to}`);
const dates = dateRange(from, to);
console.log(`${dates.length} iş günü`);

(async () => {
  const tumVeri = [];
  for (const tarih of dates) {
    const fonlar = await fetchDate(tarih);
    tumVeri.push(...fonlar);
    await sleep(300);
  }

  console.log(`\nToplam: ${tumVeri.length} kayıt`);

  // JSON olarak kaydet
  const fs = require('fs');
  const dosya = `tefas-${from.replace(/-/g, '')}-${to.replace(/-/g, '')}.json`;
  fs.writeFileSync(dosya, JSON.stringify(tumVeri, null, 2));
  console.log(`Kaydedildi: ${dosya}`);
})().catch(e => { console.error('Hata:', e.message); process.exit(1); });
