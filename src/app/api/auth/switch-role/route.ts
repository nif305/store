import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ROLES = ['manager', 'warehouse', 'user'] as const;

function shouldUseSecureCookies(request: NextRequest) {
  return request.nextUrl.protocol === 'https:';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requestedRole = String(body?.role || '').trim().toLowerCase();

    if (!ALLOWED_ROLES.includes(requestedRole as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: 'دور غير صالح' }, { status: 400 });
    }

    const rolesCookie =
      request.cookies.get('server_user_roles')?.value ||
      request.cookies.get('user_roles')?.value ||
      '[]';

    let currentRoles: string[] = [];
    try {
      currentRoles = JSON.parse(decodeURIComponent(rolesCookie));
    } catch {
      currentRoles = [];
    }

    if (!Array.isArray(currentRoles) || !currentRoles.includes(requestedRole)) {
      return NextResponse.json({ error: 'غير مصرح بهذا الدور' }, { status: 403 });
    }

    const response = NextResponse.json({ ok: true, role: requestedRole });

    const cookieOptions = {
      httpOnly: true as const,
      sameSite: 'lax' as const,
      secure: shouldUseSecureCookies(request),
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    };

    response.cookies.set('active_role', requestedRole, cookieOptions);
    response.cookies.set('user_role', requestedRole, cookieOptions);
    response.cookies.set('server_active_role', requestedRole, cookieOptions);

    return response;
  } catch {
    return NextResponse.json({ error: 'تعذر تحديث الدور النشط' }, { status: 500 });
  }
}
