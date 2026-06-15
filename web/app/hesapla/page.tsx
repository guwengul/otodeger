import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Hesapla' };

const araçlar = [
  { href: '/hesapla/kredi', title: 'Kredi Hesaplama', desc: 'Aylık taksit ve toplam maliyet', yakin: true },
  { href: '/hesapla/sigorta', title: 'Sigorta Teklifi', desc: 'Kasko ve trafik sigortası karşılaştırması', yakin: true },
  { href: '/hesapla/maliyet', title: 'Toplam Sahip Olma Maliyeti', desc: 'Yakıt + sigorta + bakım tahmini', yakin: true },
];

export default function HesaplaPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Hesapla</h1>
      <p className="text-gray-500 mb-8">Araçla ilgili tüm hesaplamalar</p>

      <div className="flex flex-col gap-3">
        {araçlar.map(a => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center justify-between rounded-lg border bg-white px-4 py-4 hover:border-gray-400 transition-colors"
          >
            <div>
              <div className="text-sm font-medium">{a.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{a.desc}</div>
            </div>
            {a.yakin && (
              <span className="text-xs text-gray-400 border rounded-full px-2 py-0.5 shrink-0 ml-4">Yakında</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
