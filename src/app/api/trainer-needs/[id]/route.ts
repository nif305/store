import { sanitizeError } from '@/lib/api/sanitizeError';
import { NextRequest, NextResponse } from 'next/server';
import { resolveSessionUser } from '@/lib/auth/session';
import { approveRoomBooking, cancelRoomBooking } from '@/services/training-rooms.service';
import {
  assignTrainerNeed,
  canManageTrainerNeeds,
  convertTrainerNeedToRequest,
  deleteTrainerNeed,
  getTrainerNeed,
  proposeTrainerNeedPlan,
  releaseTrainerNeedReservations,
  reserveTrainerNeedAvailable,
  updateTrainerNeedOrder,
} from '@/services/training-store.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await resolveSessionUser(request);
    if (!canManageTrainerNeeds(session)) {
      return NextResponse.json({ error: 'غير مصرح بالاطلاع على احتياجات المدربين' }, { status: 403 });
    }
    const { id } = await context.params;
    return NextResponse.json({ data: await getTrainerNeed(id) });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeError(error, 'تعذر جلب الاحتياج')}, { status: 401 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await resolveSessionUser(request);
    if (!canManageTrainerNeeds(session)) {
      return NextResponse.json({ error: 'غير مصرح بإدارة احتياجات المدربين' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const action = String(body?.action || '').trim();

    if (action === 'assign') {
      return NextResponse.json({ data: await assignTrainerNeed(id, body?.assignedToId || null) });
    }
    if (action === 'plan') {
      return NextResponse.json({ data: await proposeTrainerNeedPlan(id) });
    }
    if (action === 'update-order') {
      const result = await updateTrainerNeedOrder(id, body);
      // Log external sourcing decisions if any
      const externalItems = Array.isArray(body?.items)
        ? body.items.filter((item: any) => String(item.coordinatorNote || '').startsWith('[تأمين خارجي]'))
        : [];
      if (externalItems.length > 0) {
        const { prisma } = await import('@/lib/prisma');
        await prisma.auditLog.create({
          data: {
            userId: session.id,
            action: 'TRAINER_NEED_EXTERNAL_SOURCING',
            entity: 'TrainerNeed',
            entityId: result.code,
            details: JSON.stringify({
              code: result.code,
              externalItemsCount: externalItems.length,
              items: externalItems.map((i: any) => ({ title: i.title, note: i.coordinatorNote })),
              decidedBy: session.fullName || session.email,
            }),
          },
        }).catch(() => undefined);
      }
      return NextResponse.json({ data: result });
    }
    if (action === 'reserve') {
      return NextResponse.json({ data: await reserveTrainerNeedAvailable(id, session.id) });
    }
    if (action === 'convert') {
      if (Array.isArray(body?.items)) {
        await updateTrainerNeedOrder(id, body);
      }
      await reserveTrainerNeedAvailable(id, session.id);
      return NextResponse.json({ data: await convertTrainerNeedToRequest(id, session) });
    }
    if (action === 'cancel') {
      return NextResponse.json({ data: await releaseTrainerNeedReservations(id) });
    }
    if (action === 'delete') {
      return NextResponse.json({ data: await deleteTrainerNeed(id) });
    }
    if (action === 'approve-room') {
      return NextResponse.json({ data: await approveRoomBooking(id, String(body?.roomId || ''), session, String(body?.note || '')) });
    }
    if (action === 'cancel-room') {
      return NextResponse.json({ data: await cancelRoomBooking(id, String(body?.note || '')) });
    }

    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeError(error, 'تعذر تنفيذ الإجراء')}, { status: 400 });
  }
}
