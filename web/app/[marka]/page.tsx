import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fromSlug } from '@/lib/utils';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ marka: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { marka } = await params;
  return { title: `${fromSlug(marka)} Kasko Değerleri` };
}

export default async function MarkaPage({ params }: Props) {
  const { marka } = await params;
  const markaAdi = fromSlug(marka);

  const { data: yillarData } = await supabase.rpc('get_yillar_by_marka', { p_marka: markaAdi });

  const tekYillar: number[] = yillarData?.map((y: { arac_yili: number }) => y.arac_yili) ?? [];
  if (tekYillar.length === 0) notFound();

  return (
    <div>
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Markalar</Link>
      <h1 className="text-2xl font-semibold mt-4 mb-1">{markaAdi}</h1>
      <p className="text-gray-500 mb-8">Model yılı seçin</p>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {tekYillar.map(yil => (
          <Link
            key={yil}
            href={`/${marka}/${yil}`}
            className="rounded-lg border bg-white px-4 py-3 text-center text-sm font-medium hover:border-gray-400 transition-colors"
          >
            {yil}
          </Link>
        ))}
      </div>
    </div>
  );
}
