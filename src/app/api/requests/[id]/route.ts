import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { RequestService } from '@/services/request.service';
import { resolveSessionUser } from '@/lib/auth/session';
import { sanitizeError } from '@/lib/api/sanitizeError';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveSessionUser(request);
    const { id } = await params;
    const materialRequest = await RequestService.getById(id);

    if (session.role === Role.USER && materialRequest.requesterId !== session.id) {
      return NextResponse.json({ error: 'غير مصرح بالاطلاع على هذا الطلب' }, { status: 403 });
    }

    return NextResponse.json(materialRequest);
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeError(error, 'تعذر جلب الطلب') }, { status: 500 });
  }
}

async function handleMutation(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const session = await resolveSessionUser(request);
    const action = String(body?.action || '').trim().toLowerCase();

    if (action === 'approve') {
      if (session.role !== Role.MANAGER) {
        return NextResponse.json({ error: 'الاعتماد الإداري متاح للمدير فقط' }, { status: 403 });
      }

      return NextResponse.json(await RequestService.approve(id, session.id, body?.notes || ''));
    }

    if (action === 'issue') {
      if (session.role !== Role.WAREHOUSE) {
        return NextResponse.json({ error: 'الصرف متاح للمستودع فقط' }, { status: 403 });
      }

      return NextResponse.json(await RequestService.issue(id, session.id, body?.notes || ''));
    }

    if (action === 'reject') {
      const rejectingRoles: Role[] = [Role.MANAGER, Role.WAREHOUSE];
      if (!rejectingRoles.includes(session.role)) {
        return NextResponse.json({ error: 'الرفض متاح للمدير أو المستودع فقط' }, { status: 403 });
      }

      return NextResponse.json(
        await RequestService.reject(id, session.id, body?.reason || body?.notes || 'تم الرفض')
      );
    }

    if (action === 'update') {
      if (session.role !== Role.USER) {
        return NextResponse.json({ error: 'هذا الإجراء مخصص للموظف فقط' }, { status: 403 });
      }

      return NextResponse.json(
        await RequestService.updateBeforeIssue(id, session.id, {
          purpose: body?.purpose || '',
          notes: body?.notes || '',
          items: Array.isArray(body?.items) ? body.items : [],
        })
      );
    }

    if (action === 'cancel') {
      if (session.role !== Role.USER) {
        return NextResponse.json({ error: 'هذا الإجراء مخصص للموظف فقط' }, { status: 403 });
      }

      return NextResponse.json(
        await RequestService.cancelBeforeIssue(id, session.id, body?.notes || '')
      );
    }

    if (action === 'adjust_after_issue') {
      if (session.role !== Role.USER) {
        return NextResponse.json({ error: 'هذا الإجراء مخصص للموظف فقط' }, { status: 403 });
      }

      return NextResponse.json(
        await RequestService.adjustAfterIssue(id, session.id, {
          notes: body?.notes || '',
          items: Array.isArray(body?.items) ? body.items : [],
        })
      );
    }

    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 });
  } catch (error: any) {
    const statusCode =
      error?.message === 'تعذر التحقق من المستخدم الحالي. أعد تسجيل الدخول ثم حاول مرة أخرى.'
        ? 401
        : 400;

    return NextResponse.json({ error: sanitizeError(error, 'تعذر تنفيذ العملية') }, { status: statusCode });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleMutation(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleMutation(request, context);
}
