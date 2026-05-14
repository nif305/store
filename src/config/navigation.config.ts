export type AppRole = 'manager' | 'warehouse' | 'user';

export type NavigationGroup = 'dashboard' | 'materials' | 'messages' | 'governance';

export type NavigationItem = {
  href: string;
  label: string;
  icon:
    | 'dashboard'
    | 'requests'
    | 'returns'
    | 'custody'
    | 'inventory'
    | 'notifications'
    | 'audit'
    | 'messages'
    | 'users'
    | 'archive'
    | 'reports';
  roles?: AppRole[];
  group: NavigationGroup;
};

export const navigationItems: NavigationItem[] = [
  {
    href: '/materials/dashboard',
    label: 'لوحة التحكم',
    icon: 'dashboard',
    roles: ['manager', 'warehouse', 'user'],
    group: 'dashboard',
  },
  {
    href: '/materials/inventory',
    label: 'مخزون المواد',
    icon: 'inventory',
    roles: ['manager', 'warehouse'],
    group: 'materials',
  },
  {
    href: '/materials/requests',
    label: 'طلبات المواد',
    icon: 'requests',
    roles: ['manager', 'warehouse', 'user'],
    group: 'materials',
  },
  {
    href: '/materials/returns',
    label: 'إرجاعات المواد',
    icon: 'returns',
    roles: ['manager', 'warehouse', 'user'],
    group: 'materials',
  },
  {
    href: '/materials/custody',
    label: 'العهد',
    icon: 'custody',
    roles: ['user'],
    group: 'materials',
  },
  {
    href: '/materials/messages',
    label: 'المراسلات الداخلية',
    icon: 'messages',
    roles: ['manager', 'warehouse', 'user'],
    group: 'messages',
  },
  {
    href: '/materials/notifications',
    label: 'الإشعارات',
    icon: 'notifications',
    roles: ['warehouse', 'user'],
    group: 'messages',
  },
  {
    href: '/materials/reports',
    label: 'التقارير',
    icon: 'reports',
    roles: ['manager'],
    group: 'governance',
  },
  {
    href: '/materials/archive',
    label: 'الأرشيف',
    icon: 'archive',
    roles: ['manager'],
    group: 'governance',
  },
  {
    href: '/materials/audit-logs',
    label: 'سجل التدقيق',
    icon: 'audit',
    roles: ['manager'],
    group: 'governance',
  },
  {
    href: '/materials/users',
    label: 'المستخدمون',
    icon: 'users',
    roles: ['manager'],
    group: 'governance',
  },
];
