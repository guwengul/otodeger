import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fromSlug, formatPara } from '@/lib/utils';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ marka: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { marka } = await params;
  const markaAdi = fromSlug(marka);
  return {
    title: `${markaAdi} Sıfır Araç Fiyatları`,
    description: `${markaAdi} güncel sıfır araç liste fiyatları ve versiyon seçenekleri.`,
  };
}

export default async function SifirMarkaPage({ params }: Props) {
  const { marka } = await params;
  const markaAdi = fromSlug(marka);

  const { data } = await supabase
    .from('sifir_fiyatlari')
    .select('model_adi, versiyon, fiyat')
    .eq('marka_adi', markaAdi)
    .order('fiyat');

  if (!data || data.length === 0) notFound();

  // Modele göre grupla, min fiyata göre sırala
  const gruplar = new Map<string, { versiyon: string; fiyat: number }[]>();
  for (const row of data) {
    if (!gruplar.has(row.model_adi)) gruplar.set(row.model_adi, []);
    gruplar.get(row.model_adi)!.push({ versiyon: row.versiyon, fiyat: row.fiyat });
  }

  // Her modelin min fiyatına göre sırala (ekonomikten premium'a)
  const siraliGruplar = [...gruplar.entries()].sort(
    (a, b) => Math.min(...a[1].map(v => v.fiyat)) - Math.min(...b[1].map(v => v.fiyat))
  );

  return (
    <div>
      <Link href="/sifir" className="text-sm text-gray-500 hover:text-gray-900">← Sıfır Fiyatlar</Link>
      <h1 className="text-2xl font-semibold mt-4 mb-1">{markaAdi} Sıfır Araç Fiyatları</h1>
      <p className="text-gray-500 mb-8">{gruplar.size} model · {data.length} versiyon</p>

      <div className="flex flex-col gap-6">
        {siraliGruplar.map(([model, versiyonlar]) => (
          <div key={model} className="rounded-lg border bg-white overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="text-sm font-semibold">{model}</h2>
            </div>
            <div className="divide-y">
              {versiyonlar.map((v, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-700">{v.versiyon}</span>
                  <span className="text-sm font-semibold shrink-0 ml-4">{formatPara(v.fiyat)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
