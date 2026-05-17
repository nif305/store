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

    const [needs, assignees] = await Promise.all([listTrainerNeeds(session), listTrainerNeedAssignees()]);
    return NextResponse.json({
      data: needs,
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
