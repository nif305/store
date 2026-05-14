'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/hooks/useI18n';
import {
  type AppRole,
  type WorkspaceKey,
  getWorkspaceGroups,
  getWorkspaceTitle,
} from '@/lib/workspace';
import { cn } from '@/lib/utils/cn';

const ICONS: Record<string, string> = {
  '/materials/dashboard': 'D',
  '/materials/requests': 'R',
  '/materials/inventory': 'I',
  '/materials/returns': 'B',
  '/materials/custody': 'C',
  '/materials/messages': 'M',
  '/materials/users': 'U',
  '/materials/reports': 'P',
  '/materials/archive': 'A',
  '/materials/audit-logs': 'L',
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceSidebar({ workspace, role }: { workspace: WorkspaceKey; role: AppRole }) {
  const pathname = usePathname();
  const { t, language } = useI18n();
  const groups = getWorkspaceGroups(workspace, role, language);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-b border-[#dce6e3] bg-white lg:min-h-screen lg:w-[300px] lg:border-b-0 lg:border-r">
      <div className="shrink-0 border-b border-[#dce6e3] px-5 py-5">
        <div className="rounded-[24px] border border-[#e0e8e6] bg-[linear-gradient(135deg,#fff_0%,#fafcfb_100%)] p-4">
          <img src="/nauss-gold-logo.png" alt={t('portal.naussLogoAlt')} className="h-16 w-auto object-contain" />
          <div className="mt-3 text-[11px] text-[#94a3a3]">{getWorkspaceTitle(workspace, language)}</div>
          <div className="mt-1 text-[18px] font-bold text-[#1f3637]">{t('common.agency')}</div>
        </div>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        aria-label={language === 'en' ? 'Workspace navigation' : 'تنقل مساحة العمل'}
      >
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="mb-2 px-1 text-[11px] font-semibold tracking-wide text-[#9aa7a6]">{group.title}</div>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex items-center gap-3 rounded-[18px] border px-4 py-3 transition',
                        active
                          ? 'border-[#2A6364]/18 bg-[#2A6364] text-white shadow-[0_16px_36px_-28px_rgba(42,99,100,0.8)]'
                          : 'border-[#e2ebea] bg-white text-[#264243] hover:border-[#cfe0dc] hover:bg-[#f8fbfb]'
                      )}
                    >
                      <span
                        className={cn('inline-flex h-10 w-10 items-center justify-center rounded-[14px] text-[16px] font-semibold', active ? 'bg-white/10 text-white' : 'bg-[#f4f8f8] text-[#2A6364]')}
                        aria-hidden="true"
                      >
                        {ICONS[item.href] || '*'}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
}
