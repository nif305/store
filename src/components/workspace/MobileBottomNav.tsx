'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/hooks/useI18n';
import { type AppRole } from '@/lib/workspace';
import { cn } from '@/lib/utils/cn';

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* ── Icons ── */
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} className="h-6 w-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}
function RequestsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} />
      <path d="M14 2v6h6M9 13h6M9 17h4" />
    </svg>
  );
}
function InventoryIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </svg>
  );
}
function CustodyIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function ReturnsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 9H5V5" />
      <path d="M5 9C6.8 6.6 9 5.5 12 5.5c4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4" strokeWidth={active ? 2.4 : 1.8} />
    </svg>
  );
}
function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
      <path d="M3 21v-2a7 7 0 0 1 11-5.8" />
      <circle cx="17" cy="15" r="3" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
      <path d="M21 21v-1a3 3 0 0 0-5.7-1.3" />
    </svg>
  );
}
function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
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
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
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
      <path d="M16 3H8L2 7h20l-6-4zM10 12h4" />
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
function RoomsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-4h6v4" />
      <rect x="9" y="9" width="2" height="2" rx="0.5" />
      <rect x="13" y="9" width="2" height="2" rx="0.5" />
    </svg>
  );
}
function StoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

/* ── Nav config per role ── */
type NavItem = { href: string; label: string; icon: React.ReactNode; activeIcon: React.ReactNode };
type MoreItem = { href: string; label: string; icon: React.ReactNode };

function getNavConfig(role: AppRole, language: string, canManageTrainerNeeds: boolean): { primary: NavItem[]; more: MoreItem[] } {
  const ar = language !== 'en';

  if (role === 'user') {
    return {
      primary: [
        { href: '/materials/dashboard', label: ar ? 'الرئيسية' : 'Home', icon: <HomeIcon active={false} />, activeIcon: <HomeIcon active={true} /> },
        { href: '/materials/requests', label: ar ? 'طلباتي' : 'Requests', icon: <RequestsIcon active={false} />, activeIcon: <RequestsIcon active={true} /> },
        { href: '/materials/custody', label: ar ? 'عهودي' : 'Custody', icon: <CustodyIcon active={false} />, activeIcon: <CustodyIcon active={true} /> },
        { href: '/materials/returns', label: ar ? 'إرجاع' : 'Returns', icon: <ReturnsIcon active={false} />, activeIcon: <ReturnsIcon active={true} /> },
      ],
      more: [
        { href: '/materials/messages', label: ar ? 'الرسائل' : 'Messages', icon: <MessagesIcon /> },
        ...(canManageTrainerNeeds ? [
          { href: '/materials/trainer-needs', label: ar ? 'احتياجات المدربين' : 'Trainer Needs', icon: <TrainerIcon /> },
        ] : []),
      ],
    };
  }

  if (role === 'manager') {
    return {
      primary: [
        { href: '/materials/dashboard', label: ar ? 'الرئيسية' : 'Home', icon: <HomeIcon active={false} />, activeIcon: <HomeIcon active={true} /> },
        { href: '/materials/requests', label: ar ? 'الطلبات' : 'Requests', icon: <RequestsIcon active={false} />, activeIcon: <RequestsIcon active={true} /> },
        { href: '/materials/inventory', label: ar ? 'المخزون' : 'Inventory', icon: <InventoryIcon active={false} />, activeIcon: <InventoryIcon active={true} /> },
        { href: '/materials/users', label: ar ? 'المستخدمين' : 'Users', icon: <UsersIcon active={false} />, activeIcon: <UsersIcon active={true} /> },
      ],
      more: [
        { href: '/materials/trainer-needs', label: ar ? 'احتياجات المدربين' : 'Trainer Needs', icon: <TrainerIcon /> },
        { href: '/materials/rooms-schedule', label: ar ? 'جدول القاعات' : 'Rooms Schedule', icon: <CalendarIcon /> },
        { href: '/materials/rooms-admin', label: ar ? 'إدارة القاعات' : 'Rooms Admin', icon: <RoomsIcon /> },
        { href: '/materials/returns', label: ar ? 'الإرجاعات' : 'Returns', icon: <ReturnsIcon active={false} /> },
        { href: '/materials/messages', label: ar ? 'الرسائل' : 'Messages', icon: <MessagesIcon /> },
        { href: '/materials/reports', label: ar ? 'التقارير' : 'Reports', icon: <ReportsIcon /> },
        { href: '/materials/archive', label: ar ? 'الأرشيف' : 'Archive', icon: <ArchiveIcon /> },
        { href: '/materials/audit-logs', label: ar ? 'سجل التدقيق' : 'Audit Logs', icon: <AuditIcon /> },
      ],
    };
  }

  // warehouse
  return {
    primary: [
      { href: '/materials/dashboard', label: ar ? 'الرئيسية' : 'Home', icon: <HomeIcon active={false} />, activeIcon: <HomeIcon active={true} /> },
      { href: '/materials/requests', label: ar ? 'الطلبات' : 'Requests', icon: <RequestsIcon active={false} />, activeIcon: <RequestsIcon active={true} /> },
      { href: '/materials/inventory', label: ar ? 'المخزون' : 'Inventory', icon: <InventoryIcon active={false} />, activeIcon: <InventoryIcon active={true} /> },
      { href: '/materials/returns', label: ar ? 'الإرجاع' : 'Returns', icon: <ReturnsIcon active={false} />, activeIcon: <ReturnsIcon active={true} /> },
    ],
    more: [
      { href: '/materials/store-admin', label: ar ? 'إدارة المخزن' : 'Store Admin', icon: <StoreIcon /> },
      { href: '/materials/trainer-needs', label: ar ? 'احتياجات المدربين' : 'Trainer Needs', icon: <TrainerIcon /> },
      { href: '/materials/rooms-schedule', label: ar ? 'جدول القاعات' : 'Rooms Schedule', icon: <CalendarIcon /> },
      { href: '/materials/rooms-admin', label: ar ? 'إدارة القاعات' : 'Rooms Admin', icon: <RoomsIcon /> },
      { href: '/materials/messages', label: ar ? 'الرسائل' : 'Messages', icon: <MessagesIcon /> },
    ],
  };
}

export function MobileBottomNav({
  role,
  canManageTrainerNeeds = false,
}: {
  role: AppRole;
  canManageTrainerNeeds?: boolean;
}) {
  const pathname = usePathname();
  const { language } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const ar = language !== 'en';

  const { primary, more } = getNavConfig(role, language, canManageTrainerNeeds);

  const ACCENT = role === 'manager' ? '#C7B08C' : role === 'warehouse' ? '#4F8F7A' : '#2A6364';
  const BG = role === 'manager' ? 'from-[#0a1f1a] to-[#1a4535]' : role === 'warehouse' ? 'from-[#0d2b35] to-[#2A6364]' : 'from-[#1a3c3c] to-[#2A6364]';

  return (
    <>
      {/* More drawer overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More drawer */}
      <div
        className={cn(
          'fixed bottom-[72px] left-0 right-0 z-50 transition-all duration-300 ease-out',
          moreOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        )}
        dir={ar ? 'rtl' : 'ltr'}
      >
        <div className="mx-3 mb-2 overflow-hidden rounded-[24px] border border-white/10 bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)]">
          {/* Drawer header */}
          <div className={`bg-gradient-to-l ${BG} flex items-center justify-between px-5 py-4`}>
            <span className="text-[15px] font-bold text-white">{ar ? 'القائمة الكاملة' : 'All Sections'}</span>
            <button
              onClick={() => setMoreOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Items grid */}
          <div className="grid grid-cols-3 gap-0 p-3">
            {more.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-[16px] px-2 py-4 text-center transition-all active:scale-95',
                    active
                      ? 'bg-[#eef5f4] text-[#2A6364]'
                      : 'text-[#5a6a69] hover:bg-[#f5f8f8]'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-[14px] transition-all',
                      active ? 'bg-[#2A6364] text-white shadow-[0_4px_12px_rgba(42,99,100,0.3)]' : 'bg-[#f0f5f5] text-[#2A6364]'
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[11px] font-semibold leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e8eeed] bg-white/95 backdrop-blur-md"
        dir={ar ? 'rtl' : 'ltr'}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch">
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-all active:scale-95"
                style={{ color: active ? ACCENT : '#8a9a99' }}
              >
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full"
                    style={{ backgroundColor: ACCENT }}
                  />
                )}
                <span className={cn('transition-all', active ? 'scale-110' : 'scale-100')}>
                  {active ? item.activeIcon : item.icon}
                </span>
                <span className="text-[10px] font-bold leading-none">{item.label}</span>
              </Link>
            );
          })}

          {/* More button */}
          {more.length > 0 && (
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-all active:scale-95"
              style={{ color: moreOpen ? ACCENT : '#8a9a99' }}
            >
              {moreOpen && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full"
                  style={{ backgroundColor: ACCENT }}
                />
              )}
              <MoreIcon />
              <span className="text-[10px] font-bold leading-none">{ar ? 'المزيد' : 'More'}</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
