import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/api/sanitizeError';
import { Role, Status } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ReturnService } from '@/services/return.service';
import { resolveSessionUser as resolveVerifiedSessionUser } from '@/lib/auth/session';

function mapRole(role: string): Role {
  const normalized = String(role || '').trim().toLowerCase();

  if (normalized === 'manager') return Role.MANAGER;
  if (normalized === 'warehouse') return Role.WAREHOUSE;
  return Role.USER;
}

async function resolveSessionUser(request: NextRequest) {
  const cookieId = decodeURIComponent(request.cookies.get('user_id')?.value || '').trim();
  const cookieEmail = decodeURIComponent(request.cookies.get('user_email')?.value || '').trim();
  const cookieDepartment = decodeURIComponent(
    request.cookies.get('user_department')?.value || 'إدارة عمليات التدريب'
  ).trim();
  const cookieEmployeeId = decodeURIComponent(
    request.cookies.get('user_employee_id')?.value || ''
  ).trim();

  const effectiveRole = mapRole(
    decodeURIComponent(
      request.headers.get('x-active-role') ||
        request.cookies.get('server_active_role')?.value ||
        request.cookies.get('active_role')?.value ||
        request.cookies.get('user_role')?.value ||
        'user'
    ).trim()
  );

  let user = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: {
        id: true,
        department: true,
        email: true,
        employeeId: true,
        status: true,
      },
    });
  }

  if (!user && cookieEmail) {
    user = await prisma.user.findFirst({
      where: {
        email: {
          equals: cookieEmail,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        department: true,
        email: true,
        employeeId: true,
        status: true,
      },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: {
        id: true,
        department: true,
        email: true,
        employeeId: true,
        status: true,
      },
    });
  }

  if (!user) {
    throw new Error('غير مصرح');
  }

  if (user.status !== Status.ACTIVE) {
    throw new Error('الحساب غير نشط');
  }

  return {
    id: user.id,
    role: effectiveRole,
    department: user.department || cookieDepartment,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveVerifiedSessionUser(request);
    const searchParams = request.nextUrl.searchParams;
    const pageRaw = parseInt(searchParams.get('page') || '1', 10);
    const limitRaw = parseInt(searchParams.get('limit') || '10', 10);
    const page = Number.isFinite(pageRaw) ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) ? limitRaw : 10;
    const status = searchParams.get('status') || '';

    return NextResponse.json(
      await ReturnService.getAll({
        page,
        limit,
        status,
        role: session.role,
        userId: session.id,
      })
    );
  } catch (error: any) {
    const statusCode =
      error?.message === 'غير مصرح' || error?.message === 'الحساب غير نشط' ? 401 : 500;

    return NextResponse.json(
      { error: sanitizeError(error, 'تعذر جلب طلبات الإرجاع')},
      { status: statusCode }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveVerifiedSessionUser(request);
    const body = await request.json();

    const custodyId = String(body?.custodyId || '').trim();
    const requestItemId = String(body?.requestItemId || '').trim();
    const quantity =
      body?.quantity === undefined || body?.quantity === null || body?.quantity === ''
        ? undefined
        : Number(body.quantity);

    if (!custodyId && !requestItemId) {
      return NextResponse.json(
        { error: 'يجب تحديد العهدة أو بند الطلب للإرجاع' },
        { status: 400 }
      );
    }

    if (custodyId && requestItemId) {
      return NextResponse.json(
        { error: 'لا يمكن إرسال العهدة وبند الطلب معًا في نفس الطلب' },
        { status: 400 }
      );
    }

    if (requestItemId) {
      if (!Number.isFinite(quantity) || Number(quantity) <= 0) {
        return NextResponse.json(
          { error: 'كمية الإرجاع مطلوبة ويجب أن تكون أكبر من صفر' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      await ReturnService.create({
        custodyId: custodyId || undefined,
        requestItemId: requestItemId || undefined,
        quantity: requestItemId ? Math.floor(Number(quantity)) : undefined,
        userId: session.id,
        notes: body.notes || '',
        returnType: body.returnType,
        damageDetails: body.damageDetails || '',
        damageImages: body.damageImages || '',
        declarationAck: Boolean(body.declarationAck),
      }),
      { status: 201 }
    );
  } catch (error: any) {
    const statusCode =
      error?.message === 'غير مصرح' || error?.message === 'الحساب غير نشط' ? 401 : 400;

    return NextResponse.json(
      { error: sanitizeError(error, 'تعذر إنشاء طلب الإرجاع')},
      { status: statusCode }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await resolveVerifiedSessionUser(request);
    const body = await request.json();

    if (body.action === 'approve') {
      if (session.role !== Role.MANAGER && session.role !== Role.WAREHOUSE) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
      }

      return NextResponse.json(
        await ReturnService.approve({
          returnId: String(body.returnId || ''),
          approverId: session.id,
          receivedType: body.receivedType,
          receivedNotes: body.receivedNotes || '',
          receivedImages: body.receivedImages || '',
        })
      );
    }

    if (body.action === 'reject') {
      if (session.role !== Role.MANAGER && session.role !== Role.WAREHOUSE) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
      }

      return NextResponse.json(
        await ReturnService.reject(
          String(body.returnId || ''),
          session.id,
          body.reason || 'تم رفض طلب الإرجاع'
        )
      );
    }

    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 });
  } catch (error: any) {
    const statusCode =
      error?.message === 'غير مصرح' || error?.message === 'الحساب غير نشط' ? 401 : 400;

    return NextResponse.json(
      { error: sanitizeError(error, 'تعذر تنفيذ الإجراء')},
      { status: statusCode }
    );
  }
}
