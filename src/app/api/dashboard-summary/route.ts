import { NextRequest, NextResponse } from 'next/server';
import {
  CustodyStatus,
  ItemStatus,
  ItemType,
  Prisma,
  RequestStatus,
  ReturnStatus,
  Role,
  Status,
  TrainingRoomBookingStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveSessionUser as resolveVerifiedSessionUser } from '@/lib/auth/session';

type GroupCountRow = Record<string, unknown> & {
  _count: {
    _all: number;
  };
};

function mapRole(role: string): Role {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return Role.MANAGER;
  if (normalized === 'warehouse') return Role.WAREHOUSE;
  return Role.USER;
}

async function resolveSessionUser(request: NextRequest) {
  const cookieId = decodeURIComponent(request.cookies.get('user_id')?.value || '').trim();
  const cookieEmail = decodeURIComponent(request.cookies.get('user_email')?.value || '').trim();
  const cookieEmployeeId = decodeURIComponent(request.cookies.get('user_employee_id')?.value || '').trim();

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
    user = await runDashboardQuery(() =>
      prisma.user.findUnique({ where: { id: cookieId }, select: { id: true, status: true } })
    );
  }

  if (!user && cookieEmail) {
    user = await runDashboardQuery(() =>
      prisma.user.findFirst({
        where: { email: { equals: cookieEmail, mode: 'insensitive' } },
        select: { id: true, status: true },
      })
    );
  }

  if (!user && cookieEmployeeId) {
    user = await runDashboardQuery(() =>
      prisma.user.findUnique({ where: { employeeId: cookieEmployeeId }, select: { id: true, status: true } })
    );
  }

  if (!user) throw new Error('Unable to resolve current user.');
  if (user.status !== Status.ACTIVE) throw new Error('User account is not active.');

  return { id: user.id, role: effectiveRole };
}

async function runDashboardQuery<T>(query: () => Promise<T>): Promise<T> {
  const delays = [150, 450, 900];
  let lastError: unknown;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await query();
    } catch (error: any) {
      lastError = error;
      const message = String(error?.message || '');
      const isTransientConnectionIssue =
        ['P1001', 'P1002', 'P1008', 'P1017'].includes(String(error?.code || '')) ||
        message.includes('Server has closed the connection') ||
        message.includes("Can't reach database server") ||
        message.includes('Connection terminated') ||
        message.includes('connection timeout');

      if (!isTransientConnectionIssue || attempt === delays.length) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }

  throw lastError;
}

function sumCounts(rows: GroupCountRow[]) {
  return rows.reduce((total, row) => total + (row._count?._all || 0), 0);
}

function countBy(rows: GroupCountRow[], key: string, value: string) {
  return rows
    .filter((row) => String(row[key]) === value)
    .reduce((total, row) => total + (row._count?._all || 0), 0);
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveVerifiedSessionUser(request);
    // Dashboard cards are operational summaries, not row-level lists. Keep them
    // global so every role sees the platform state instead of an empty personal
    // slice; detailed pages still enforce their own role-based access rules.
    const requestWhere: Prisma.RequestWhereInput = {};
    const returnWhere: Prisma.ReturnRequestWhereInput = {};
    const custodyWhere: Prisma.CustodyRecordWhereInput = {};

    // Keep these reads sequential. The production database can close the connection
    // when the dashboard fires too many aggregate queries at once.
    const inventoryStatusRows = await runDashboardQuery(() =>
      prisma.inventoryItem.groupBy({ by: ['status'], _count: { _all: true } })
    );
    const inventoryTypeRows = await runDashboardQuery(() =>
      prisma.inventoryItem.groupBy({ by: ['type'], _count: { _all: true } })
    );
    const requestStatusRows = await runDashboardQuery(() =>
      prisma.request.groupBy({ by: ['status'], where: requestWhere, _count: { _all: true } })
    );
    const requestItemsCount = await runDashboardQuery(() =>
      prisma.requestItem.count()
    );
    const returnStatusRows = await runDashboardQuery(() =>
      prisma.returnRequest.groupBy({ by: ['status'], where: returnWhere, _count: { _all: true } })
    );
    const custodyStatusRows = await runDashboardQuery(() =>
      prisma.custodyRecord.groupBy({ by: ['status'], where: custodyWhere, _count: { _all: true } })
    );
    const unreadNotifications = await runDashboardQuery(() =>
      prisma.notification.count({ where: { userId: session.id, isRead: false } })
    );
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const totalTrainingRooms = await runDashboardQuery(() => prisma.trainingRoom.count({ where: { isVisible: true } }));
    const roomBookingsToday = await runDashboardQuery(() =>
      prisma.trainingRoomBooking.findMany({
        where: {
          status: TrainingRoomBookingStatus.APPROVED,
          approvedRoomId: { not: null },
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
        },
        select: { approvedRoomId: true },
      })
    );
    const pendingRoomBookings = await runDashboardQuery(() =>
      prisma.trainingRoomBooking.count({ where: { status: TrainingRoomBookingStatus.REQUESTED } })
    );
    const latestUpdates = await runDashboardQuery(() =>
      prisma.notification.findMany({ where: { userId: session.id }, orderBy: { createdAt: 'desc' }, take: 4 })
    );
    const roomsBookedToday = new Set(roomBookingsToday.map((booking) => booking.approvedRoomId).filter(Boolean)).size;

    const totalInventory = sumCounts(inventoryStatusRows);
    const lowStock = countBy(inventoryStatusRows, 'status', ItemStatus.LOW_STOCK);
    const outOfStock = countBy(inventoryStatusRows, 'status', ItemStatus.OUT_OF_STOCK);
    const returnableItems = countBy(inventoryTypeRows, 'type', ItemType.RETURNABLE);
    const consumableItems = countBy(inventoryTypeRows, 'type', ItemType.CONSUMABLE);

    const materialRequestsTotal = sumCounts(requestStatusRows);
    const pendingRequests =
      countBy(requestStatusRows, 'status', RequestStatus.PENDING) +
      countBy(requestStatusRows, 'status', RequestStatus.APPROVED);
    const approvedRequests = countBy(requestStatusRows, 'status', RequestStatus.APPROVED);
    const issuedRequests = countBy(requestStatusRows, 'status', RequestStatus.ISSUED);
    const returnedRequests = countBy(requestStatusRows, 'status', RequestStatus.RETURNED);
    const rejectedRequests = countBy(requestStatusRows, 'status', RequestStatus.REJECTED);

    const returnRequestsTotal = sumCounts(returnStatusRows);
    const pendingReturns = countBy(returnStatusRows, 'status', ReturnStatus.PENDING);
    const approvedReturns = countBy(returnStatusRows, 'status', ReturnStatus.APPROVED);
    const rejectedReturns = countBy(returnStatusRows, 'status', ReturnStatus.REJECTED);

    const custodyTotal = sumCounts(custodyStatusRows);
    const activeCustody =
      countBy(custodyStatusRows, 'status', CustodyStatus.ACTIVE) +
      countBy(custodyStatusRows, 'status', CustodyStatus.OVERDUE) +
      countBy(custodyStatusRows, 'status', CustodyStatus.RETURN_REQUESTED);
    const returnedCustody = countBy(custodyStatusRows, 'status', CustodyStatus.RETURNED);
    const delayedCustody = countBy(custodyStatusRows, 'status', CustodyStatus.OVERDUE);

    return NextResponse.json(
      {
        metrics: {
          totalInventory,
          lowStock,
          outOfStock,
          availableInventory: Math.max(totalInventory - outOfStock, 0),
          returnableItems,
          consumableItems,
          materialRequestsTotal,
          pendingRequests,
          approvedRequests,
          issuedRequests,
          returnedRequests,
          rejectedRequests,
          returnRequestsTotal,
          pendingReturns,
          approvedReturns,
          rejectedReturns,
          custodyTotal,
          activeCustody,
          returnedCustody,
          delayedCustody,
          unreadNotifications,
          requestItemsCount,
          totalTrainingRooms,
          roomsBookedToday,
          roomsAvailableToday: Math.max(totalTrainingRooms - roomsBookedToday, 0),
          pendingRoomBookings,
        },
        latestUpdates,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('[dashboard-summary] failed', error);
    const message = error?.message || 'Unable to load dashboard summary.';
    const statusCode =
      message.includes('Unable to resolve current user') ||
      message.includes('تعذر التحقق من المستخدم') ||
      message.includes('not active') ||
      message.includes('غير نشط')
        ? 401
        : 500;
    return NextResponse.json(
      { error: message },
      {
        status: statusCode,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
