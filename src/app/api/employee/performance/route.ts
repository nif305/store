import { NextRequest, NextResponse } from 'next/server';
import { resolveSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const userId = session.id;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      requests,
      custodyRows,
      returnRows,
      trainerNeedsAssigned,
    ] = await Promise.all([
      prisma.request.findMany({
        where: { requesterId: userId, createdAt: { gte: sixMonthsAgo } },
        select: { id: true, status: true, createdAt: true, items: { select: { quantity: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.custodyRecord.findMany({
        where: { userId },
        select: { status: true },
      }),
      prisma.returnRequest.findMany({
        where: { custody: { is: { userId } } },
        select: { status: true, createdAt: true },
      }),
      prisma.trainerNeed.count({
        where: { assignedToId: userId, status: { notIn: ['CONVERTED_TO_REQUEST', 'CANCELLED'] } },
      }),
    ]);

    // Request stats
    const reqByStatus = { pending: 0, issued: 0, returned: 0, rejected: 0 };
    for (const r of requests) {
      if (r.status === 'PENDING' || r.status === 'APPROVED') reqByStatus.pending++;
      else if (r.status === 'ISSUED') reqByStatus.issued++;
      else if (r.status === 'RETURNED') reqByStatus.returned++;
      else if (r.status === 'REJECTED') reqByStatus.rejected++;
    }
    const totalReq = requests.length;
    const fulfillmentRate = totalReq > 0 ? Math.round(((reqByStatus.issued + reqByStatus.returned) / totalReq) * 100) : 0;
    const totalUnitsRequested = requests.reduce((s, r) => s + r.items.reduce((si, i) => si + (i.quantity || 0), 0), 0);

    // Monthly trend (last 6 months)
    const now = new Date();
    const monthlyMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      monthlyMap.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
    }
    for (const r of requests) {
      const key = `${r.createdAt.getFullYear()}-${r.createdAt.getMonth()}`;
      if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
    }
    const monthlyTrend = Array.from(monthlyMap.entries()).map(([key, count]) => {
      const [year, month] = key.split('-').map(Number);
      return { month: AR_MONTHS[month], year, count };
    });

    // Custody stats
    const custodyByStatus: Record<string, number> = {};
    for (const row of custodyRows) {
      custodyByStatus[row.status] = (custodyByStatus[row.status] || 0) + 1;
    }
    const activeCustody = (custodyByStatus['ACTIVE'] || 0) + (custodyByStatus['OVERDUE'] || 0) + (custodyByStatus['RETURN_REQUESTED'] || 0);
    const overdueCustody = custodyByStatus['OVERDUE'] || 0;

    // Returns stats
    const returnByStatus = { pending: 0, approved: 0, rejected: 0 };
    for (const r of returnRows) {
      if (r.status === 'PENDING') returnByStatus.pending++;
      else if (r.status === 'APPROVED') returnByStatus.approved++;
      else if (r.status === 'REJECTED') returnByStatus.rejected++;
    }

    return NextResponse.json({
      totalRequests: totalReq,
      totalUnitsRequested,
      fulfillmentRate,
      requestsByStatus: reqByStatus,
      monthlyTrend,
      custody: { active: activeCustody, overdue: overdueCustody, returned: custodyByStatus['RETURNED'] || 0 },
      returns: returnByStatus,
      trainerNeedsAssigned,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'تعذر جلب بيانات الأداء' }, { status: 401 });
  }
}
