import { redirect } from 'next/navigation';

export default function LegacyIndexPage() {
  redirect('/materials/dashboard');
}
