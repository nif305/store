import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function normalizeRoles(roleOrRoles: unknown): string[] {
  const raw = Array.isArray(roleOrRoles)
    ? roleOrRoles
    : typeof roleOrRoles === 'string' && roleOrRoles.trim()
      ? [roleOrRoles]
      : [];

  const normalized = Array.from(new Set(raw.map((role) => String(role).toLowerCase()).filter(Boolean)));
  return normalized.includes('user') ? normalized : ['user', ...normalized];
}

function getPrimaryRole(roles: string[]): string {
  if (roles.includes('manager')) return 'manager';
  if (roles.includes('warehouse')) return 'warehouse';
  return 'user';
}

function normalizeLanguage(value?: string | null) {
  return String(value || '').trim().toLowerCase() === 'en' ? 'en' : 'ar';
}

function shouldUseSecureCookies(request: NextRequest) {
  return request.nextUrl.protocol === 'https:';
}

function clearSessionResponse(request: NextRequest) {
  const response = NextResponse.json({ user: null }, { status: 401 });

  const cookieOptions = {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: shouldUseSecureCookies(request),
    path: '/',
    expires: new Date(0),
  };

  for (const name of ['inventory_platform_session','user_id','user_role','user_roles','user_status','user_email','user_name','user_department','user_employee_id','active_role','server_active_role','server_user_roles','preferred_language']) {
    response.cookies.set(name, '', cookieOptions);
  }

  return response;
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    const activeRoleFromCookie = request.cookies.get('active_role')?.value?.toLowerCase();

    if (!userId) {
      return clearSessionResponse(request);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        undertaking: true,
      },
    });

    if (!user || user.status === 'DISABLED') {
      return clearSessionResponse(request);
    }

    const roles = normalizeRoles((user as { roles?: string[] }).roles);
    const primaryRole = getPrimaryRole(roles);
    const activeRole = activeRoleFromCookie && roles.includes(activeRoleFromCookie)
      ? activeRoleFromCookie
      : primaryRole;

    const response = NextResponse.json({
      user: {
        id: user.id,
        employeeId: user.employeeId,
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        extension: user.jobTitle || '',
        department: user.department,
        jobTitle: user.jobTitle,
        preferredLanguage: normalizeLanguage((user as any).preferredLanguage),
        operationalProject: user.department || '',
        role: activeRole,
        roles,
        status: user.status.toLowerCase(),
        avatar: user.avatar,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: null,
        mustChangePassword: false,
        canManageTrainerNeeds: !!(user as any).canManageTrainerNeeds,
        undertaking: {
          accepted: !!user.undertaking?.accepted,
          acceptedAt: user.undertaking?.acceptedAt
            ? user.undertaking.acceptedAt.toISOString()
            : null,
        },
      },
    });

    const cookieOptions = {
      httpOnly: true as const,
      sameSite: 'lax' as const,
      secure: shouldUseSecureCookies(request),
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    };

    response.cookies.set('inventory_platform_session', 'active', cookieOptions);
    response.cookies.set('user_id', user.id, cookieOptions);
    response.cookies.set('user_role', activeRole, cookieOptions);
    response.cookies.set('user_roles', JSON.stringify(roles), cookieOptions);
    response.cookies.set('active_role', activeRole, cookieOptions);
    response.cookies.set('server_active_role', activeRole, cookieOptions);
    response.cookies.set('server_user_roles', JSON.stringify(roles), cookieOptions);
    response.cookies.set('user_status', user.status.toLowerCase(), cookieOptions);
    response.cookies.set('user_email', user.email, cookieOptions);
    response.cookies.set('user_name', user.fullName, cookieOptions);
    response.cookies.set('user_department', user.department || '', cookieOptions);
    response.cookies.set('user_employee_id', user.employeeId || '', cookieOptions);
    response.cookies.set('preferred_language', normalizeLanguage((user as any).preferredLanguage), cookieOptions);

    return response;
  } catch {
    return clearSessionResponse(request);
  }
}
