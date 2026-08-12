import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SCRAPEDO_TOKEN = process.env.SCRAPEDO_TOKEN || '';

function parseIlanDetay(html: string) {
  const get = (pattern: RegExp) => {
    const m = html.match(pattern);
    return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : null;
  };

  // Başlık
  const baslik = get(/<h1[^>]*class="[^"]*classifiedDetailTitle[^"]*"[^>]*>([\s\S]*?)<\/h1>/) ||
                 get(/<h1[^>]*>([\s\S]*?)<\/h1>/);

  // Fiyat
  const fiyatRaw = get(/class="[^"]*classifiedPrice[^"]*"[^>]*>([\s\S]*?)<\//) ||
                   get(/id="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\//i);
  const fiyat = fiyatRaw ? parseInt(fiyatRaw.replace(/\./g, '').replace(/[^\d]/g, '')) || null : null;

  // classifiedInfoList — tüm key/value çiftleri
  const ozellikler: Record<string, string> = {};
  const liRegex = /<li[^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/li>/g;
  let liM;
  while ((liM = liRegex.exec(html)) !== null) {
    const key = liM[1].replace(/<[^>]+>/g, '').trim();
    const val = liM[2].replace(/<[^>]+>/g, '').trim();
    if (key && val && key.length < 50) ozellikler[key] = val;
  }

  // Resimler
  const resimler: string[] = [];
  const imgRegex = /data-src="(https?:\/\/[^"]*shbdn\.com[^"]+)"/g;
  let imgM;
  while ((imgM = imgRegex.exec(html)) !== null) {
    if (!resimler.includes(imgM[1])) resimler.push(imgM[1]);
    if (resimler.length >= 8) break;
  }

  // Satıcı
  const satici = get(/class="[^"]*classifiedUserName[^"]*"[^>]*>([\s\S]*?)<\//) ||
                 get(/class="[^"]*advertiserName[^"]*"[^>]*>([\s\S]*?)<\//);

  // Açıklama
  const aciklama = get(/class="[^"]*classifiedDescription[^"]*"[^>]*>([\s\S]*?)<\/div>/);

  // İlan no
  const ilanNo = get(/İlan No[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/) ||
                 get(/data-id="(\d+)"/);

  return {
    baslik,
    fiyat,
    ilanNo,
    satici,
    aciklama: aciklama?.slice(0, 800) ?? null,
    resimler,
    ozellikler,
    // Sık kullanılan alanlar doğrudan
    marka: ozellikler['Marka'] ?? null,
    model: ozellikler['Model'] ?? null,
    varyant: ozellikler['Donanım Paketi'] ?? ozellikler['Versiyon'] ?? ozellikler['Seri'] ?? null,
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

  if (html.includes('sahibinden.com Giriş') || (html.includes('Giriş Yap') && !html.includes('classifiedDetail'))) {
    return NextResponse.json({ error: 'sahibinden login duvarı' }, { status: 403 });
  }

  const data = parseIlanDetay(html);
  return NextResponse.json({ url, ...data });
}
