import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role, Status } from '@prisma/client';
import { resolveSessionUser } from '@/lib/auth/session';
import { hashPassword } from '@/lib/security/password';

type PrismaRole = 'MANAGER' | 'WAREHOUSE' | 'MONITOR' | 'USER';

function normalizeText(value?: string | null) {
  return (value || '').trim();
}

function normalizeEmail(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function normalizeRoles(input: unknown): PrismaRole[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? [input]
      : [];

  const mapped: PrismaRole[] = raw
    .map((value) => String(value || '').trim().toLowerCase())
    .map((value) => {
      if (value === 'manager') return 'MANAGER';
      if (value === 'warehouse') return 'WAREHOUSE';
      return 'USER';
    });

  const withUser: PrismaRole[] = mapped.includes('USER') ? mapped : [...mapped, 'USER'];
  return Array.from(new Set(withUser)) as PrismaRole[];
}

function normalizeStatusFilter(value?: string | null): Status | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'active') return Status.ACTIVE;
  if (normalized === 'disabled') return Status.DISABLED;
  return null;
}

function normalizeLanguage(value?: string | null) {
  return String(value || '').trim().toLowerCase() === 'en' ? 'en' : 'ar';
}

function getPrimaryRole(roles: PrismaRole[]): 'manager' | 'warehouse' | 'user' {
  if (roles.includes('MANAGER')) return 'manager';
  if (roles.includes('WAREHOUSE')) return 'warehouse';
  return 'user';
}

function mapUser(user: any) {
  const roles = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : ['USER'];

  return {
    id: user.id,
    employeeId: user.employeeId,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    extension: user.jobTitle || '',
    department: user.department,
    jobTitle: user.jobTitle,
    preferredLanguage: normalizeLanguage(user.preferredLanguage),
    operationalProject: user.department,
    role: getPrimaryRole(roles),
    roles: roles.map((role: PrismaRole) => role.toLowerCase()),
    status: user.status.toLowerCase(),
    avatar: user.avatar,
    undertaking: {
      accepted: !!user.undertaking?.accepted,
      acceptedAt: user.undertaking?.acceptedAt
        ? user.undertaking.acceptedAt.toISOString()
        : null,
    },
    createdAt: user.createdAt?.toISOString?.() || null,
    lastLoginAt: null,
    mustChangePassword: false,
    canManageTrainerNeeds: !!user.canManageTrainerNeeds,
  };
}

export async function GET(request: NextRequest) {
  try {
    await resolveSessionUser(request);

    const searchParams = request.nextUrl.searchParams;
    const hasPagingIntent =
      searchParams.has('page') ||
      searchParams.has('limit') ||
      searchParams.has('search') ||
      searchParams.has('role') ||
      searchParams.has('status');

    if (!hasPagingIntent) {
      const users = await prisma.user.findMany({
        include: {
          undertaking: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return NextResponse.json({ data: users.map(mapUser) });
    }

    const pageRaw = Number(searchParams.get('page') || 1);
    const limitRaw = Number(searchParams.get('limit') || 10);
    const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1);
    const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 10), 50);
    const search = normalizeText(searchParams.get('search'));
    const roleFilter = normalizeText(searchParams.get('role')).toLowerCase();
    const statusFilter = normalizeStatusFilter(searchParams.get('status'));

    const where = {
      ...(search
        ? {
            OR: [
              { employeeId: { contains: search, mode: 'insensitive' as const } },
              { fullName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { mobile: { contains: search, mode: 'insensitive' as const } },
              { department: { contains: search, mode: 'insensitive' as const } },
              { jobTitle: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(roleFilter === 'manager'
        ? { roles: { has: 'MANAGER' as PrismaRole } }
        : roleFilter === 'warehouse'
          ? { roles: { has: 'WAREHOUSE' as PrismaRole } }
          : roleFilter === 'user'
            ? {
                NOT: {
                  roles: { hasSome: ['MANAGER', 'WAREHOUSE'] as PrismaRole[] },
                },
              }
            : {}),
    };

    const skip = (page - 1) * limit;
    const [users, total, active, disabled, managers, warehouses, usersOnly] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          undertaking: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { status: Status.ACTIVE } }),
      prisma.user.count({ where: { status: Status.DISABLED } }),
      prisma.user.count({ where: { roles: { has: 'MANAGER' } } }),
      prisma.user.count({ where: { roles: { has: 'WAREHOUSE' } } }),
      prisma.user.count({ where: { NOT: { roles: { hasSome: ['MANAGER', 'WAREHOUSE'] } } } }),
    ]);

    return NextResponse.json({
      data: users.map(mapUser),
      stats: {
        total: active + disabled,
        active,
        disabled,
        managers,
        warehouses,
        usersOnly,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch {
    return NextResponse.json({ error: 'تعذر جلب المستخدمين' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);

    if (session.role !== Role.MANAGER) {
      return NextResponse.json({ error: 'إضافة المستخدمين متاحة للمدير فقط' }, { status: 403 });
    }

    const body = await request.json();

    const fullName = normalizeText(body?.fullName);
    const email = normalizeEmail(body?.email);
    const mobile = normalizeText(body?.mobile);
    const extension = normalizeText(body?.extension);
    const operationalProject = normalizeText(body?.operationalProject);
    const preferredLanguage = normalizeLanguage(body?.preferredLanguage);
    const password = normalizeText(body?.password);
    const roles = normalizeRoles(body?.roles ?? body?.role ?? 'user');
    const canManageTrainerNeeds = !!body?.canManageTrainerNeeds;

    if (!fullName || !email || !mobile || !password) {
      return NextResponse.json({ error: 'البيانات المطلوبة غير مكتملة' }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: 'البريد الإلكتروني مستخدم من قبل' }, { status: 409 });
    }

    const count = await prisma.user.count();
    const employeeId = `NAUSS-${String(count + 1).padStart(3, '0')}`;

    const user = await prisma.user.create({
      data: {
        employeeId,
        fullName,
        email,
        mobile,
        department: operationalProject || 'لا ينطبق',
        jobTitle: extension || '',
        preferredLanguage,
        passwordHash: hashPassword(password),
        roles,
        canManageTrainerNeeds,
        status: 'ACTIVE',
      },
      include: {
        undertaking: true,
      },
    });

    return NextResponse.json({ data: mapUser(user) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'تعذر إنشاء المستخدم' }, { status: 500 });
  }
}
