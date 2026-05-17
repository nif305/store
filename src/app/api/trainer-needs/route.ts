import { NextRequest, NextResponse } from 'next/server';
import { resolveSessionUser } from '@/lib/auth/session';
import {
  canManageTrainerNeeds,
  listTrainerNeedAssignees,
  listTrainerNeeds,
} from '@/services/training-store.service';

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    if (!canManageTrainerNeeds(session)) {
      return NextResponse.json({ error: 'غير مصرح بالاطلاع على احتياجات المدربين' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const [needsResult, assignees] = await Promise.all([
      listTrainerNeeds(session, {
        bucket: searchParams.get('bucket'),
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
      }),
      listTrainerNeedAssignees(),
    ]);
    return NextResponse.json({
      data: needsResult.rows,
      counts: needsResult.counts,
      pagination: needsResult.pagination,
      assignees,
      viewer: {
        id: session.id,
        role: session.roles.some((role) => String(role) === 'MANAGER')
          ? 'MANAGER'
          : session.roles.some((role) => String(role) === 'WAREHOUSE')
            ? 'WAREHOUSE'
            : session.role,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذر جلب احتياجات المدربين' }, { status: 401 });
  }
}
