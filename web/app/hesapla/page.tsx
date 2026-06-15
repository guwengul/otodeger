import Link from 'next/link';
import type { Metadata } from 'next';
import KrediHesaplama from './kredi/KrediHesaplama';

export const metadata: Metadata = { title: 'Kredi Hesaplama' };

const diger = [
  { href: '/hesapla/sigorta', title: 'Sigorta Teklifi', desc: 'Kasko ve trafik sigortası karşılaştırması' },
  { href: '/hesapla/maliyet', title: 'Toplam Sahip Olma Maliyeti', desc: 'Yakıt + sigorta + bakım tahmini' },
];

export default function HesaplaPage() {
  return (
    <div className="flex gap-8 items-start">
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-semibold mb-1">Kredi Hesaplama</h1>
        <p className="text-gray-500 mb-8">KKDF ve BSMV dahil toplam maliyet</p>
        <KrediHesaplama />
      </div>

      <div className="w-48 shrink-0 pt-14 hidden sm:block">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Diğer Araçlar</p>
        <div className="flex flex-col gap-2">
          {diger.map(a => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-lg border bg-white px-3 py-2.5 hover:border-gray-400 transition-colors"
            >
              <div className="text-xs font-medium">{a.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{a.desc}</div>
              <span className="text-xs text-gray-300 mt-1 inline-block">Yakında</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
