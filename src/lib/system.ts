export type SystemKey = 'materials' | 'portal';

const LEGACY_MATERIAL_PATHS = [
  '/inventory',
  '/requests',
  '/returns',
  '/custody',
];

const MATERIAL_PATHS = ['/materials', ...LEGACY_MATERIAL_PATHS];

export function getSystemEntryRoute(_system: Exclude<SystemKey, 'portal'>, _role?: string) {
  return '/materials/dashboard';
}

function mapLegacyPath(pathname: string): string | null {
  if (pathname === '/dashboard' || pathname === '/index') return '/portal';
  if (pathname === '/requests') return '/materials/requests';
  if (pathname === '/inventory') return '/materials/inventory';
  if (pathname === '/returns') return '/materials/returns';
  if (pathname === '/custody') return '/materials/custody';
  if (pathname === '/messages') return '/materials/messages';
  if (pathname === '/reports') return '/materials/reports';
  if (pathname === '/users') return '/materials/users';
  if (pathname === '/archive') return '/materials/archive';
  if (pathname === '/audit-logs') return '/materials/audit-logs';
  if (pathname === '/notifications') return '/materials/notifications';
  return null;
}

export function canonicalizeAppHref(href?: string | null, _role?: string | null): string {
  if (!href) return '/portal';
  if (/^(https?:)?\/\//i.test(href)) return href;

  const [pathname, search = ''] = href.split('?');
  const directMatch =
    pathname === '/portal' ||
    pathname === '/login' ||
    pathname.startsWith('/materials/');

  if (directMatch) return href;

  const mappedPath = mapLegacyPath(pathname);
  if (!mappedPath) return href;
  return search ? `${mappedPath}?${search}` : mappedPath;
}

export function detectSystemFromPath(pathname: string): SystemKey {
  if (pathname === '/portal' || pathname === '/dashboard' || pathname === '/index') return 'portal';
  if (MATERIAL_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return 'materials';
  return 'portal';
}

export function getDefaultRouteForRole() {
  return '/materials/dashboard';
}

export const systemMeta = {
  portal: {
    title: 'اختيار النظام',
    shortTitle: 'اختيار النظام',
  },
  materials: {
    title: 'نظام طلبات المواد والمخزون',
    shortTitle: 'نظام المواد',
  },
} as const;
