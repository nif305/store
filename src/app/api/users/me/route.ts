import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveSessionUser } from '@/lib/auth/session';
import { sanitizeError } from '@/lib/api/sanitizeError';

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        fullName: true,
        email: true,
        mobile: true,
        department: true,
        jobTitle: true,
        telegramChatId: true,
      },
    });
    if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeError(error, 'تعذر جلب الملف الشخصي') }, { status: 500 });
  }
}
