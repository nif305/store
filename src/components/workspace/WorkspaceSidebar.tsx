'use client';

import React from 'react';
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

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function RequestsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

function TrainerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" />
      <path d="M6 12v5c3.5 3 8.5 3 12 0v-5" />
    </svg>
  );
}

function InventoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </svg>
  );
}

function StoreAdminIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function RoomsAdminIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-4h6v4" />
      <rect x="9" y="9" width="2" height="2" rx="0.5" />
      <rect x="13" y="9" width="2" height="2" rx="0.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  );
}

function ReturnsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 9H5V5" />
      <path d="M5 9C6.8 6.6 9 5.5 12 5.5c4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4" />
    </svg>
  );
}

function CustodyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function MessagesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-2a7 7 0 0 1 11-5.8" />
      <circle cx="17" cy="15" r="3" />
      <path d="M21 21v-1a3 3 0 0 0-5.7-1.3" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 3H8L2 7h20l-6-4z" />
      <path d="M10 12h4" />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function DefaultIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  '/materials/dashboard': <DashboardIcon />,
  '/materials/requests': <RequestsIcon />,
  '/materials/trainer-needs': <TrainerIcon />,
  '/materials/inventory': <InventoryIcon />,
  '/materials/store-admin': <StoreAdminIcon />,
  '/materials/rooms-admin': <RoomsAdminIcon />,
  '/materials/rooms-schedule': <CalendarIcon />,
  '/materials/returns': <ReturnsIcon />,
  '/materials/custody': <CustodyIcon />,
  '/materials/messages': <MessagesIcon />,
  '/materials/users': <UsersIcon />,
  '/materials/reports': <ReportsIcon />,
  '/materials/archive': <ArchiveIcon />,
  '/materials/audit-logs': <AuditIcon />,
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceSidebar({
  workspace,
  role,
  canManageTrainerNeeds = false,
}: {
  workspace: WorkspaceKey;
  role: AppRole;
  canManageTrainerNeeds?: boolean;
}) {
  const pathname = usePathname();
  const { t, language } = useI18n();
  const groups = getWorkspaceGroups(workspace, role, language, { canManageTrainerNeeds });

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
              <div className="space-y-1.5">
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
                        className={cn(
                          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] transition',
                          active ? 'bg-white/15 text-white' : 'bg-[#eef5f4] text-[#2A6364] group-hover:bg-[#e4f0ef]'
                        )}
                        aria-hidden="true"
                      >
                        {ICONS[item.href] ?? <DefaultIcon />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{item.label}</span>
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
