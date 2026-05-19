import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/api/sanitizeError';
import { MessagingService } from '@/services/messaging.service';
import { resolveSessionUser } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const box = request.nextUrl.searchParams.get('box') || 'inbox';
    const pageParam = Number(request.nextUrl.searchParams.get('page') || 1);
    const limitParam = Number(request.nextUrl.searchParams.get('limit') || 10);
    const search = request.nextUrl.searchParams.get('search');
    const openId = request.nextUrl.searchParams.get('open');

    const result = await MessagingService.getBox({
      userId: session.id,
      box: box === 'sent' ? 'sent' : 'inbox',
      page: Number.isFinite(pageParam) ? pageParam : 1,
      limit: Number.isFinite(limitParam) ? limitParam : 10,
      search,
      openId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeError(error, 'ظپط´ظ„ ط¬ظ„ط¨ ط§ظ„ظ…ط±ط§ط³ظ„ط§طھ')}, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const body = await request.json();

    if (!body.receiverId || !body.subject || !body.body) {
      return NextResponse.json({ error: 'ط¨ظٹط§ظ†ط§طھ ط§ظ„ط±ط³ط§ظ„ط© ط؛ظٹط± ظ…ظƒطھظ…ظ„ط©' }, { status: 400 });
    }

    const message = await MessagingService.send({
      senderId: session.id,
      receiverId: body.receiverId,
      subject: body.subject,
      body: body.body,
      relatedType: body.relatedType,
      relatedId: body.relatedId,
    });

    return NextResponse.json({ data: message }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeError(error, 'ظپط´ظ„ ط¥ط±ط³ط§ظ„ ط§ظ„ط±ط³ط§ظ„ط©')}, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'ط¨ظٹط§ظ†ط§طھ ط§ظ„طھط­ط¯ظٹط« ط؛ظٹط± ظ…ظƒطھظ…ظ„ط©' }, { status: 400 });
    }

    const result = await MessagingService.markAsRead(body.id, session.id);
    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeError(error, 'ظپط´ظ„ طھط­ط¯ظٹط« ط§ظ„ط±ط³ط§ظ„ط©')}, { status: 400 });
  }
}
