import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/api/sanitizeError';
import { Role, Status, RequestStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { RequestService } from '@/services/request.service';
import { resolveSessionUser as resolveVerifiedSessionUser } from '@/lib/auth/session';

function mapRole(role: string): Role {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return Role.MANAGER;
  if (normalized === 'warehouse') return Role.WAREHOUSE;
  return Role.USER;
}

function normalizeRequestStatus(status: string | null): RequestStatus | undefined {
  if (!status) return undefined;
  const normalized = String(status).trim().toUpperCase();
  if (normalized === RequestStatus.PENDING) return RequestStatus.PENDING;
  if (normalized === RequestStatus.REJECTED) return RequestStatus.REJECTED;
  if (normalized === RequestStatus.ISSUED) return RequestStatus.ISSUED;
  if (normalized === RequestStatus.RETURNED) return RequestStatus.RETURNED;
  return undefined;
}

async function resolveSessionUser(request: NextRequest) {
  const cookieId = decodeURIComponent(request.cookies.get('user_id')?.value || '').trim();
  const cookieEmail = decodeURIComponent(request.cookies.get('user_email')?.value || '').trim();
  const cookieName = decodeURIComponent(
    request.cookies.get('user_name')?.value || 'مستخدم النظام'
  ).trim();
  const cookieDepartment = decodeURIComponent(
    request.cookies.get('user_department')?.value || 'إدارة عمليات التدريب'
  ).trim();
  const cookieEmployeeId = decodeURIComponent(
    request.cookies.get('user_employee_id')?.value || ''
  ).trim();
  const effectiveRole = mapRole(
    decodeURIComponent(
      request.cookies.get('active_role')?.value || request.cookies.get('user_role')?.value || 'user'
    ).trim()
  );

  let user = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: { id: true, department: true, email: true, employeeId: true, status: true },
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
      select: { id: true, department: true, email: true, employeeId: true, status: true },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: { id: true, department: true, email: true, employeeId: true, status: true },
    });
  }

  if (!user) {
    throw new Error('تعذر التحقق من المستخدم الحالي. أعد تسجيل الدخول ثم حاول مرة أخرى.');
  }

  if ((user as any).status && (user as any).status !== Status.ACTIVE) {
    throw new Error('الحساب غير نشط.');
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
    const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1);
    const limit = searchParams.has('limit')
      ? (() => {
          const value = parseInt(searchParams.get('limit') || '10', 10);
          return Math.min(Math.max(1, Number.isFinite(value) ? value : 10), 50);
        })()
      : 100;
    const view = searchParams.get('view');

    const result = await RequestService.getAll({
      userId: session.id,
      role: session.role,
      page,
      limit,
      status: normalizeRequestStatus(searchParams.get('status')),
      view,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeError(error, 'تعذر جلب الطلبات')},
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveVerifiedSessionUser(request);
    const body = await request.json();

    const items = Array.isArray(body?.items)
      ? body.items.filter((item: any) => item?.itemId && Number(item?.quantity) > 0)
      : [];

    if (!body?.purpose?.trim()) {
      return NextResponse.json({ error: 'الغرض من الطلب مطلوب' }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'يجب اختيار صنف واحد على الأقل' }, { status: 400 });
    }

    let requesterId = session.id;
    let department = session.department;

    const onBehalfOfUserId = typeof body?.onBehalfOfUserId === 'string' ? body.onBehalfOfUserId.trim() : '';
    if (session.role === Role.MANAGER && onBehalfOfUserId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: onBehalfOfUserId },
        select: { id: true, department: true, status: true },
      });
      if (!targetUser) {
        return NextResponse.json({ error: 'الموظف المحدد غير موجود' }, { status: 404 });
      }
      if (targetUser.status !== Status.ACTIVE) {
        return NextResponse.json({ error: 'حساب الموظف غير نشط' }, { status: 400 });
      }
      requesterId = targetUser.id;
      department = targetUser.department || session.department;
    }

    const result = await RequestService.create({
      requesterId,
      department,
      purpose: body.purpose.trim(),
      notes: body.notes?.trim() || '',
      items: items.map((item: any) => ({
        itemId: String(item.itemId),
        quantity: Number(item.quantity),
        expectedReturnDate: item.expectedReturnDate || null,
      })),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeError(error, 'تعذر إنشاء الطلب')},
      { status: 400 }
    );
  }
}
