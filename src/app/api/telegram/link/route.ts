import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveSessionUser } from '@/lib/auth/session';
import { sanitizeError } from '@/lib/api/sanitizeError';

function generateToken(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

// GET — generate a fresh link token for current user
export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const token = generateToken();

    await prisma.user.update({
      where: { id: session.id },
      data: { telegramLinkToken: token },
    });

    return NextResponse.json({ token });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeError(error, 'تعذر إنشاء رمز الربط') }, { status: 500 });
  }
}

// DELETE — unlink telegram from current user
export async function DELETE(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);

    await prisma.user.update({
      where: { id: session.id },
      data: { telegramChatId: null, telegramLinkToken: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeError(error, 'تعذر فك الربط') }, { status: 500 });
  }
}
