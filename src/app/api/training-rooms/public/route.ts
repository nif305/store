import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/api/sanitizeError';
import { getPublicRooms } from '@/services/training-rooms.service';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      await getPublicRooms({
        startDate: request.nextUrl.searchParams.get('startDate'),
        endDate: request.nextUrl.searchParams.get('endDate'),
        traineeCount: request.nextUrl.searchParams.get('traineeCount'),
      })
    );
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeError(error, 'تعذر جلب القاعات')}, { status: 500 });
  }
}
