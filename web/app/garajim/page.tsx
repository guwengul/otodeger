import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Garajım' };

export default function GarajimPage() {
  redirect('/giris?sonra=/garajim');
}
