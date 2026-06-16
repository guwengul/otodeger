'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { toSlug } from '@/lib/utils';

function normalize(s: string) {
  return s.toUpperCase().replace(/[AEIİOUÖÜ\s]/g, '');
}

function isMatch(query: string, target: string) {
  const q = query.toUpperCase().trim();
  const t = target.toUpperCase();
  if (t.includes(q)) return true;
  const qn = normalize(query);
  const tn = normalize(target);
  return qn.length > 0 && tn.includes(qn);
}

export default function ModelArama({
  modeller,
  marka,
  yil,
}: {
  modeller: string[];
  marka: string;
  yil: string;
}) {
  const [arama, setArama] = useState('');

  const gosterilen = useMemo(() => {
    if (arama.trim().length === 0) return modeller;
    return modeller.filter(m => isMatch(arama, m));
  }, [arama, modeller]);

  return (
    <div>
      <input
        type="text"
        placeholder="Model ara... (Golf, Corolla, Astra...)"
        value={arama}
        onChange={e => setArama(e.target.value)}
        className="w-full rounded-lg border bg-white px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors mb-6"
        autoFocus
      />

      {gosterilen.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Model bulunamadı</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {gosterilen.map(model => (
            <Link
              key={model}
              href={`/${marka}/${yil}/${toSlug(model)}`}
              className="rounded-lg border bg-white px-4 py-3 text-sm font-medium hover:border-gray-400 transition-colors"
            >
              {model}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
