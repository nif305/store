import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { InventoryService } from '@/services/inventory.service';
import { resolveSessionUser } from '@/lib/auth/session';
import { sanitizeError } from '@/lib/api/sanitizeError';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function canManageInventory(role: Role) {
  return role === Role.MANAGER || role === Role.WAREHOUSE;
}

function resolveErrorStatus(error: unknown, fallback: number, request: NextRequest) {
  const message = String((error as { message?: string })?.message || '');
  const hasSession = request.cookies.has('inventory_platform_session') || request.cookies.has('user_id');
  if (!hasSession) return 401;
  if (message.includes('تسجيل الدخول') || message.includes('الحساب') || message.includes('المستخدم')) {
    return 401;
  }
  return fallback;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await resolveSessionUser(request);
    const { id } = await params;
    const item = await InventoryService.getById(id);

    if (!item) {
      return NextResponse.json({ error: 'الصنف غير موجود' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeError(error, 'تعذر جلب بيانات الصنف') },
      { status: resolveErrorStatus(error, 500, request) },
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await resolveSessionUser(request);
    if (!canManageInventory(session.role)) {
      return NextResponse.json({ error: 'غير مصرح بإدارة المخزون' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const item = await InventoryService.update(id, body);
    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeError(error, 'تعذر تحديث الصنف') },
      { status: resolveErrorStatus(error, 400, request) },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await resolveSessionUser(request);
    if (!canManageInventory(session.role)) {
      return NextResponse.json({ error: 'غير مصرح بإدارة المخزون' }, { status: 403 });
    }

    const { id } = await params;
    const result = await InventoryService.delete(id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeError(error, 'تعذر حذف الصنف') },
      { status: resolveErrorStatus(error, 400, request) },
    );
  }
}
