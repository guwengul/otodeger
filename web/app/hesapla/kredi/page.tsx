import type { Metadata } from 'next';
import KrediHesaplama from './KrediHesaplama';

export const metadata: Metadata = {
  title: 'Araç Kredisi Hesaplama',
  description: 'Türkiye\'de araç kredisi taksit, KKDF ve BSMV dahil toplam maliyet hesaplama.',
};

export default function KrediPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Araç Kredisi Hesaplama</h1>
      <p className="text-gray-500 mb-8">KKDF ve BSMV dahil toplam maliyet</p>
      <KrediHesaplama />
    </div>
  );
}
