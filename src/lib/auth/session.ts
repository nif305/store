import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role, Status } from '@prisma/client';

export type SessionUser = {
  id: string;
  role: Role;
  roles: Role[];
  department: string;
  email: string;
  employeeId: string;
  fullName: string;
  canManageTrainerNeeds: boolean;
};

function normalizeRole(value: unknown): Role {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'manager') return Role.MANAGER;
  if (normalized === 'warehouse') return Role.WAREHOUSE;
  return Role.USER;
}

function normalizeRoles(raw: unknown): Role[] {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw.trim()
      ? [raw]
      : [];

  const mapped = values.map((value) => normalizeRole(value));
  const unique = Array.from(new Set<Role>([Role.USER, ...mapped]));

  if (unique.includes(Role.MANAGER)) {
    return [Role.MANAGER, ...unique.filter((role) => role !== Role.MANAGER)];
  }

  if (unique.includes(Role.WAREHOUSE)) {
    return [Role.WAREHOUSE, ...unique.filter((role) => role !== Role.WAREHOUSE)];
  }

  return [Role.USER];
}

export function getCookieUserId(request: NextRequest) {
  return decodeURIComponent(request.cookies.get('user_id')?.value || '').trim();
}

export async function resolveSessionUser(request: NextRequest): Promise<SessionUser> {
  const cookieId = getCookieUserId(request);
  const cookieEmail = decodeURIComponent(request.cookies.get('user_email')?.value || '').trim();
  const cookieEmployeeId = decodeURIComponent(
    request.cookies.get('user_employee_id')?.value || ''
  ).trim();
  const cookieDepartment = decodeURIComponent(
    request.cookies.get('user_department')?.value || 'إدارة عمليات التدريب'
  ).trim();
  const cookieName = decodeURIComponent(
    request.cookies.get('user_name')?.value || 'مستخدم النظام'
  ).trim();

  let user = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: {
        id: true,
        fullName: true,
        department: true,
        email: true,
        employeeId: true,
        status: true,
        roles: true,
        canManageTrainerNeeds: true,
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
        fullName: true,
        department: true,
        email: true,
        employeeId: true,
        status: true,
        roles: true,
        canManageTrainerNeeds: true,
      },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: {
        id: true,
        fullName: true,
        department: true,
        email: true,
        employeeId: true,
        status: true,
        roles: true,
        canManageTrainerNeeds: true,
      },
    });
  }

  if (!user) {
    throw new Error('تعذر التحقق من المستخدم الحالي. أعد تسجيل الدخول ثم حاول مرة أخرى.');
  }

  if (user.status !== Status.ACTIVE) {
    throw new Error('الحساب غير نشط.');
  }

  const persistedRolesCookie =
    request.cookies.get('server_user_roles')?.value || request.cookies.get('user_roles')?.value || '[]';

  let cookieRoles: Role[] = [];
  try {
    cookieRoles = normalizeRoles(JSON.parse(decodeURIComponent(persistedRolesCookie)));
  } catch {
    cookieRoles = [];
  }

  const dbRoles = normalizeRoles(user.roles);
  const allowedRoles = dbRoles.length ? dbRoles : cookieRoles;

  const requestedRole = normalizeRole(
    request.headers.get('x-active-role') ||
      decodeURIComponent(request.cookies.get('server_active_role')?.value || '') ||
      decodeURIComponent(request.cookies.get('active_role')?.value || '') ||
      decodeURIComponent(request.cookies.get('user_role')?.value || '') ||
      allowedRoles[0] ||
      Role.USER
  );

  const effectiveRole = allowedRoles.includes(requestedRole) ? requestedRole : allowedRoles[0] || Role.USER;

  return {
    id: user.id,
    role: effectiveRole,
    roles: allowedRoles,
    department: user.department || cookieDepartment,
    email: user.email || cookieEmail,
    employeeId: user.employeeId || cookieEmployeeId,
    fullName: user.fullName || cookieName,
    canManageTrainerNeeds: !!user.canManageTrainerNeeds,
  };
}

export function isManager(session: SessionUser) {
  return session.role === Role.MANAGER;
}

export function isWarehouse(session: SessionUser) {
  return session.role === Role.WAREHOUSE;
}
