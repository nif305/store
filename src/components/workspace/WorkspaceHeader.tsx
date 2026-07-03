'use client';

import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { type AppRole, type WorkspaceKey } from '@/lib/workspace';

const ROLE_ORDER: AppRole[] = ['manager', 'warehouse', 'user'];

export function WorkspaceHeader({ workspace }: { workspace: WorkspaceKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, language } = useI18n();
  const { user, originalUser, canUseRoleSwitch, switchViewRole, logout } = useAuth();

  const availableRoles = useMemo<AppRole[]>(() => {
    const roles = Array.isArray(originalUser?.roles) ? originalUser.roles : [];
    return ROLE_ORDER.filter((role) => roles.includes(role));
  }, [originalUser?.roles]);

  const onRoleChange = async (role: AppRole) => {
    await switchViewRole(role);
    router.replace(pathname);
    router.refresh();
  };

  return (
    <header className="rounded-[28px] border border-[#dde6e4] bg-white/95 px-5 py-4 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.24)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/materials/dashboard')}
            title={t('workspace.materialsTitle')}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#dbe5e3] bg-[#f7f9f9] text-[#27494a] transition hover:border-[#2A6364]/35 hover:bg-white"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
              <path d="M9 21V12h6v9" />
            </svg>
          </button>

          <div className="flex items-center gap-2 rounded-2xl border border-[#dbe5e3] bg-[#fbfcfc] px-3 py-2">
            {user?.id ? <NotificationBell userId={user.id} /> : null}

            <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4f8f8] text-[#2A6364]">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M5.5 19c1.65-3.1 4.35-4.65 6.5-4.65S16.85 15.9 18.5 19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="truncate text-[17px] font-bold text-[#223738]">{user?.fullName || t('common.systemUser')}</div>
                <div className="truncate text-[12px] text-[#7a8d8b]">{user?.email || ''}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <LanguageToggle />

          {canUseRoleSwitch && availableRoles.length > 1 ? (
            <div
              className="inline-flex items-center gap-1 rounded-[20px] border border-[#dbe5e3] bg-[#f7f9f9] p-1"
              role="group"
              aria-label={language === 'en' ? 'Role switcher' : 'تبديل الدور'}
            >
              {availableRoles.map((role) => {
                const active = user?.role === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => onRoleChange(role)}
                    aria-pressed={active}
                    className={active
                      ? 'min-w-[116px] rounded-[16px] bg-[#2A6364] px-4 py-2.5 text-[15px] font-semibold text-white shadow-[0_14px_28px_-22px_rgba(42,99,100,0.8)]'
                      : 'min-w-[116px] rounded-[16px] px-4 py-2.5 text-[15px] font-semibold text-[#3e5756] transition hover:bg-white'}
                  >
                    {t(`roles.${role}`)}
                  </button>
                );
              })}
            </div>
          ) : null}

          <button
            type="button"
            onClick={logout}
            className="inline-flex h-12 items-center rounded-2xl border border-[#dbe5e3] bg-white px-5 text-[14px] font-semibold text-[#2f4a4a] transition hover:border-[#2A6364]/35 hover:bg-[#f8fbfb]"
          >
            {t('common.logout')}
          </button>
        </div>
      </div>
    </header>
  );
}
