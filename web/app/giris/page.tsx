import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Giriş Yap' };

export default function GirisPage() {
  return (
    <div className="max-w-sm mx-auto mt-8">
      <h1 className="text-2xl font-semibold mb-1">Giriş Yap</h1>
      <p className="text-gray-500 mb-8">Garajınıza ve tüm özelliklere erişin</p>

      <div className="rounded-lg border bg-white p-6 text-center text-sm text-gray-400">
        Yakında — auth sistemi entegre edilecek
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        Hesabın yok mu?{' '}
        <Link href="/kayit" className="font-medium text-gray-900 hover:underline">Kayıt ol</Link>
      </p>
    </div>
  );
}
