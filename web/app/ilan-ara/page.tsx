'use client';

import { useState } from 'react';

interface IlanData {
  url: string;
  baslik: string | null;
  fiyat: number | null;
  ilanNo: string | null;
  marka: string | null;
  model: string | null;
  varyant: string | null;
  yil: string | null;
  km: number | null;
  yakit: string | null;
  vites: string | null;
  kasaTipi: string | null;
  motorHacmi: string | null;
  motorGucu: string | null;
  renk: string | null;
  hasar: string | null;
  kimden: string | null;
  satici: string | null;
  aciklama: string | null;
  resimler: string[];
  ozellikler: Record<string, string>;
  error?: string;
}

const ALANLAR: { key: keyof IlanData; label: string }[] = [
  { key: 'marka', label: 'Marka' },
  { key: 'model', label: 'Model' },
  { key: 'varyant', label: 'Donanım / Varyant' },
  { key: 'yil', label: 'Yıl' },
  { key: 'km', label: 'Kilometre' },
  { key: 'yakit', label: 'Yakıt' },
  { key: 'vites', label: 'Vites' },
  { key: 'kasaTipi', label: 'Kasa Tipi' },
  { key: 'motorHacmi', label: 'Motor Hacmi' },
  { key: 'motorGucu', label: 'Motor Gücü' },
  { key: 'renk', label: 'Renk' },
  { key: 'hasar', label: 'Hasar Kaydı' },
  { key: 'kimden', label: 'Kimden' },
  { key: 'satici', label: 'Satıcı' },
];

export default function IlanAraPage() {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<IlanData | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function ara() {
    if (!url.trim()) return;
    setYukleniyor(true);
    setHata(null);
    setData(null);

    try {
      const r = await fetch(`/api/scrape?url=${encodeURIComponent(url.trim())}`);
      const json = await r.json();
      if (json.error) {
        setHata(json.error);
      } else {
        setData(json);
      }
    } catch {
      setHata('Bağlantı hatası');
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">İlan Sorgula</h1>

      <div className="flex gap-2 mb-8">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ara()}
          placeholder="https://www.sahibinden.com/ilan/..."
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={ara}
          disabled={yukleniyor}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {yukleniyor ? 'Sorgulanıyor...' : 'Sorgula'}
        </button>
      </div>

      {hata && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
          {hata}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Başlık ve fiyat */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            {data.baslik && <h2 className="text-xl font-semibold text-slate-900 mb-2">{data.baslik}</h2>}
            {data.fiyat && (
              <p className="text-3xl font-bold text-indigo-600">
                {data.fiyat.toLocaleString('tr-TR')} TL
              </p>
            )}
            {data.ilanNo && <p className="text-xs text-slate-400 mt-1">İlan No: {data.ilanNo}</p>}
          </div>

          {/* Resimler */}
          {data.resimler.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {data.resimler.map((src, i) => (
                <img key={i} src={src} alt="" className="h-32 w-48 rounded-lg object-cover shrink-0 border border-slate-200" />
              ))}
            </div>
          )}

          {/* Özellikler */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Araç Özellikleri</h3>
            </div>
            <dl className="divide-y divide-slate-100">
              {ALANLAR.map(({ key, label }) => {
                const val = data[key];
                if (!val) return null;
                return (
                  <div key={key} className="flex px-6 py-3 text-sm">
                    <dt className="w-40 shrink-0 text-slate-500">{label}</dt>
                    <dd className="font-medium text-slate-900">
                      {typeof val === 'number' ? val.toLocaleString('tr-TR') : String(val)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>

          {/* Kalan ozellikler (sahibinden'den gelen ekstra alanlar) */}
          {Object.keys(data.ozellikler).length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Tüm Özellikler</h3>
              </div>
              <dl className="divide-y divide-slate-100">
                {Object.entries(data.ozellikler).map(([k, v]) => (
                  <div key={k} className="flex px-6 py-3 text-sm">
                    <dt className="w-40 shrink-0 text-slate-500">{k}</dt>
                    <dd className="font-medium text-slate-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Açıklama */}
          {data.aciklama && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Açıklama</h3>
              <p className="text-sm text-slate-600 whitespace-pre-line">{data.aciklama}</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
