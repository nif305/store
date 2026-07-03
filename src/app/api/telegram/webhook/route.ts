import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegram } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = String(message.chat?.id || '');
    const text = String(message.text || '').trim();

    // /start TOKEN — link account
    if (text.startsWith('/start') || text.startsWith('/link')) {
      const parts = text.split(/\s+/);
      const token = parts[1] || '';

      if (!token) {
        await sendTelegram(chatId, '👋 أرسل لي رمز الربط من ملفك الشخصي في المنصة.');
        return NextResponse.json({ ok: true });
      }

      const user = await prisma.user.findFirst({
        where: { telegramLinkToken: token },
        select: { id: true, fullName: true },
      });

      if (!user) {
        await sendTelegram(chatId, '❌ الرمز غير صحيح أو منتهي الصلاحية. احصل على رمز جديد من ملفك الشخصي.');
        return NextResponse.json({ ok: true });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: chatId, telegramLinkToken: null },
      });

      await sendTelegram(chatId, `✅ تم ربط حساب <b>${user.fullName}</b> بنجاح!\n\nستصلك الإشعارات هنا تلقائياً.`);
      return NextResponse.json({ ok: true });
    }

    await sendTelegram(chatId, '💬 أرسل لي رمز الربط من ملفك الشخصي في المنصة لتفعيل الإشعارات.');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
