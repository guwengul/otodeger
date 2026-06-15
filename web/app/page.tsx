import { supabase } from '@/lib/supabase';
import { BINEK_MARKALAR } from '@/lib/markalar';
import MarkaArama from '@/components/MarkaArama';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Araç Kasko Değeri Sorgula',
  description: 'Türkiye\'de araçların TSB kasko değerlerini marka, model ve yıla göre sorgulayın.',
};

export default async function AnaSayfa() {
  const { data: markalar } = await supabase.rpc('get_distinct_markalar');

  const tekMarkalar: string[] = (markalar?.map((m: { marka_adi: string }) => m.marka_adi) ?? [])
    .filter((m: string) => BINEK_MARKALAR.includes(m))
    .sort();

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Araç Kasko Değeri Sorgula</h1>
      <p className="text-gray-500 mb-6">Markanızı seçin veya arayın</p>
      <MarkaArama markalar={tekMarkalar} />
    </div>
  );
}
