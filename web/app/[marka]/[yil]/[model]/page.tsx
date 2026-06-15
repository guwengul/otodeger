import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fromSlug } from '@/lib/utils';
import TipListesi from '@/components/TipListesi';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ marka: string; yil: string; model: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { marka, yil, model } = await params;
  return { title: `${fromSlug(marka)} ${model.toUpperCase()} ${yil} Kasko Değeri` };
}

export default async function ModelPage({ params }: Props) {
  const { marka, yil, model } = await params;
  const markaAdi = fromSlug(marka);
  const modelAdi = model.toUpperCase();
  const aracYili = parseInt(yil);
  if (isNaN(aracYili)) notFound();

  const { data: kaskoTipler } = await supabase.rpc('get_tipler_by_model', {
    p_marka: markaAdi,
    p_model: modelAdi,
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
      <Link href={`/${marka}/${yil}`} className="text-sm text-gray-500 hover:text-gray-900">← {markaAdi} {yil}</Link>
      <h1 className="text-2xl font-semibold mt-4 mb-1">{markaAdi} {modelAdi} {yil}</h1>
      <p className="text-gray-500 mb-6">{tipleVeriyle.length} tip</p>

      <TipListesi tipler={tipleVeriyle} marka={marka} yil={yil} model={model} />
    </div>
  );
}
