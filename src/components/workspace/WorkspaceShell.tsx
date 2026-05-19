'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { type AppRole, type WorkspaceKey, canAccessWorkspace, getDefaultWorkspacePath, getWorkspaceTitle, normalizeRole } from '@/lib/workspace';

export function WorkspaceShell({ workspace, children }: { workspace: WorkspaceKey; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { language } = useI18n();
  const router = useRouter();
  const role = normalizeRole(user?.role) as AppRole;
  const skipLabel = language === 'en' ? 'Skip to main content' : 'تجاوز إلى المحتوى الرئيسي';

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!canAccessWorkspace(role, workspace)) {
      router.replace(getDefaultWorkspacePath(role));
    }
  }, [loading, user, role, workspace, router]);

  const loadingText = language === 'en' ? 'Preparing workspace...' : 'جاري تجهيز بيئة العمل...';

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7f7]">
        <div className="rounded-3xl border border-[#dde6e4] bg-white px-8 py-6 text-center shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
          {loadingText}
        </div>
      </div>
    );
  }

  if (!canAccessWorkspace(role, workspace)) return null;

  return (
    <div className="arabic-surface min-h-screen bg-[#f5f7f7]">
      <a href="#main-content" className="skip-link">
        {skipLabel}
      </a>
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start lg:gap-5 lg:px-5 lg:py-5">
        <div className="order-1 w-full lg:order-1 lg:sticky lg:top-4 lg:w-[300px] lg:flex-none">
          <WorkspaceSidebar workspace={workspace} role={role} canManageTrainerNeeds={!!user.canManageTrainerNeeds} />
        </div>

        <main id="main-content" tabIndex={-1} className="order-2 min-w-0 flex-1 outline-none lg:order-2" aria-label={getWorkspaceTitle(workspace, language)}>
          <div className="flex min-h-screen flex-col gap-4">
            <WorkspaceHeader workspace={workspace} />
            <section className="min-h-0 flex-1">{children}</section>
          </div>
        </main>
      </div>
    </div>
  );
}
