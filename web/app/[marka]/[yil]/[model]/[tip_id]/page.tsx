import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fromSlug, formatPara } from '@/lib/utils';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ marka: string; yil: string; model: string; tip_id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tip_id, yil } = await params;
  const { data: tip } = await supabase.from('arac_tipleri').select('tip_adi, marka_adi').eq('id', parseInt(tip_id)).single();
  if (!tip) return { title: 'Araç Bulunamadı' };
  return { title: `${tip.marka_adi} ${tip.tip_adi} ${yil} Kasko Değeri` };
}

export default async function TipPage({ params }: Props) {
  const { marka, yil, model, tip_id } = await params;
  const aracYili = parseInt(yil);
  const tipId = parseInt(tip_id);
  if (isNaN(aracYili) || isNaN(tipId)) notFound();

  const [{ data: tip }, { data: kasko }, { data: ozellik }, { data: donanim }] = await Promise.all([
    supabase.from('arac_tipleri').select('*').eq('id', tipId).single(),
    supabase.from('kasko_degerleri').select('kasko_degeri, veri_yili, veri_ay').eq('arac_tip_id', tipId).eq('arac_yili', aracYili).order('veri_yili', { ascending: false }).order('veri_ay', { ascending: false }).limit(1).single(),
    supabase.from('arac_ozellikleri').select('*').eq('arac_tip_id', tipId).single(),
    supabase.from('arac_donanim').select('donanim_listesi').eq('arac_tip_id', tipId).single(),
  ]);

  if (!tip || !kasko) notFound();

  return (
    <div>
      <Link href={`/${marka}/${yil}/${model}`} className="text-sm text-gray-500 hover:text-gray-900">← Geri</Link>

      <h1 className="text-2xl font-semibold mt-4">{tip.marka_adi} {tip.tip_adi}</h1>
      <p className="text-gray-500 mt-1 mb-8">{aracYili} Model Yılı</p>

      <div className="rounded-lg border bg-white p-6 mb-4">
        <div className="text-sm text-gray-500 mb-1">TSB Kasko Değeri</div>
        <div className="text-3xl font-bold">{formatPara(kasko.kasko_degeri)}</div>
        <div className="text-xs text-gray-400 mt-2">Kaynak: TSB {kasko.veri_ay}/{kasko.veri_yili}</div>
      </div>

      {ozellik && (
        <div className="rounded-lg border bg-white p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Teknik Özellikler</h2>
          <dl className="grid grid-cols-2 gap-3">
            {[
              ['Motor Hacmi', ozellik.motor_hacmi && `${ozellik.motor_hacmi} cc`],
              ['Motor Gücü', ozellik.motor_gucu && `${ozellik.motor_gucu} HP`],
              ['Yakıt', ozellik.yakit_tipi],
              ['Şanzıman', ozellik.sanziman],
              ['Kasa Tipi', ozellik.kasa_tipi],
              ['Segment', ozellik.segment],
              ['Koltuk', ozellik.koltuk_sayisi],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="text-sm font-medium mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {donanim?.donanim_listesi && (
        <div className="rounded-lg border bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Standart Donanım</h2>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {donanim.donanim_listesi.map((item: string) => (
              <li key={item} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-gray-300 mt-0.5">—</span>{item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
