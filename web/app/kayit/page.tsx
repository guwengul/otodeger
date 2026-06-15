import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Kayıt Ol' };

export default function KayitPage() {
  return (
    <div className="max-w-sm mx-auto mt-8">
      <h1 className="text-2xl font-semibold mb-1">Kayıt Ol</h1>
      <p className="text-gray-500 mb-8">Garajınızı oluşturun, araçlarınızı takip edin</p>

      <div className="rounded-lg border bg-white p-6 text-center text-sm text-gray-400">
        Yakında — auth sistemi entegre edilecek
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        Zaten hesabın var mı?{' '}
        <Link href="/giris" className="font-medium text-gray-900 hover:underline">Giriş yap</Link>
      </p>
    </div>
  );
}
