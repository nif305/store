import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
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
  const cookieEmployeeId = decodeURIComponent(request.cookies.get('user_employee_id')?.value || '').trim();
  const cookieRole = decodeURIComponent(
    request.headers.get('x-active-role') ||
    request.cookies.get('server_active_role')?.value ||
    request.cookies.get('active_role')?.value ||
    request.cookies.get('user_role')?.value ||
    'user'
  ).trim();

  const activeRole = mapRole(cookieRole);

  let user: {
    id: string;
    roles: Role[];
  } | null = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: { id: true, roles: true },
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
      select: { id: true, roles: true },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: { id: true, roles: true },
    });
  }

  if (!user) {
    throw new Error('تعذر التحقق من المستخدم الحالي');
  }

  if (!Array.isArray(user.roles) || !user.roles.includes(activeRole)) {
    throw new Error('الدور النشط غير صالح لهذا المستخدم');
  }

  return {
    id: user.id,
    activeRole,
  };
}

function resolveSystemEntities(system?: string | null) {
  const normalized = String(system || '').toLowerCase();
  if (normalized === 'materials') {
    return ['Request', 'ReturnRequest', 'CustodyRecord', 'InventoryItem'];
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveVerifiedSessionUser(request);
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500);
    const action = String(searchParams.get('action') || '').trim();
    const entity = String(searchParams.get('entity') || '').trim();
    const search = String(searchParams.get('search') || '').trim();
    const system = String(searchParams.get('system') || '').trim();
    const days = Math.max(0, parseInt(searchParams.get('days') || '0', 10));
    const systemEntities = resolveSystemEntities(system);

    const where =
      session.role === Role.MANAGER
        ? {}
        : {
            userId: session.id,
          };

    const composedWhere: any = {
      ...where,
      ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
      ...(entity ? { entity: { equals: entity, mode: 'insensitive' } } : {}),
      ...(systemEntities ? { entity: { in: systemEntities } } : {}),
      ...(days > 0 ? { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } } : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { entity: { contains: search, mode: 'insensitive' } },
              { entityId: { contains: search, mode: 'insensitive' } },
              { details: { contains: search, mode: 'insensitive' } },
              { user: { is: { fullName: { contains: search, mode: 'insensitive' } } } },
              { user: { is: { email: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where: composedWhere }),
      prisma.auditLog.findMany({
        where: composedWhere,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              roles: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: logs.map((log) => ({
        id: log.id,
        source: 'SERVER',
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        details: log.details,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
        user: {
          id: log.user?.id || log.userId || '',
          fullName: log.user?.fullName || 'غير معروف',
          role:
            Array.isArray(log.user?.roles) && log.user.roles.length > 0
              ? log.user.roles[0]
              : null,
          roles: log.user?.roles || [],
          email: log.user?.email || null,
        },
      })),
      stats: {
        total,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر جلب سجلات التدقيق' },
      { status: error?.message?.includes('المستخدم') || error?.message?.includes('الدور') ? 401 : 500 }
    );
  }
}
