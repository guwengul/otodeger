'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatPara } from '@/lib/utils';

type Tip = {
  arac_tip_id: number;
  kasko_degeri: number;
  tip_adi: string;
  ozellik?: {
    motor_gucu: number | null;
    yakit_tipi: string | null;
    sanziman: string | null;
  } | null;
};

const YAKIT_TIPLERI = ['Benzin', 'Dizel', 'Elektrik', 'Hibrit', 'LPG'];
const SANZIMAN_TIPLERI = ['Manuel', 'Otomatik', 'Yarı Otomatik'];

export default function TipListesi({
  tipler,
  marka,
  yil,
  model,
}: {
  tipler: Tip[];
  marka: string;
  yil: string;
  model: string;
}) {
  const [yakit, setYakit] = useState<string | null>(null);
  const [sanziman, setSanziman] = useState<string | null>(null);

  const mevcutYakitlar = [...new Set(tipler.map(t => t.ozellik?.yakit_tipi).filter(Boolean))] as string[];
  const mevcutSanzimanlar = [...new Set(tipler.map(t => t.ozellik?.sanziman).filter(Boolean))] as string[];

  const filtrelenmis = tipler.filter(t => {
    if (yakit && t.ozellik?.yakit_tipi !== yakit) return false;
    if (sanziman && t.ozellik?.sanziman !== sanziman) return false;
    return true;
  });

  return (
    <div>
      {(mevcutYakitlar.length > 0 || mevcutSanzimanlar.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {YAKIT_TIPLERI.filter(y => mevcutYakitlar.includes(y)).map(y => (
            <button
              key={y}
              onClick={() => setYakit(yakit === y ? null : y)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                yakit === y
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 hover:border-gray-400'
              }`}
            >
              {y}
            </button>
          ))}
          {mevcutYakitlar.length > 0 && mevcutSanzimanlar.length > 0 && (
            <span className="border-l mx-1" />
          )}
          {SANZIMAN_TIPLERI.filter(s => mevcutSanzimanlar.includes(s)).map(s => (
            <button
              key={s}
              onClick={() => setSanziman(sanziman === s ? null : s)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                sanziman === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 hover:border-gray-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtrelenmis.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">Bu filtreyle eşleşen araç bulunamadı</p>
        ) : (
          filtrelenmis.map(k => (
            <Link
              key={k.arac_tip_id}
              href={`/${marka}/${yil}/${model}/${k.arac_tip_id}`}
              className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 hover:border-gray-400 transition-colors"
            >
              <div>
                <div className="text-sm font-medium">{k.tip_adi}</div>
                {k.ozellik && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[
                      k.ozellik.motor_gucu && `${k.ozellik.motor_gucu} HP`,
                      k.ozellik.yakit_tipi,
                      k.ozellik.sanziman,
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <div className="text-sm font-semibold text-gray-900 ml-4 shrink-0">
                {formatPara(k.kasko_degeri)}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
