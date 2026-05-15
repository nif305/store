import { NextRequest, NextResponse } from 'next/server';
import { resolveSessionUser } from '@/lib/auth/session';
import {
  canManageRooms,
  createTrainingRoom,
  getRoomsAdminCatalog,
  listRoomBookings,
  updateTrainingRoom,
} from '@/services/training-rooms.service';

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    if (!canManageRooms(session)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const mode = request.nextUrl.searchParams.get('mode');
    if (mode === 'bookings') return NextResponse.json({ bookings: await listRoomBookings() });
    return NextResponse.json(await getRoomsAdminCatalog());
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر جلب القاعات' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    if (!canManageRooms(session)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const body = await request.json();
    return NextResponse.json({ data: await createTrainingRoom(body) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر إضافة القاعة' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    if (!canManageRooms(session)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const body = await request.json();
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 });
    return NextResponse.json({ data: await updateTrainingRoom(id, body) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر تحديث القاعة' }, { status: 400 });
  }
}
