import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/api/sanitizeError';
import { prisma } from '@/lib/prisma';
import { resolveSessionUser } from '@/lib/auth/session';

function normalizeLanguage(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'en' ? 'en' : 'ar';
}

function shouldUseSecureCookies(request: NextRequest) {
  return request.nextUrl.protocol === 'https:';
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const body = await request.json().catch(() => ({}));
    const preferredLanguage = normalizeLanguage(body?.preferredLanguage);

    await prisma.user.update({
      where: { id: session.id },
      data: { preferredLanguage },
    });

    const response = NextResponse.json({
      data: { preferredLanguage },
    });

    response.cookies.set('preferred_language', preferredLanguage, {
      httpOnly: true,
      sameSite: 'lax',
      secure: shouldUseSecureCookies(request),
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Unable to update language preference')},
      { status: 400 }
    );
  }
}
