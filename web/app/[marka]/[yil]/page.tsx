import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fromSlug } from '@/lib/utils';
import TipListesi from '@/components/TipListesi';
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

  const { data: kaskoTipler } = await supabase.rpc('get_tipler_by_marka_yil', {
    p_marka: markaAdi,
    p_yil: aracYili,
  });

  if (!kaskoTipler || kaskoTipler.length === 0) notFound();

  const tipIdler = kaskoTipler.map((t: { arac_tip_id: number }) => t.arac_tip_id);

  const { data: ozellikler } = await supabase
    .from('arac_ozellikleri')
    .select('arac_tip_id, sanziman, yakit_tipi, motor_gucu')
    .in('arac_tip_id', tipIdler);

  const ozellikMap = new Map(ozellikler?.map(o => [o.arac_tip_id, o]) ?? []);

  const tipleVeriyle = kaskoTipler.map((k: { arac_tip_id: number; tip_adi: string; kasko_degeri: number }) => ({
    arac_tip_id: k.arac_tip_id,
    kasko_degeri: k.kasko_degeri,
    tip_adi: k.tip_adi,
    ozellik: ozellikMap.get(k.arac_tip_id) ?? null,
  }));

  return (
    <div>
      <Link href={`/${marka}`} className="text-sm text-gray-500 hover:text-gray-900">← {markaAdi}</Link>
      <h1 className="text-2xl font-semibold mt-4 mb-1">{markaAdi} {yil}</h1>
      <p className="text-gray-500 mb-6">{tipleVeriyle.length} tip</p>

      <TipListesi tipler={tipleVeriyle} marka={marka} yil={yil} />
    </div>
  );
}
