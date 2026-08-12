process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { parse } = require('node-html-parser');
const XLSX = require('xlsx');

const DELAY_MS = 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── FORD ─────────────────────────────────────────────────────────────────────

async function fordSayfaCek(sayfa) {
  const url = `https://www.fordikinciel.com/araba-fiyatlari${sayfa > 1 ? `?p=${sayfa}` : ''}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124.0.0.0', 'Accept-Language': 'tr-TR' },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

function fordParse(html) {
  const root = parse(html);
  const kartlar = root.querySelectorAll('.car-card');
  return kartlar.map(k => {
    const text = k.text.replace(/\s+/g, ' ').trim();
    const adMatch = text.match(/^([A-ZÇĞİÖŞÜa-zçğışöşü0-9 \-.]+?),\s*\d+Hp/);
    const ad = adMatch?.[1]?.trim() || '';
    const hp = text.match(/(\d+)Hp/)?.[1];
    const kasa = text.match(/Hp,\s*([^,\d]+?)\s+\d{4}/)?.[1]?.trim();
    const yil = text.match(/\b(19|20)\d{2}\b/)?.[0];
    const yakit = text.match(/\b(Benzin|Dizel|Elektrik|Hibrit|LPG|Hybrid)\b/i)?.[1];
    const vites = text.match(/\b(Manuel|Otomatik|Yarı Otomatik)\b/i)?.[1];
    const km = text.match(/([\d.,]+)\s*Km/i)?.[1]?.replace(/\./g, '').replace(',', '.');
    const fiyatlar = [...text.matchAll(/([\d.]+)\s*TL/g)].map(m => parseInt(m[1].replace(/\./g, '')));
    const fiyat = fiyatlar.length > 0 ? Math.max(...fiyatlar) : null;
    return { kaynak: 'fordikinciel', ad, yil: yil ? parseInt(yil) : null, kasa, yakit, vites, km: km ? parseFloat(km) : null, hp: hp ? parseInt(hp) : null, fiyat };
  }).filter(i => i.ad && i.fiyat);
}

async function fordTumIlanlar() {
  console.log('[FORD] Sayfa 1 çekiliyor...');
  const ilkHtml = await fordSayfaCek(1);
  const root = parse(ilkHtml);
  const toplamMatch = ilkHtml.match(/Toplam\s*(\d+)/);
  const toplam = toplamMatch ? parseInt(toplamMatch[1]) : 0;
  const sayfaSayisi = Math.ceil(toplam / 20);
  console.log(`[FORD] Toplam: ${toplam} ilan, ${sayfaSayisi} sayfa`);

  let tumIlanlar = fordParse(ilkHtml);

  for (let s = 2; s <= sayfaSayisi; s++) {
    process.stdout.write(`[FORD] Sayfa ${s}/${sayfaSayisi}...\r`);
    await sleep(DELAY_MS);
    const html = await fordSayfaCek(s).catch(e => { console.warn(`  Hata: ${e.message}`); return null; });
    if (!html) continue;
    tumIlanlar = tumIlanlar.concat(fordParse(html));
  }
  console.log(`\n[FORD] Tamamlandı: ${tumIlanlar.length} ilan`);
  return tumIlanlar;
}

// ── DOD ──────────────────────────────────────────────────────────────────────

const DOD_URL = 'https://gw.dod.com.tr/gw-search/SearchByFieldDodCarDetailIndex';
const DOD_HEADERS = {
  'Content-Type': 'application/json;charset=UTF-8',
  'Accept': 'application/json',
  'uiclientid': '94b1e372-58d3-4cf6-9216-57e8396029da',
  'Referer': 'https://dod.com.tr/arac-arama',
  'User-Agent': 'Mozilla/5.0 Chrome/124.0.0.0',
};

function dodBody(sayfa, sayfaBoyutu = 50) {
  return {
    categoryIds: [2, 3, 4], brands: [0, 0, 0], models: [0, 0, 0],
    modelTypeCode: [], fuelTypes: [], gearTypes: [],
    year: { minYear: 0, maxYear: 0 }, km: { minKm: 0, maxKm: 0 },
    price: { minPrice: 0, maxPrice: 0 },
    guarantyStates: [], cityCodes: [], firms: [], vehicleVarieties: [],
    vehicleEngineCapacities: [], vehicleEnginePowers: [], drivenWheels: [],
    vehicleClassess: [], vehicleTypes: [], vehicleColors: [],
    stockEntryDate: 0, condition: [], inner360: false,
    isCampaignVehicle: false, isRentable: false,
    fileNumber: '', keyword: '', currencyCode: '',
    sortingCriteria: 0, viewType: 0,
    pagination: { pageSize: sayfaBoyutu, page: sayfa },
    isQueryParam: true, hardwarelevel: [], vehicleIds: [],
  };
}

function dodParse(results) {
  return results.map(r => ({
    kaynak: 'dod',
    ad: `${r.brand} ${r.model} ${r.modelTypeCode || ''}`.trim(),
    marka: r.brand,
    model: r.model,
    versiyon: r.modelTypeCode || '',
    yil: r.year,
    km: r.km,
    yakit: r.fuelType,
    vites: r.gearType,
    renk: r.color || '',
    sehir: r.city || '',
    bayi: r.dealer || '',
    fiyat: r.price,
  }));
}

async function dodTumIlanlar() {
  const PAGE_SIZE = 50;
  console.log('[DOD] İlk sayfa çekiliyor...');
  const r0 = await fetch(DOD_URL, { method: 'POST', headers: DOD_HEADERS, body: JSON.stringify(dodBody(1, PAGE_SIZE)) });
  const d0 = await r0.json();
  const toplam = d0.data.total;
  const sayfaSayisi = Math.ceil(toplam / PAGE_SIZE);
  console.log(`[DOD] Toplam: ${toplam} ilan, ${sayfaSayisi} sayfa`);

  let tumIlanlar = dodParse(d0.data.results);

  for (let s = 2; s <= sayfaSayisi; s++) {
    process.stdout.write(`[DOD] Sayfa ${s}/${sayfaSayisi}...\r`);
    await sleep(DELAY_MS);
    const r = await fetch(DOD_URL, { method: 'POST', headers: DOD_HEADERS, body: JSON.stringify(dodBody(s, PAGE_SIZE)) }).catch(e => null);
    if (!r) continue;
    const d = await r.json();
    tumIlanlar = tumIlanlar.concat(dodParse(d.data.results || []));
  }
  console.log(`\n[DOD] Tamamlandı: ${tumIlanlar.length} ilan`);
  return tumIlanlar;
}

// ── EXCEL ─────────────────────────────────────────────────────────────────────

function excelYaz(ford, dod) {
  const wb = XLSX.utils.book_new();

  const fordSheet = XLSX.utils.json_to_sheet(ford);
  XLSX.utils.book_append_sheet(wb, fordSheet, 'Ford İkinci El');

  const dodSheet = XLSX.utils.json_to_sheet(dod);
  XLSX.utils.book_append_sheet(wb, dodSheet, 'DOD');

  const hepsi = [...ford, ...dod];
  const hepsiSheet = XLSX.utils.json_to_sheet(hepsi);
  XLSX.utils.book_append_sheet(wb, hepsiSheet, 'Tümü');

  const dosya = `ikinciel-ilanlar-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, dosya);
  console.log(`\nExcel kaydedildi: ${dosya} (${hepsi.length} toplam ilan)`);
}

// ── ANA ───────────────────────────────────────────────────────────────────────

(async () => {
  const [ford, dod] = await Promise.all([
    fordTumIlanlar(),
    dodTumIlanlar(),
  ]);
  excelYaz(ford, dod);
})().catch(e => { console.error('Kritik hata:', e); process.exit(1); });
