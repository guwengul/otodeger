'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toSlug } from '@/lib/utils';

const POPULER_MARKALAR = [
  'TOYOTA', 'VOLKSWAGEN', 'RENAULT', 'FORD', 'HYUNDAI',
  'FIAT', 'OPEL', 'BMW', 'MERCEDES', 'KIA',
  'DACIA', 'PEUGEOT', 'SKODA', 'NISSAN', 'HONDA',
];

export default function MarkaArama({ markalar }: { markalar: string[] }) {
  const [arama, setArama] = useState('');

  const filtrelenmis = arama.length > 0
    ? markalar.filter(m => m.toLowerCase().includes(arama.toLowerCase()))
    : [];

  return (
    <div>
      <input
        type="text"
        placeholder="Marka ara... (Toyota, BMW, Renault...)"
        value={arama}
        onChange={e => setArama(e.target.value)}
        className="w-full rounded-lg border bg-white px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
        autoFocus
      />

      {arama.length > 0 ? (
        <div className="mt-3">
          {filtrelenmis.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Marka bulunamadı</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filtrelenmis.map(marka => (
                <Link
                  key={marka}
                  href={`/${toSlug(marka)}`}
                  className="rounded-lg border bg-white px-4 py-3 text-sm font-medium hover:border-gray-400 transition-colors"
                >
                  {marka}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-8">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Popüler Markalar</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {POPULER_MARKALAR.filter(m => markalar.includes(m)).map(marka => (
              <Link
                key={marka}
                href={`/${toSlug(marka)}`}
                className="rounded-lg border bg-white px-4 py-3 text-sm font-medium hover:border-gray-400 transition-colors"
              >
                {marka}
              </Link>
            ))}
          </div>
          <details className="mt-6">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-900 select-none">
              Tüm markalar ({markalar.length})
            </summary>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 mt-3">
              {markalar.map(marka => (
                <Link
                  key={marka}
                  href={`/${toSlug(marka)}`}
                  className="rounded-lg border bg-white px-4 py-3 text-sm font-medium hover:border-gray-400 transition-colors"
                >
                  {marka}
                </Link>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
