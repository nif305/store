import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/api/sanitizeError';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/security/password';

function normalizeText(value?: string | null) {
  return (value || '').trim();
}

function normalizeEmail(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function normalizeLanguage(value?: string | null) {
  return String(value || '').trim().toLowerCase() === 'en' ? 'en' : 'ar';
}

function mapUser(user: any) {
  const roles = Array.isArray(user?.roles)
    ? user.roles.map((role: any) => String(role).toLowerCase())
    : user?.role
      ? [String(user.role).toLowerCase()]
      : ['user'];

  const primaryRole = roles.includes('manager')
    ? 'manager'
    : roles.includes('warehouse')
      ? 'warehouse'
      : 'user';

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
    role: primaryRole,
    roles,
    status: String(user.status || 'ACTIVE').toLowerCase(),
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
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const fullName = normalizeText(body?.fullName);
    const email = normalizeEmail(body?.email);
    const mobile = normalizeText(body?.mobile);
    const extension = normalizeText(body?.extension);
    const operationalProject = normalizeText(body?.operationalProject);
    const preferredLanguage = normalizeLanguage(body?.preferredLanguage);
    const password = normalizeText(body?.password);
    const undertakingAccepted = !!body?.undertakingAccepted;

    if (!fullName || !email || !mobile || !password) {
      return NextResponse.json(
        { error: 'الاسم والبريد والجوال وكلمة المرور مطلوبة' },
        { status: 400 }
      );
    }

    if (!undertakingAccepted) {
      return NextResponse.json(
        { error: 'يجب قبول التعهد قبل إنشاء الحساب' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'يوجد حساب مسجل بهذا البريد الإلكتروني' },
        { status: 409 }
      );
    }

    const employeeId = `USR-${Date.now()}`;

    const createPayload: any = {
      employeeId,
      fullName,
      email,
      mobile,
      department: operationalProject || 'لا ينطبق',
      jobTitle: extension || '',
      preferredLanguage,
      passwordHash: hashPassword(password),
      status: 'ACTIVE',
      avatar: null,
      undertaking: {
        create: {
          accepted: true,
          acceptedAt: new Date(),
        },
      },
    };

    const userDelegate = prisma.user as any;

    let newUser;

    try {
      newUser = await userDelegate.create({
        data: {
          ...createPayload,
          roles: ['USER'],
        },
        include: {
          undertaking: true,
        },
      });
    } catch {
      newUser = await userDelegate.create({
        data: {
          ...createPayload,
          role: 'USER',
        },
        include: {
          undertaking: true,
        },
      });
    }

    return NextResponse.json(
      {
        message: 'تم إنشاء الحساب بنجاح ويمكن استخدامه مباشرة',
        data: mapUser(newUser),
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeError(error, 'تعذر إنشاء الحساب')},
      { status: 500 }
    );
  }
}
