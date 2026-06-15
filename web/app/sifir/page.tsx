import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toSlug } from '@/lib/utils';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sıfır Araç Fiyatları',
  description: 'Türkiye\'de sıfır araç fiyat listesi — marka ve modele göre güncel liste fiyatları.',
};

export default async function SifirPage() {
  const { data } = await supabase
    .rpc('get_sifir_marka_ozet');

  const markalar = data ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Sıfır Araç Fiyatları</h1>
      <p className="text-gray-500 mb-8">Güncel liste fiyatları</p>

      <div className="flex flex-col gap-2">
        {markalar.map((m: { marka_adi: string; model_sayisi: number; versiyon_sayisi: number }) => (
          <Link
            key={m.marka_adi}
            href={`/sifir/${toSlug(m.marka_adi)}`}
            className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 hover:border-gray-400 transition-colors"
          >
            <span className="text-sm font-medium">{m.marka_adi}</span>
            <span className="text-xs text-gray-400">{m.model_sayisi} model · {m.versiyon_sayisi} versiyon</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
