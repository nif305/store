import type { AppLanguage } from '@/context/AuthContext';
import { getTranslation } from '@/lib/i18n';

export type AppRole = 'manager' | 'warehouse' | 'user';
export type WorkspaceKey = 'materials';

export const WORKSPACE_TITLES: Record<WorkspaceKey, string> = {
  materials: getTranslation('ar', 'workspace.materialsTitle'),
};

export const WORKSPACE_DESCRIPTIONS: Record<WorkspaceKey, string> = {
  materials: getTranslation('ar', 'workspace.materialsDescription'),
};

export function getWorkspaceTitle(workspace: WorkspaceKey, language: AppLanguage = 'ar') {
  return getTranslation(language, 'workspace.materialsTitle');
}

export function getWorkspaceDescription(workspace: WorkspaceKey, language: AppLanguage = 'ar') {
  return getTranslation(language, 'workspace.materialsDescription');
}

export function normalizeRole(role?: string | null): AppRole {
  const value = String(role || '').toLowerCase();
  if (value === 'manager') return 'manager';
  if (value === 'warehouse') return 'warehouse';
  return 'user';
}

export function canAccessWorkspace(role: AppRole, workspace: WorkspaceKey): boolean {
  return workspace === 'materials';
}

export function getDefaultWorkspacePath(role?: string | null): string {
  normalizeRole(role);
  return '/materials/dashboard';
}

export type WorkspaceNavItem = {
  href: string;
  label: string;
  roles?: AppRole[];
  badge?: string;
};

export type WorkspaceNavGroup = {
  key: string;
  title: string;
  items: WorkspaceNavItem[];
};

function label(language: AppLanguage, key: string) {
  return getTranslation(language, key);
}

function getSharedMessagesItem(_workspace: WorkspaceKey, language: AppLanguage): WorkspaceNavItem {
  return {
    href: '/materials/messages',
    label: label(language, 'workspace.internalMessages'),
    roles: ['manager', 'warehouse', 'user'],
  };
}

export function getWorkspaceGroups(
  workspace: WorkspaceKey,
  role: AppRole,
  language: AppLanguage = 'ar',
  options: { canManageTrainerNeeds?: boolean } = {}
): WorkspaceNavGroup[] {
  const systemItems: WorkspaceNavItem[] = [];

  if (canAccessWorkspace(role, 'materials')) {
    systemItems.push({
      href: '/materials/dashboard',
      label: label(language, 'workspace.materialsTitle'),
    });
  }

  const groups: WorkspaceNavGroup[] = [
    {
      key: 'systems',
      title: label(language, 'workspace.systems'),
      items: systemItems,
    },
  ];

  if (workspace === 'materials') {
    groups.push(
      {
        key: 'dashboard',
        title: label(language, 'workspace.materialsDashboard'),
        items: [
          {
            href: '/materials/dashboard',
            label: label(language, 'workspace.materialsDashboardItem'),
            roles: ['manager', 'warehouse', 'user'],
          },
        ],
      },
      {
        key: 'operations',
        title: label(language, 'workspace.materialsOperations'),
        items: [
          {
            href: '/materials/requests',
            label: label(language, role === 'user' ? 'workspace.materialsRequestUser' : 'workspace.materialsRequests'),
            roles: ['manager', 'warehouse', 'user'],
          },
          ...(role === 'manager' || role === 'warehouse' || options.canManageTrainerNeeds
            ? [
                {
                  href: '/materials/trainer-needs',
                  label: 'احتياجات المدربين',
                  roles: ['manager', 'warehouse', 'user'] as AppRole[],
                },
                {
                  href: '/materials/rooms-schedule',
                  label: 'جدول القاعات',
                  roles: ['manager', 'warehouse', 'user'] as AppRole[],
                },
              ]
            : []),
          {
            href: '/materials/inventory',
            label: label(language, 'workspace.inventory'),
            roles: ['manager', 'warehouse'],
          },
          {
            href: '/materials/store-admin',
            label: 'إدارة المواد',
            roles: ['manager', 'warehouse'],
          },
          {
            href: '/materials/rooms-admin',
            label: 'إدارة القاعات',
            roles: ['manager', 'warehouse'],
          },
          {
            href: '/materials/returns',
            label: label(language, role === 'user' ? 'workspace.returnsUser' : 'workspace.returns'),
            roles: ['manager', 'warehouse', 'user'],
          },
          {
            href: '/materials/custody',
            label: label(language, 'workspace.custody'),
            roles: ['user'],
          },
        ],
      },
      {
        key: 'communications',
        title: label(language, 'workspace.communications'),
        items: [getSharedMessagesItem(workspace, language)],
      }
    );
  }

  if (role === 'manager') {
    groups.push({
      key: 'governance',
      title: label(language, 'workspace.governance'),
      items: [
        {
          href: '/materials/users',
          label: label(language, 'workspace.users'),
          roles: ['manager'],
        },
        {
          href: '/materials/reports',
          label: label(language, 'workspace.reports'),
          roles: ['manager'],
        },
        {
          href: '/materials/archive',
          label: label(language, 'workspace.archive'),
          roles: ['manager'],
        },
        {
          href: '/materials/audit-logs',
          label: label(language, 'workspace.auditLogs'),
          roles: ['manager'],
        },
      ],
    });
  }

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);
}
