import { NextRequest, NextResponse } from 'next/server';

function shouldUseSecureCookies(request: NextRequest) {
  return request.nextUrl.protocol === 'https:';
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });

  const cookieOptions = {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: shouldUseSecureCookies(request),
    path: '/',
    expires: new Date(0),
  };

  const cookiesToClear = [
    'inventory_platform_session',
    'user_id',
    'user_role',
    'user_roles',
    'user_status',
    'user_email',
    'user_name',
    'user_department',
    'user_employee_id',
    'active_role',
    'server_active_role',
    'server_user_roles',
    'preferred_language',
  ];

  for (const cookieName of cookiesToClear) {
    response.cookies.set(cookieName, '', cookieOptions);
  }

  return response;
}
