import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { resolveSessionUser } from '@/lib/auth/session';
import { hashPassword } from '@/lib/security/password';

type UiRole = 'manager' | 'warehouse' | 'user';
type PrismaRole = 'MANAGER' | 'WAREHOUSE' | 'USER';

function normalizeText(value?: string | null) { return (value || '').trim(); }
function normalizeEmail(value?: string | null) { return (value || '').trim().toLowerCase(); }
function normalizeRoleValue(role?: string | null): UiRole {
  const value = (role || '').trim().toLowerCase();
  if (value === 'manager') return 'manager';
  if (value === 'warehouse') return 'warehouse';
  return 'user';
}
function toPrismaRole(role?: string | null): PrismaRole {
  const value = normalizeRoleValue(role);
  if (value === 'manager') return 'MANAGER';
  if (value === 'warehouse') return 'WAREHOUSE';
  return 'USER';
}
function toPrismaRoles(input: unknown, fallback?: PrismaRole[]): PrismaRole[] {
  const values = Array.isArray(input) ? input : typeof input === 'string' ? [input] : [];
  const mapped = values.map((value) => toPrismaRole(String(value)));
  const unique = Array.from(new Set<PrismaRole>(['USER', ...mapped]));
  return unique.length > 0 ? unique : fallback && fallback.length > 0 ? Array.from(new Set<PrismaRole>(fallback)) : ['USER'];
}
function toUiRoles(input: unknown): UiRole[] {
  const values = Array.isArray(input) ? input : typeof input === 'string' ? [input] : [];
  const mapped = values.map((value) => normalizeRoleValue(String(value)));
  return Array.from(new Set<UiRole>(['user', ...mapped]));
}
function getPrimaryRole(roles: UiRole[]): UiRole {
  if (roles.includes('manager')) return 'manager';
  if (roles.includes('warehouse')) return 'warehouse';
  return 'user';
}
function toPrismaStatus(status?: string) { return status === 'disabled' ? 'DISABLED' : 'ACTIVE'; }
function normalizeLanguage(value?: string | null) { return String(value || '').trim().toLowerCase() === 'en' ? 'en' : 'ar'; }
function mapUser(user: any) {
  const uiRoles = toUiRoles(user?.roles || user?.role);
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
    role: getPrimaryRole(uiRoles),
    roles: uiRoles,
    status: user.status.toLowerCase(),
    avatar: user.avatar,
    undertaking: { accepted: !!user.undertaking?.accepted, acceptedAt: user.undertaking?.acceptedAt ? user.undertaking.acceptedAt.toISOString() : null },
    createdAt: user.createdAt?.toISOString?.() || null,
    lastLoginAt: null,
    mustChangePassword: false,
    canManageTrainerNeeds: !!user.canManageTrainerNeeds,
  };
}

async function updateUserHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await resolveSessionUser(request);
    if (session.role !== Role.MANAGER) {
      return NextResponse.json({ error: 'تعديل المستخدمين متاح للمدير فقط' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const fullName = normalizeText(body?.fullName);
    const email = normalizeEmail(body?.email);
    const mobile = normalizeText(body?.mobile);
    const extension = normalizeText(body?.extension);
    const department = normalizeText(body?.department);
    const jobTitle = normalizeText(body?.jobTitle);
    const operationalProject = normalizeText(body?.operationalProject);
    const password = normalizeText(body?.password);
    const status = normalizeText(body?.status).toLowerCase();
    const currentUser = await prisma.user.findUnique({ where: { id }, include: { undertaking: true } });
    if (!currentUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    const canManageTrainerNeeds =
      typeof body?.canManageTrainerNeeds === 'boolean'
        ? body.canManageTrainerNeeds
        : currentUser.canManageTrainerNeeds;

    const preferredLanguage = body?.preferredLanguage
      ? normalizeLanguage(body.preferredLanguage)
      : normalizeLanguage(currentUser.preferredLanguage);

    if (email) {
      const duplicated = await prisma.user.findFirst({ where: { email, NOT: { id } } });
      if (duplicated) {
        return NextResponse.json({ error: 'البريد الإلكتروني مستخدم من حساب آخر' }, { status: 409 });
      }
    }

    const requestedRoles = Array.isArray(body?.roles) || body?.role ? toPrismaRoles(body?.roles ?? body?.role, currentUser.roles) : currentUser.roles;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        fullName: fullName || currentUser.fullName,
        email: email || currentUser.email,
        mobile: mobile || currentUser.mobile,
        department: operationalProject || department || currentUser.department,
        jobTitle: extension || jobTitle || currentUser.jobTitle,
        preferredLanguage,
        passwordHash: password ? hashPassword(password) : currentUser.passwordHash,
        roles: requestedRoles,
        canManageTrainerNeeds,
        status: status ? toPrismaStatus(status) : currentUser.status,
      },
      include: { undertaking: true },
    });

    return NextResponse.json({ data: mapUser(updatedUser) });
  } catch {
    return NextResponse.json({ error: 'تعذر تحديث المستخدم' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await resolveSessionUser(request);
    const { id } = await context.params;
    if (session.id !== id && session.role !== Role.MANAGER) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id }, include: { undertaking: true } });
    if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    return NextResponse.json({ data: mapUser(user) });
  } catch {
    return NextResponse.json({ error: 'تعذر جلب المستخدم' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) { return updateUserHandler(request, context); }
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) { return updateUserHandler(request, context); }
