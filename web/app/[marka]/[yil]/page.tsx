import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fromSlug, toSlug } from '@/lib/utils';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ marka: string; yil: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { marka, yil } = await params;
  return { title: `${fromSlug(marka)} ${yil} Kasko Değerleri` };
}

export default async function YilPage({ params }: Props) {
  const { marka, yil } = await params;
  const markaAdi = fromSlug(marka);
  const aracYili = parseInt(yil);
  if (isNaN(aracYili)) notFound();

  const { data: tipler } = await supabase
    .from('arac_tipleri')
    .select('id, tip_adi')
    .eq('marka_adi', markaAdi);

  if (!tipler || tipler.length === 0) notFound();

  const { data: kaskoTipler } = await supabase
    .from('kasko_degerleri')
    .select('arac_tip_id')
    .in('arac_tip_id', tipler.map(t => t.id))
    .eq('arac_yili', aracYili);

  if (!kaskoTipler || kaskoTipler.length === 0) notFound();

  const mevcutTipIdler = new Set(kaskoTipler.map(k => k.arac_tip_id));
  const modeller = [...new Set(
    tipler.filter(t => mevcutTipIdler.has(t.id)).map(t => t.tip_adi.split(' ')[0])
  )].sort();

  return (
    <div>
      <Link href={`/${marka}`} className="text-sm text-gray-500 hover:text-gray-900">← {markaAdi}</Link>
      <h1 className="text-2xl font-semibold mt-4 mb-1">{markaAdi} {yil}</h1>
      <p className="text-gray-500 mb-8">Model seçin</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {modeller.map(model => (
          <Link
            key={model}
            href={`/${marka}/${yil}/${toSlug(model)}`}
            className="rounded-lg border bg-white px-4 py-3 text-sm font-medium hover:border-gray-400 transition-colors"
          >
            {model}
          </Link>
        ))}
      </div>
    </div>
  );
}
