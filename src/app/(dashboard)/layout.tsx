'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';

const LEGACY_REDIRECTS: Record<string, string> = {
  '/dashboard': '/materials/dashboard',
  '/index': '/materials/dashboard',
  '/requests': '/materials/requests',
  '/inventory': '/materials/inventory',
  '/returns': '/materials/returns',
  '/custody': '/materials/custody',
  '/messages': '/materials/messages',
  '/reports': '/materials/reports',
  '/users': '/materials/users',
  '/archive': '/materials/archive',
  '/audit-logs': '/materials/audit-logs',
  '/notifications': '/materials/notifications',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useI18n();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    const target = LEGACY_REDIRECTS[pathname || ''];
    if (target) {
      router.replace(target);
    }
  }, [loading, pathname, router, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7f7]">
        <div className="rounded-3xl border border-[#dde6e4] bg-white px-8 py-6 text-center shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
          {language === 'en' ? 'Preparing workspace...' : 'جاري تجهيز بيئة العمل...'}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
