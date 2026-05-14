import { NextRequest, NextResponse } from 'next/server';
import { resolveSessionUser } from '@/lib/auth/session';
import {
  assignTrainerNeed,
  canManageTrainerNeeds,
  convertTrainerNeedToRequest,
  getTrainerNeed,
  proposeTrainerNeedPlan,
  releaseTrainerNeedReservations,
  reserveTrainerNeedAvailable,
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
    return NextResponse.json({ error: error?.message || 'تعذر جلب الاحتياج' }, { status: 401 });
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
    if (action === 'reserve') {
      return NextResponse.json({ data: await reserveTrainerNeedAvailable(id, session.id) });
    }
    if (action === 'convert') {
      return NextResponse.json({ data: await convertTrainerNeedToRequest(id, session) });
    }
    if (action === 'cancel') {
      return NextResponse.json({ data: await releaseTrainerNeedReservations(id) });
    }

    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر تنفيذ الإجراء' }, { status: 400 });
  }
}
