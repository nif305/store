import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/api/sanitizeError';
import { resolveSessionUser } from '@/lib/auth/session';
import { fullResyncInventoryToStore } from '@/services/training-store.service';

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    if (session.role !== 'MANAGER' && session.role !== 'WAREHOUSE') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }
    const result = await fullResyncInventoryToStore();
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeError(error, 'تعذر المزامنة')}, { status: 500 });
  }
}
