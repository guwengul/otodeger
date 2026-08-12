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

  const getAll = (pattern: RegExp) => {
    const results: string[] = [];
    let m;
    const re = new RegExp(pattern.source, 'g');
    while ((m = re.exec(html)) !== null) {
      results.push(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    }
    return results;
  };

  // Başlık
  const baslik = get(/<h1[^>]*class="[^"]*classifiedDetailTitle[^"]*"[^>]*>([\s\S]*?)<\/h1>/) ||
                 get(/<h1[^>]*>([\s\S]*?)<\/h1>/);

  // Fiyat
  const fiyatRaw = get(/class="[^"]*classifiedPrice[^"]*"[^>]*>([\s\S]*?)<\//) ||
                   get(/id="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\//i);
  const fiyat = fiyatRaw ? parseInt(fiyatRaw.replace(/\./g, '').replace(/[^\d]/g, '')) || null : null;

  // İlan özellikleri (classifiedInfoList içindeki li'ler)
  const ozellikler: Record<string, string> = {};
  const liPattern = /<li[^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/li>/g;
  let liM;
  while ((liM = liPattern.exec(html)) !== null) {
    const key = liM[1].replace(/<[^>]+>/g, '').trim();
    const val = liM[2].replace(/<[^>]+>/g, '').trim();
    if (key && val) ozellikler[key] = val;
  }

  // Açıklama
  const aciklama = get(/class="[^"]*classifiedDescription[^"]*"[^>]*>([\s\S]*?)<\/div>/);

  // Satıcı / İlan sahibi
  const satici = get(/class="[^"]*classifiedUserName[^"]*"[^>]*>([\s\S]*?)<\//) ||
                 get(/class="[^"]*advertiser-name[^"]*"[^>]*>([\s\S]*?)<\//);

  // Konum
  const konum = get(/class="[^"]*classifiedInfo[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//) ||
                get(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//);

  // Resimler
  const resimler = getAll(/data-src="(https:\/\/i\d\.shbdn\.com[^"]+)"/);

  // İlan tarihi
  const tarih = get(/class="[^"]*classifiedInfoList[^"]*"[\s\S]*?Tarih[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/);

  return { baslik, fiyat, ozellikler, satici, konum, tarih, resimler: resimler.slice(0, 10), aciklama: aciklama?.slice(0, 500) };
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

  const r = await fetch(`https://api.scrape.do/?${params}`, {
    signal: AbortSignal.timeout(25000),
  });

  if (!r.ok) {
    return NextResponse.json({ error: `scrape.do: HTTP ${r.status}` }, { status: 502 });
  }

  const html = await r.text();

  if (html.includes('sahibinden.com Giriş') || html.includes('Giriş Yap')) {
    return NextResponse.json({ error: 'sahibinden login duvarı — scrape.do TR IP çalışmıyor' }, { status: 403 });
  }

  const data = parseIlanDetay(html);
  return NextResponse.json({ url, ...data });
}
