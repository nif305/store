import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_FILE = /\.(.*)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_FILE.test(pathname) ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get('inventory_platform_session')?.value;
  const userRole = request.cookies.get('user_role')?.value as
    | 'manager'
    | 'warehouse'
    | 'user'
    | undefined;
  const userStatus = request.cookies.get('user_status')?.value;

  const isAuthenticated = !!session;

  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/request-account') ||
    pathname.startsWith('/pending-approval');

  const protectedRoutes = [
    '/portal',
    '/dashboard',
    '/inventory',
    '/requests',
    '/approvals',
    '/users',
    '/audit-logs',
    '/custody',
    '/returns',
    '/notifications',
    '/reports',
    '/messages',
    '/archive',
  ];

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  if (!isAuthenticated && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthenticated && (userStatus === 'disabled' || userStatus === 'rejected')) {
    const response = NextResponse.redirect(new URL('/login', request.url));

    const cookieOptions = {
      httpOnly: true as const,
      sameSite: 'lax' as const,
      secure: true,
      path: '/',
      expires: new Date(0),
    };

    response.cookies.set('inventory_platform_session', '', cookieOptions);
    response.cookies.set('user_id', '', cookieOptions);
    response.cookies.set('user_role', '', cookieOptions);
    response.cookies.set('user_status', '', cookieOptions);
    response.cookies.set('user_email', '', cookieOptions);
    response.cookies.set('user_name', '', cookieOptions);
    response.cookies.set('user_department', '', cookieOptions);
    response.cookies.set('user_employee_id', '', cookieOptions);

    return response;
  }

  if (
    isAuthenticated &&
    userStatus === 'pending' &&
    !pathname.startsWith('/pending-approval')
  ) {
    return NextResponse.redirect(new URL('/pending-approval', request.url));
  }

  if (isAuthenticated && isAuthPage && userStatus !== 'pending') {
    return NextResponse.redirect(new URL('/portal', request.url));
  }

  const managerOnlyRoutes = ['/users', '/audit-logs'];

  if (
    managerOnlyRoutes.some((route) => pathname.startsWith(route)) &&
    userRole !== 'manager'
  ) {
    return NextResponse.redirect(new URL('/portal?error=unauthorized', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
