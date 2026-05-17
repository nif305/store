import { redirect } from 'next/navigation';

export default function StoreAdminRedirectPage() {
  redirect('/materials/inventory');
}
