import { NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/api/sanitizeError';
import { getPublicCatalog } from '@/services/training-store.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(await getPublicCatalog(), {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeError(error, 'تعذر جلب متجر المواد التدريبية')}, { status: 500 });
  }
}
