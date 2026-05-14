import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { resolveSessionUser } from '@/lib/auth/session';
import {
  createOnDemandCatalogItem,
  createStoreBundle,
  deleteStoreBundle,
  getStoreAdminCatalog,
  updateStoreBundle,
  updateCatalogItem,
  upsertAlternative,
} from '@/services/training-store.service';

function canManageStore(role: Role) {
  return role === Role.MANAGER || role === Role.WAREHOUSE;
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    if (!canManageStore(session.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return NextResponse.json(await getStoreAdminCatalog());
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر جلب إدارة المتجر' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    if (!canManageStore(session.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const body = await request.json();
    const type = String(body?.type || '').trim();

    if (type === 'on-demand') return NextResponse.json({ data: await createOnDemandCatalogItem(body) }, { status: 201 });
    if (type === 'bundle') return NextResponse.json({ data: await createStoreBundle(body) }, { status: 201 });
    if (type === 'alternative') return NextResponse.json({ data: await upsertAlternative(body) }, { status: 201 });

    return NextResponse.json({ error: 'نوع غير صالح' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر حفظ بيانات المتجر' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    if (!canManageStore(session.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const body = await request.json();
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 });
    if (body?.type === 'bundle') return NextResponse.json({ data: await updateStoreBundle(id, body) });
    return NextResponse.json({ data: await updateCatalogItem(id, body) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر تحديث المادة' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    if (!canManageStore(session.role)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const id = String(request.nextUrl.searchParams.get('id') || '').trim();
    const type = String(request.nextUrl.searchParams.get('type') || '').trim();
    if (!id || type !== 'bundle') return NextResponse.json({ error: 'بيانات الحذف غير مكتملة' }, { status: 400 });
    await deleteStoreBundle(id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر حذف البكج' }, { status: 400 });
  }
}
