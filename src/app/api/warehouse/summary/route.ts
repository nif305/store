import { NextRequest, NextResponse } from 'next/server';
import { resolveSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const ACTION_LABELS: Record<string, string> = {
  CREATE_REQUEST: 'طلب جديد',
  ISSUE_REQUEST: 'صرف طلب',
  REJECT_REQUEST: 'رفض طلب',
  CANCEL_REQUEST: 'إلغاء طلب',
  APPROVE_RETURN: 'قبول مرتجع',
  REJECT_RETURN: 'رفض مرتجع',
  CREATE_RETURN: 'طلب إرجاع',
  ASSIGN_CUSTODY: 'تعيين عهدة',
  RETURN_CUSTODY: 'إعادة عهدة',
  UPDATE_INVENTORY: 'تحديث مخزون',
  SYNC_INVENTORY: 'مزامنة مخزون',
};

export async function GET(request: NextRequest) {
  try {
    await resolveSessionUser(request);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      pendingRequests,
      pendingRequestsList,
      pendingReturns,
      pendingReturnsList,
      lowStock,
      outOfStock,
      totalItems,
      activeCustody,
      overdueCustody,
      issuedThisMonth,
      returnsThisMonth,
      auditLogs,
      monthlyIssued,
    ] = await Promise.all([
      prisma.request.count({ where: { status: 'PENDING' } }),
      prisma.request.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 6,
        select: {
          id: true, code: true, purpose: true, createdAt: true,
          requester: { select: { fullName: true, department: true } },
          items: { select: { quantity: true } },
        },
      }),
      prisma.returnRequest.count({ where: { status: 'PENDING' } }),
      prisma.returnRequest.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: {
          id: true, code: true, createdAt: true, returnType: true,
          custody: {
            select: {
              quantity: true,
              item: { select: { name: true } },
              user: { select: { fullName: true } },
            },
          },
        },
      }),
      prisma.inventoryItem.count({ where: { availableQty: { gt: 0, lte: 5 } } }),
      prisma.inventoryItem.count({ where: { availableQty: { lte: 0 } } }),
      prisma.inventoryItem.count({}),
      prisma.custodyRecord.count({ where: { status: 'ACTIVE' } }),
      prisma.custodyRecord.count({ where: { status: 'OVERDUE' } }),
      prisma.request.count({ where: { status: 'ISSUED', processedAt: { gte: startOfMonth } } }),
      prisma.returnRequest.count({ where: { status: 'APPROVED', processedAt: { gte: startOfMonth } } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true, action: true, entity: true, entityId: true, createdAt: true,
          user: { select: { fullName: true } },
          details: true,
        },
      }),
      prisma.request.findMany({
        where: { status: 'ISSUED', createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
      }),
    ]);

    // Build 6-month trend
    const now = new Date();
    const monthlyMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      monthlyMap.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
    }
    for (const r of monthlyIssued) {
      const key = `${r.createdAt.getFullYear()}-${r.createdAt.getMonth()}`;
      if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
    }
    const monthlyTrend = Array.from(monthlyMap.entries()).map(([key, count]) => {
      const [, month] = key.split('-').map(Number);
      return { month: AR_MONTHS[month], count };
    });

    // Format audit logs
    const formattedLogs = auditLogs.map((log) => ({
      id: log.id,
      action: ACTION_LABELS[log.action] || log.action,
      entity: log.entity,
      entityId: log.entityId,
      createdAt: log.createdAt.toISOString(),
      userName: log.user?.fullName || 'النظام',
    }));

    return NextResponse.json({
      pendingRequests,
      pendingRequestsList,
      pendingReturns,
      pendingReturnsList,
      lowStock,
      outOfStock,
      totalItems,
      activeCustody,
      overdueCustody,
      issuedThisMonth,
      returnsThisMonth,
      monthlyTrend,
      auditLogs: formattedLogs,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'تعذر جلب بيانات المستودع' }, { status: 401 });
  }
}
