import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Status, Role, CustodyStatus, ItemType } from '@prisma/client';
import { CustodyService } from '@/services/custody.service';
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
        status: true,
      },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: {
        id: true,
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
  };
}

function serializeCustodyRecord(record: any) {
  return {
    id: record.id,
    quantity: record.quantity,
    issueDate: record.issueDate?.toISOString?.() || null,
    dueDate: record.expectedReturn?.toISOString?.() || null,
    expectedReturn: record.expectedReturn?.toISOString?.() || null,
    actualReturn: record.actualReturn?.toISOString?.() || null,
    updatedAt: record.updatedAt?.toISOString?.() || null,
    notes: record.notes,
    status: record.status,
    userId: record.userId,
    user: record.user,
    item: record.item,
    returnRequests: Array.isArray(record.returnRequests)
      ? record.returnRequests.map((ret: any) => ({
          ...ret,
          createdAt: ret.createdAt?.toISOString?.() || ret.createdAt || null,
        }))
      : [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveVerifiedSessionUser(request);
    const pageParam = request.nextUrl.searchParams.get('page');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const status = request.nextUrl.searchParams.get('status');
    const openId = request.nextUrl.searchParams.get('open');
    const usePaginatedMode = pageParam !== null || limitParam !== null || status !== null || openId !== null;

    if (!usePaginatedMode) {
      const custodyRecords = await prisma.custodyRecord.findMany({
        where: {
          userId: session.id,
          status: {
            in: [CustodyStatus.ACTIVE, CustodyStatus.OVERDUE, CustodyStatus.RETURN_REQUESTED],
          },
          item: {
            type: ItemType.RETURNABLE,
          },
        },
        include: {
          item: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
              type: true,
            },
          },
          user: {
            select: {
              id: true,
              fullName: true,
              department: true,
              email: true,
            },
          },
          request: {
            select: {
              id: true,
              code: true,
              purpose: true,
              createdAt: true,
            },
          },
          returnRequests: {
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              id: true,
              code: true,
              status: true,
              conditionNote: true,
              rejectionReason: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ expectedReturn: 'asc' }, { issueDate: 'desc' }],
      });

      return NextResponse.json({
        data: custodyRecords.map(serializeCustodyRecord),
      });
    }

    const pageValue = Number(pageParam || 1);
    const limitValue = Number(limitParam || 10);
    const result = await CustodyService.getAll({
      userId: session.id,
      role: session.role,
      page: Number.isFinite(pageValue) ? pageValue : 1,
      limit: Number.isFinite(limitValue) ? limitValue : 10,
      status,
      openId,
      returnableOnly: session.role === Role.USER,
      excludeReturned: session.role === Role.USER && String(status || '').trim() === '',
    });

    return NextResponse.json({
      data: result.data.map(serializeCustodyRecord),
      stats: result.stats,
      pagination: result.pagination,
    });
  } catch (error: any) {
    const statusCode =
      error?.message === 'غير مصرح' || error?.message === 'الحساب غير نشط' ? 401 : 500;

    return NextResponse.json(
      { error: error?.message || 'تعذر جلب العهد' },
      { status: statusCode }
    );
  }
}
