import { NextRequest, NextResponse } from 'next/server';
import { createTrainerNeed } from '@/services/training-store.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const need = await createTrainerNeed(body);
    return NextResponse.json({ data: need }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر إرسال احتياج المدرب' }, { status: 400 });
  }
}
