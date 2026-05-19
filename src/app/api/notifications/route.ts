import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/api/sanitizeError';
import { Role, Status } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AlertService } from '@/services/alert.service';

type NotificationFilterKey = 'ALL' | 'UNREAD' | 'ALERT' | 'NOTIFICATION' | 'CRITICAL' | 'ACTION';
const WAREHOUSE_ALERT_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const ALERT_SYNC_ACTION = 'SYNC_SMART_ALERTS';
const ALERT_SYNC_ENTITY_PREFIX = 'smart-alert-sync';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

function mapRole(role: string): Role {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return Role.MANAGER;
  if (normalized === 'warehouse') return Role.WAREHOUSE;
  return Role.USER;
}

async function runNotificationQuery<T>(query: () => Promise<T>): Promise<T> {
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

function buildCriticalWhere() {
  return [
    { type: { contains: 'CRITICAL', mode: 'insensitive' as const } },
    { type: { contains: 'OUT_OF_STOCK', mode: 'insensitive' as const } },
    { type: { contains: 'OVERDUE', mode: 'insensitive' as const } },
  ];
}

function buildActionWhere() {
  return [
    { type: { contains: 'LOW_STOCK', mode: 'insensitive' as const } },
    { type: { contains: 'NEW_', mode: 'insensitive' as const } },
    { type: { contains: 'PENDING', mode: 'insensitive' as const } },
    { type: { contains: 'REMINDER', mode: 'insensitive' as const } },
    { type: { contains: 'CUSTODY', mode: 'insensitive' as const } },
    { type: { contains: 'RETURN_', mode: 'insensitive' as const } },
  ];
}

function buildAlertWhere() {
  return [
    ...buildCriticalWhere(),
    ...buildActionWhere(),
    { entityType: { equals: 'message', mode: 'insensitive' as const } },
  ];
}

function buildSearchWhere(search: string | null) {
  const value = String(search || '').trim();
  if (!value) return {};

  return {
    OR: [
      { title: { contains: value, mode: 'insensitive' as const } },
      { message: { contains: value, mode: 'insensitive' as const } },
      { type: { contains: value, mode: 'insensitive' as const } },
      { entityType: { contains: value, mode: 'insensitive' as const } },
      { entityId: { contains: value, mode: 'insensitive' as const } },
    ],
  };
}

function buildFilterWhere(filter: string | null) {
  const key = String(filter || 'ALL').trim().toUpperCase() as NotificationFilterKey;

  if (key === 'UNREAD') {
    return { isRead: false };
  }

  if (key === 'ALERT') {
    return { OR: buildAlertWhere() };
  }

  if (key === 'NOTIFICATION') {
    return { NOT: { OR: buildAlertWhere() } };
  }

  if (key === 'CRITICAL') {
    return { OR: buildCriticalWhere() };
  }

  if (key === 'ACTION') {
    return { OR: buildActionWhere() };
  }

  return {};
}

async function resolveSessionUser(request: NextRequest) {
  const cookieId = decodeURIComponent(request.cookies.get('user_id')?.value || '').trim();
  const cookieEmail = decodeURIComponent(request.cookies.get('user_email')?.value || '').trim();
  const cookieEmployeeId = decodeURIComponent(request.cookies.get('user_employee_id')?.value || '').trim();
  const activeRole = mapRole(
    decodeURIComponent(
      request.headers.get('x-active-role') ||
        request.cookies.get('server_active_role')?.value ||
        request.cookies.get('active_role')?.value ||
        request.cookies.get('user_role')?.value ||
        'user'
    ).trim()
  );

  let user = null as null | { id: string; status: Status; roles: Role[] };

  if (cookieId) {
    user = await runNotificationQuery(() =>
      prisma.user.findUnique({
        where: { id: cookieId },
        select: { id: true, status: true, roles: true },
      })
    );
  }

  if (!user && cookieEmail) {
    user = await runNotificationQuery(() =>
      prisma.user.findFirst({
        where: { email: { equals: cookieEmail, mode: 'insensitive' } },
        select: { id: true, status: true, roles: true },
      })
    );
  }

  if (!user && cookieEmployeeId) {
    user = await runNotificationQuery(() =>
      prisma.user.findUnique({
        where: { employeeId: cookieEmployeeId },
        select: { id: true, status: true, roles: true },
      })
    );
  }

  if (!user) {
    throw new Error('تعذر التحقق من المستخدم الحالي. أعد تسجيل الدخول ثم حاول مرة أخرى.');
  }

  if (user.status !== Status.ACTIVE) {
    throw new Error('الحساب غير نشط.');
  }

  if (!Array.isArray(user.roles) || !user.roles.includes(activeRole)) {
    throw new Error('الدور النشط غير صالح لهذا المستخدم.');
  }

  return {
    id: user.id,
    status: user.status,
    role: activeRole,
    roles: user.roles,
  };
}

function authStatusCode(error: any) {
  const message = String(error?.message || '');
  if (
    message === 'تعذر التحقق من المستخدم الحالي. أعد تسجيل الدخول ثم حاول مرة أخرى.' ||
    message === 'الحساب غير نشط.' ||
    message === 'الدور النشط غير صالح لهذا المستخدم.'
  ) {
    return 401;
  }

  return null;
}

async function syncSmartAlertsWhenDue(sessionUser: Awaited<ReturnType<typeof resolveSessionUser>>) {
  try {
    const syncEntityId = `${ALERT_SYNC_ENTITY_PREFIX}:${sessionUser.id}:${sessionUser.role}`;
    const latestSync = await runNotificationQuery(() =>
      prisma.auditLog.findFirst({
        where: {
          action: ALERT_SYNC_ACTION,
          entity: 'Notification',
          entityId: syncEntityId,
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
    );

    if (latestSync && Date.now() - latestSync.createdAt.getTime() < WAREHOUSE_ALERT_SYNC_INTERVAL_MS) {
      return;
    }

    if (sessionUser.role === Role.WAREHOUSE) {
      await AlertService.syncWarehouseAlerts();
    } else if (sessionUser.role === Role.MANAGER) {
      await AlertService.syncManagerAlerts();
    } else {
      await AlertService.syncUserAlerts();
    }

    await runNotificationQuery(() =>
      prisma.auditLog.create({
        data: {
          userId: sessionUser.id,
          action: ALERT_SYNC_ACTION,
          entity: 'Notification',
          entityId: syncEntityId,
          details: JSON.stringify({
            source: 'notifications-api',
            intervalMinutes: WAREHOUSE_ALERT_SYNC_INTERVAL_MS / 60000,
            role: sessionUser.role,
          }),
        },
      })
    );
  } catch (error) {
    console.error('Failed to sync smart alerts before loading notifications', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser(request);
    const mode = String(request.nextUrl.searchParams.get('mode') || '').trim().toLowerCase();
    const maxLimit = mode === 'bell' ? 10 : 200;
    const fallbackLimit = mode === 'bell' ? 5 : 100;
    const pageParam = Number(request.nextUrl.searchParams.get('page') || 1);
    const limitParam = Number(request.nextUrl.searchParams.get('limit') || fallbackLimit);
    const filter = request.nextUrl.searchParams.get('filter');
    const search = request.nextUrl.searchParams.get('search');
    const page = Number.isFinite(pageParam) ? Math.max(1, Math.trunc(pageParam)) : 1;
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(1, Math.trunc(limitParam)), maxLimit) : fallbackLimit;
    const skip = (page - 1) * limit;

    await syncSmartAlertsWhenDue(sessionUser);

    const where = {
      AND: [{ userId: sessionUser.id }, buildFilterWhere(filter), buildSearchWhere(search)],
    };

    if (mode === 'bell') {
      const [data, total, unread] = await Promise.all([
        runNotificationQuery(() =>
          prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          })
        ),
        runNotificationQuery(() => prisma.notification.count({ where })),
        runNotificationQuery(() => prisma.notification.count({ where: { userId: sessionUser.id, isRead: false } })),
      ]);

      return NextResponse.json({
        data,
        stats: {
          total,
          unread,
          alerts: 0,
          critical: 0,
          actions: 0,
          hasUnread: unread > 0,
          hasCritical: false,
          actionRequired: false,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
        generatedAt: new Date().toISOString(),
      }, { headers: NO_STORE_HEADERS });
    }

    const [data, total, unread, alerts, critical, actions, totalAll] = await Promise.all([
      runNotificationQuery(() =>
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        })
      ),
      runNotificationQuery(() => prisma.notification.count({ where })),
      runNotificationQuery(() => prisma.notification.count({ where: { userId: sessionUser.id, isRead: false } })),
      runNotificationQuery(() => prisma.notification.count({ where: { userId: sessionUser.id, OR: buildAlertWhere() } })),
      runNotificationQuery(() => prisma.notification.count({ where: { userId: sessionUser.id, OR: buildCriticalWhere() } })),
      runNotificationQuery(() => prisma.notification.count({ where: { userId: sessionUser.id, OR: buildActionWhere() } })),
      runNotificationQuery(() => prisma.notification.count({ where: { userId: sessionUser.id } })),
    ]);

    return NextResponse.json({
      data,
      stats: {
        total: totalAll,
        unread,
        alerts,
        critical,
        actions,
        hasUnread: unread > 0,
        hasCritical: critical > 0,
        actionRequired: actions > 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      generatedAt: new Date().toISOString(),
    }, { headers: NO_STORE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeError(error, 'تعذر جلب الإشعارات')},
      { status: authStatusCode(error) || 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser(request);
    const body = await request.json();

    if (body?.all) {
      const result = await runNotificationQuery(() =>
        prisma.notification.updateMany({
          where: { userId: sessionUser.id, isRead: false },
          data: { isRead: true, readAt: new Date() },
        })
      );

      return NextResponse.json({ data: result }, { headers: NO_STORE_HEADERS });
    }

    const notification = await runNotificationQuery(() =>
      prisma.notification.findUnique({
        where: { id: String(body.id || '') },
      })
    );

    if (!notification || notification.userId !== sessionUser.id) {
      return NextResponse.json({ error: 'الإشعار غير موجود أو غير مصرح' }, { status: 404 });
    }

    const result = await runNotificationQuery(() =>
      prisma.notification.update({
        where: { id: notification.id },
        data: { isRead: true, readAt: new Date() },
      })
    );

    return NextResponse.json({ data: result }, { headers: NO_STORE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeError(error, 'تعذر تحديث الإشعار')},
      { status: authStatusCode(error) || 400, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await resolveSessionUser(request);
    const body = await request.json();
    const action = String(body.action || '').trim();

    if (action !== 'create-manager-request') {
      return NextResponse.json({ error: 'الإجراء غير صالح' }, { status: 400 });
    }

    const notificationId = String(body.id || '').trim();
    if (!notificationId) {
      return NextResponse.json({ error: 'رقم الإشعار مطلوب' }, { status: 400 });
    }

    const data = null;

    return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeError(error, 'تعذر تحويل التذكير إلى طلب مدير')},
      { status: authStatusCode(error) || 400, headers: NO_STORE_HEADERS }
    );
  }
}
