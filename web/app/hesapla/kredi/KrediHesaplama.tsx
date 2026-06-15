'use client';

import { useState, useMemo } from 'react';

const KKDF_ORAN = 0.15;   // Taşıt kredisi KKDF oranı
const BSMV_ORAN = 0.05;   // BSMV oranı

const VADE_SECENEKLERI = [12, 24, 36, 48, 60];

function formatTL(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

function formatOran(n: number) {
  return n.toFixed(2).replace('.', ',') + '%';
}

export default function KrediHesaplama() {
  const [tutar, setTutar] = useState('500000');
  const [vade, setVade] = useState(36);
  const [yillikFaiz, setYillikFaiz] = useState('3.50');

  const sonuc = useMemo(() => {
    const anapara = parseFloat(tutar.replace(/\./g, '').replace(',', '.'));
    const faizOran = parseFloat(yillikFaiz.replace(',', '.'));

    if (!anapara || !faizOran || anapara < 10000 || anapara > 10000000) return null;

    // Aylık nominal faiz
    const aylikFaiz = faizOran / 100 / 12;

    // Standart anüite formülü
    const taksit = anapara * (aylikFaiz * Math.pow(1 + aylikFaiz, vade)) / (Math.pow(1 + aylikFaiz, vade) - 1);

    const toplamOdeme = taksit * vade;
    const toplamFaiz = toplamOdeme - anapara;

    // KKDF ve BSMV faiz üzerinden hesaplanır
    const kkdf = toplamFaiz * KKDF_ORAN;
    const bsmv = toplamFaiz * BSMV_ORAN;

    const toplamMaliyet = anapara + toplamFaiz + kkdf + bsmv;
    const aylikTaksitVergiDahil = toplamMaliyet / vade;

    // Yıllık maliyet oranı (YMO) tahmini
    const ymo = (toplamMaliyet / anapara - 1) / (vade / 12) * 100;

    return { taksit, aylikTaksitVergiDahil, toplamFaiz, kkdf, bsmv, toplamMaliyet, ymo };
  }, [tutar, vade, yillikFaiz]);

  return (
    <div className="w-full max-w-lg">
      {/* Girişler */}
      <div className="rounded-lg border bg-white p-6 flex flex-col gap-5 mb-4">

        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kredi Tutarı</label>
          <div className="relative mt-1.5">
            <input
              type="text"
              value={tutar}
              onChange={e => setTutar(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full rounded-lg border px-4 py-2.5 pr-10 text-sm outline-none focus:border-gray-400"
              placeholder="500000"
            />
            <span className="absolute right-3 top-2.5 text-sm text-gray-400">₺</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Min: 10.000 ₺ · Maks: 10.000.000 ₺</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Aylık Faiz Oranı</label>
            <span className="text-sm font-semibold tabular-nums">%{parseFloat(yillikFaiz).toFixed(2).replace('.', ',')}</span>
          </div>
          <input
            type="range"
            min="0.50"
            max="8.00"
            step="0.25"
            value={yillikFaiz}
            onChange={e => setYillikFaiz(e.target.value)}
            className="w-full accent-gray-900"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>%0,50</span>
            <span>%8,00</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vade</label>
          <div className="grid grid-cols-5 gap-2 mt-1.5">
            {VADE_SECENEKLERI.map(v => (
              <button
                key={v}
                onClick={() => setVade(v)}
                className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                  vade === v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                {v} ay
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sonuç */}
      {sonuc ? (
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="px-6 py-4 bg-gray-900 text-white">
            <div className="text-xs text-gray-400 mb-1">Aylık Taksit (vergi dahil)</div>
            <div className="text-3xl font-bold">{formatTL(sonuc.aylikTaksitVergiDahil)}</div>
          </div>

          <div className="divide-y">
            <div className="flex justify-between px-6 py-3">
              <span className="text-sm text-gray-500">Kredi Tutarı</span>
              <span className="text-sm font-medium">{formatTL(parseFloat(tutar.replace(/\./g, '')))}</span>
            </div>
            <div className="flex justify-between px-6 py-3">
              <span className="text-sm text-gray-500">Toplam Faiz ({formatOran(parseFloat(yillikFaiz))} · {vade} ay)</span>
              <span className="text-sm font-medium">{formatTL(sonuc.toplamFaiz)}</span>
            </div>
            <div className="flex justify-between px-6 py-3">
              <span className="text-sm text-gray-500">KKDF (%{KKDF_ORAN * 100})</span>
              <span className="text-sm font-medium">{formatTL(sonuc.kkdf)}</span>
            </div>
            <div className="flex justify-between px-6 py-3">
              <span className="text-sm text-gray-500">BSMV (%{BSMV_ORAN * 100})</span>
              <span className="text-sm font-medium">{formatTL(sonuc.bsmv)}</span>
            </div>
            <div className="flex justify-between px-6 py-4 bg-gray-50">
              <span className="text-sm font-semibold">Toplam Geri Ödeme</span>
              <span className="text-sm font-bold">{formatTL(sonuc.toplamMaliyet)}</span>
            </div>
            <div className="flex justify-between px-6 py-3">
              <span className="text-xs text-gray-400">Tahmini YMO (Yıllık Maliyet Oranı)</span>
              <span className="text-xs text-gray-400">{formatOran(sonuc.ymo)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-6 text-center text-sm text-gray-400">
          Geçerli bir tutar ve faiz oranı girin
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        * Bu hesaplama bilgi amaçlıdır. KKDF %15, BSMV %5 olarak uygulanmaktadır.
        Gerçek taksit tutarları bankadan bankaya farklılık gösterebilir.
      </p>
    </div>
  );
}
