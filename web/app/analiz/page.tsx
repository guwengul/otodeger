import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Piyasa Analizi' };

const araclar = [
  { href: '/analiz/trend', title: 'Değer Trendi', desc: 'Araç değerinin aylık değişim grafiği' },
  { href: '/analiz/segment', title: 'Segment Karşılaştırma', desc: 'Aynı segmentteki araçları karşılaştır' },
];

export default function AnalizPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Piyasa Analizi</h1>
      <p className="text-gray-500 mb-8">TSB verilerine dayalı piyasa analizleri</p>

      <div className="flex flex-col gap-3">
        {araclar.map(a => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center justify-between rounded-lg border bg-white px-4 py-4 hover:border-gray-400 transition-colors"
          >
            <div>
              <div className="text-sm font-medium">{a.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{a.desc}</div>
            </div>
            <span className="text-xs text-gray-400 border rounded-full px-2 py-0.5 shrink-0 ml-4">Yakında</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
