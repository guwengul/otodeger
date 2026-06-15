import Link from 'next/link';

const navLinks = [
  { href: '/', label: 'Sorgula' },
  { href: '/garajim', label: 'Garajım' },
  { href: '/hesapla', label: 'Hesapla' },
  { href: '/analiz', label: 'Analiz' },
];

export default function Header() {
  return (
    <header className="border-b bg-white sticky top-0 z-10">
      <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">OtoDeger</Link>
        <nav className="flex items-center gap-6">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/giris"
            className="text-sm font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Giriş Yap
          </Link>
        </nav>
      </div>
    </header>
  );
}
