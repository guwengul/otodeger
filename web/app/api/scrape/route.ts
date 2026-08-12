import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SCRAPEDO_TOKEN = process.env.SCRAPEDO_TOKEN || '';

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseIlanDetay(html: string) {
  const get = (pattern: RegExp) => {
    const m = html.match(pattern);
    return m ? stripTags(m[1]) : null;
  };

  const ozellikler: Record<string, string> = {};

  // ── arabam.com: __NEXT_DATA__ JSON blob ──────────────────────────────────
  const nextDataM = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataM) {
    try {
      const nd = JSON.parse(nextDataM[1]);
      // Geniş ilanDetay objesi genellikle props.pageProps.advert veya .listing altında
      const advert =
        nd?.props?.pageProps?.advert ||
        nd?.props?.pageProps?.listing ||
        nd?.props?.pageProps?.detail ||
        nd?.props?.pageProps;

      if (advert) {
        // Özellik listesi: advert.properties veya advert.specs veya advert.attributes
        const specs: unknown[] =
          advert.properties || advert.specs || advert.attributes || advert.details || [];
        for (const s of specs) {
          if (s && typeof s === 'object') {
            const o = s as Record<string, unknown>;
            const k = String(o.name || o.key || o.label || '').trim();
            const v = String(o.value || o.val || '').trim();
            if (k && v && k.length < 80) ozellikler[k] = v;
          }
        }
      }
    } catch { /* JSON parse hatası — devam et */ }
  }

  // ── sahibinden: <li><strong>Marka</strong><span>BMW</span></li> ──────────
  const liRegex = /<li[^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/li>/g;
  let liM;
  while ((liM = liRegex.exec(html)) !== null) {
    const key = stripTags(liM[1]);
    const val = stripTags(liM[2]);
    if (key && val && key.length < 60) ozellikler[key] = val;
  }

  // ── arabam.com: class="property-item" ile iki span/div ───────────────────
  // <div class="property-item"><span class="name">Marka</span><span class="value">Fiat</span></div>
  const propRegex = /class="[^"]*property[-_]item[^"]*"[^>]*>([\s\S]*?)<\/(?:div|li)>/g;
  let propM;
  while ((propM = propRegex.exec(html)) !== null) {
    const inner = propM[1];
    const parts = [...inner.matchAll(/<(?:span|div|b|strong)[^>]*>([\s\S]*?)<\/(?:span|div|b|strong)>/g)];
    if (parts.length >= 2) {
      const key = stripTags(parts[0][1]);
      const val = stripTags(parts[1][1]);
      if (key && val && key.length < 60) ozellikler[key] = val;
    }
  }

  // ── arabam.com: <tr><th>...</th><td>...</td></tr> ────────────────────────
  const trRegex = /<tr[^>]*>[\s\S]*?<th[^>]*>([\s\S]*?)<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/g;
  let trM;
  while ((trM = trRegex.exec(html)) !== null) {
    const key = stripTags(trM[1]);
    const val = stripTags(trM[2]);
    if (key && val && key.length < 60) ozellikler[key] = val;
  }

  // ── dt/dd ─────────────────────────────────────────────────────────────────
  const dtRegex = /<dt[^>]*>([\s\S]*?)<\/dt>[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/g;
  let dtM;
  while ((dtM = dtRegex.exec(html)) !== null) {
    const key = stripTags(dtM[1]);
    const val = stripTags(dtM[2]);
    if (key && val && key.length < 60) ozellikler[key] = val;
  }

  // ── Başlık ────────────────────────────────────────────────────────────────
  const baslik =
    get(/<h1[^>]*class="[^"]*classifiedDetailTitle[^"]*"[^>]*>([\s\S]*?)<\/h1>/) ||
    get(/<h1[^>]*class="[^"]*product-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/) ||
    get(/<h1[^>]*>([\s\S]*?)<\/h1>/);

  // ── Fiyat ─────────────────────────────────────────────────────────────────
  const fiyatRaw =
    get(/class="[^"]*classifiedPrice[^"]*"[^>]*>([\s\S]*?)<\//) ||
    get(/class="[^"]*price-container[^"]*"[^>]*>([\s\S]*?)<\//) ||
    get(/class="[^"]*product-price[^"]*"[^>]*>([\s\S]*?)<\//) ||
    get(/id="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\//i);
  const fiyat = fiyatRaw ? parseInt(fiyatRaw.replace(/\./g, '').replace(/[^\d]/g, '')) || null : null;

  // ── İlan no ───────────────────────────────────────────────────────────────
  const ilanNo =
    get(/İlan No[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/) ||
    get(/data-id="(\d+)"/) ||
    get(/İlan Numarası[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/);

  // ── Satıcı ────────────────────────────────────────────────────────────────
  const satici =
    get(/class="[^"]*classifiedUserName[^"]*"[^>]*>([\s\S]*?)<\//) ||
    get(/class="[^"]*advertiserName[^"]*"[^>]*>([\s\S]*?)<\//) ||
    get(/class="[^"]*seller[-_]name[^"]*"[^>]*>([\s\S]*?)<\//);

  // ── Açıklama ──────────────────────────────────────────────────────────────
  const aciklama =
    get(/class="[^"]*classifiedDescription[^"]*"[^>]*>([\s\S]*?)<\/div>/) ||
    get(/class="[^"]*product-description[^"]*"[^>]*>([\s\S]*?)<\/div>/);

  // ── Resimler ──────────────────────────────────────────────────────────────
  const resimler: string[] = [];
  // sahibinden CDN
  const imgRegex1 = /data-src="(https?:\/\/[^"]*shbdn\.com[^"]+)"/g;
  // arabam.com CDN (genellikle arabam.com veya galeri CDN)
  const imgRegex2 = /"(https?:\/\/[^"]*\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"(?=[^>]*(?:data-src|src|href))/gi;
  let imgM;
  while ((imgM = imgRegex1.exec(html)) !== null) {
    if (!resimler.includes(imgM[1])) resimler.push(imgM[1]);
    if (resimler.length >= 8) break;
  }
  if (resimler.length === 0) {
    while ((imgM = imgRegex2.exec(html)) !== null) {
      const u = imgM[1];
      if (!resimler.includes(u) && !u.includes('logo') && !u.includes('icon')) resimler.push(u);
      if (resimler.length >= 8) break;
    }
  }

  // ── Normalize ozellik anahtarları (arabam.com Türkçe field adları) ────────
  const normalize: Record<string, string> = {
    'Marka': 'Marka', 'Model': 'Model', 'Seri': 'Varyant',
    'Yıl': 'Yıl', 'Kilometre': 'Kilometre',
    'Yakıt Tipi': 'Yakıt Tipi', 'Vites Tipi': 'Vites Tipi',
    'Kasa Tipi': 'Kasa Tipi', 'Motor Hacmi': 'Motor Hacmi',
    'Motor Gücü': 'Motor Gücü', 'Renk': 'Renk',
    'Hasar Kaydı': 'Hasar Kaydı', 'Kimden': 'Kimden',
    'Donanım': 'Donanım Paketi', 'Donanım Paketi': 'Donanım Paketi',
    'Versiyon': 'Donanım Paketi',
  };
  for (const [from, to] of Object.entries(normalize)) {
    if (ozellikler[from] && from !== to) {
      ozellikler[to] = ozellikler[to] || ozellikler[from];
      if (from !== to) delete ozellikler[from];
    }
  }

  return {
    baslik,
    fiyat,
    ilanNo,
    satici,
    aciklama: aciklama?.slice(0, 800) ?? null,
    resimler,
    ozellikler,
    marka: ozellikler['Marka'] ?? null,
    model: ozellikler['Model'] ?? null,
    varyant: ozellikler['Donanım Paketi'] ?? ozellikler['Seri'] ?? null,
    yil: ozellikler['Yıl'] ?? null,
    km: ozellikler['Kilometre'] ? parseInt(ozellikler['Kilometre'].replace(/\./g, '')) || null : null,
    yakit: ozellikler['Yakıt Tipi'] ?? null,
    vites: ozellikler['Vites Tipi'] ?? null,
    kasaTipi: ozellikler['Kasa Tipi'] ?? null,
    motorHacmi: ozellikler['Motor Hacmi'] ?? null,
    motorGucu: ozellikler['Motor Gücü'] ?? null,
    renk: ozellikler['Renk'] ?? null,
    hasar: ozellikler['Hasar Kaydı'] ?? null,
    kimden: ozellikler['Kimden'] ?? null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'url parametresi gerekli' }, { status: 400 });
  }

  if (!SCRAPEDO_TOKEN) {
    return NextResponse.json({ error: 'SCRAPEDO_TOKEN env eksik' }, { status: 500 });
  }

  const params = new URLSearchParams({
    token: SCRAPEDO_TOKEN,
    url,
    geoCode: 'tr',
  });

  let html: string;
  try {
    const r = await fetch(`https://api.scrape.do/?${params}`, {
      signal: AbortSignal.timeout(25000),
    });

    if (!r.ok) {
      const errText = await r.text();
      return NextResponse.json({ error: `scrape.do: HTTP ${r.status}`, detail: errText.slice(0, 200) }, { status: 502 });
    }

    html = await r.text();
  } catch (e: unknown) {
    return NextResponse.json({ error: `Fetch hatası: ${e instanceof Error ? e.message : e}` }, { status: 502 });
  }

  if (html.includes('sahibinden.com Giriş') || html.includes('secure.sahibinden.com/giris')) {
    return NextResponse.json({ error: 'sahibinden login duvarı' }, { status: 403 });
  }

  // ?debug=1 ile ham HTML snippet döner
  if (searchParams.get('debug') === '1') {
    const nextDataM = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    return NextResponse.json({
      hasNextData: !!nextDataM,
      nextDataSnippet: nextDataM ? nextDataM[1].slice(0, 3000) : null,
      htmlSnippet: html.slice(0, 3000),
      htmlLength: html.length,
    });
  }

  const data = parseIlanDetay(html);
  return NextResponse.json({ url, ...data });
}
