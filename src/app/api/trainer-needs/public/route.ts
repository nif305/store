import { NextRequest, NextResponse } from 'next/server';
import { createTrainerNeed } from '@/services/training-store.service';

const MAX_LEN = { name: 200, course: 500, note: 1000 };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'البيانات مطلوبة' }, { status: 400 });
    }

    // Required fields
    if (!body.trainerName?.toString().trim() || !body.courseName?.toString().trim()) {
      return NextResponse.json({ error: 'اسم المدرب واسم الدورة مطلوبان' }, { status: 400 });
    }

    // Length limits
    if (body.trainerName.length > MAX_LEN.name || body.courseName.length > MAX_LEN.course) {
      return NextResponse.json({ error: 'البيانات تتجاوز الحد المسموح' }, { status: 400 });
    }

    const traineeCount = Number(body.traineeCount);
    if (!Number.isFinite(traineeCount) || traineeCount < 1 || traineeCount > 500) {
      return NextResponse.json({ error: 'عدد المتدربين غير صالح' }, { status: 400 });
    }

    const need = await createTrainerNeed(body);
    return NextResponse.json({ data: need }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'تعذر إرسال احتياج المدرب' }, { status: 400 });
  }
}
