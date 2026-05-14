import { NextResponse } from 'next/server';
import { getPublicCatalog } from '@/services/training-store.service';

export async function GET() {
  try {
    return NextResponse.json(await getPublicCatalog());
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر جلب متجر المواد التدريبية' }, { status: 500 });
  }
}
