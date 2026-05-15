import { NextRequest, NextResponse } from 'next/server';
import { ReportService } from '@/services/report.service';
import { isManager, resolveSessionUser } from '@/lib/auth/session';

function resolveStatus(error: unknown) {
  const message = String((error as { message?: string })?.message || '');
  if (message.includes('تسجيل الدخول') || message.includes('الحساب') || message.includes('المستخدم')) {
    return 401;
  }
  return 500;
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    if (!isManager(session)) {
      return NextResponse.json({ error: 'غير مصرح بالاطلاع على التقارير' }, { status: 403 });
    }

    const system = request.nextUrl.searchParams.get('system');
    const period = request.nextUrl.searchParams.get('period');
    const data = await ReportService.getExecutiveSummary(system, period);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'تعذر تحميل ملخص التقارير',
      },
      { status: resolveStatus(error) }
    );
  }
}
