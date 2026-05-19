import { NextRequest, NextResponse } from 'next/server';
import { resolveSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export async function GET(request: NextRequest) {
  try {
    await resolveSessionUser(request);

    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      // Inventory
      totalItems, availableItems, lowStockItems, outOfStockItems,
      returnableItems, consumableItems, totalInventoryValue,
      // Requests
      totalRequests, pendingRequests, issuedRequests, returnedRequests, rejectedRequests,
      requestsThisMonth, requestsLastMonth,
      // Returns
      totalReturns, pendingReturns, approvedGoodReturns, approvedDamagedReturns,
      // Custody
      activeCustody, overdueCustody, returnedCustody,
      // Users
      totalUsers, activeUsers, managerCount, warehouseCount, userCount,
      // Rooms
      totalRooms, pendingRoomBookings, approvedRoomBookings,
      // Monthly trend
      monthlyRequests,
      // Top requesters
      topRequesters,
      // Recent audit
      recentAudit,
      // Trainer needs
      pendingNeeds, convertedNeeds,
    ] = await Promise.all([
      // Inventory
      prisma.inventoryItem.count(),
      prisma.inventoryItem.count({ where: { status: 'AVAILABLE' } }),
      prisma.inventoryItem.count({ where: { status: 'LOW_STOCK' } }),
      prisma.inventoryItem.count({ where: { status: 'OUT_OF_STOCK' } }),
      prisma.inventoryItem.count({ where: { type: 'RETURNABLE' } }),
      prisma.inventoryItem.count({ where: { type: 'CONSUMABLE' } }),
      prisma.inventoryItem.aggregate({ _sum: { totalPrice: true } }),
      // Requests
      prisma.request.count(),
      prisma.request.count({ where: { status: 'PENDING' } }),
      prisma.request.count({ where: { status: 'ISSUED' } }),
      prisma.request.count({ where: { status: 'RETURNED' } }),
      prisma.request.count({ where: { status: 'REJECTED' } }),
      prisma.request.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.request.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
      // Returns
      prisma.returnRequest.count(),
      prisma.returnRequest.count({ where: { status: 'PENDING' } }),
      prisma.returnRequest.count({ where: { status: 'APPROVED', receivedType: 'GOOD' } }),
      prisma.returnRequest.count({ where: { status: 'APPROVED', receivedType: { in: ['PARTIAL_DAMAGE', 'TOTAL_DAMAGE'] } } }),
      // Custody
      prisma.custodyRecord.count({ where: { status: 'ACTIVE' } }),
      prisma.custodyRecord.count({ where: { status: 'OVERDUE' } }),
      prisma.custodyRecord.count({ where: { status: 'RETURNED' } }),
      // Users
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { roles: { has: 'MANAGER' } } }),
      prisma.user.count({ where: { roles: { has: 'WAREHOUSE' } } }),
      prisma.user.count({ where: { roles: { has: 'USER' } } }),
      // Rooms
      prisma.trainingRoom.count({ where: { isVisible: true } }),
      prisma.trainingRoomBooking.count({ where: { status: 'REQUESTED' } }),
      prisma.trainingRoomBooking.count({ where: { status: 'APPROVED' } }),
      // Monthly requests trend
      prisma.request.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true, status: true },
      }),
      // Top requesters (last 3 months)
      prisma.request.groupBy({
        by: ['requesterId'],
        where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 3, 1) } },
        _count: { _all: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      // Recent audit
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, action: true, entity: true, entityId: true,
          createdAt: true,
          user: { select: { fullName: true, roles: true } },
          details: true,
        },
      }),
      // Trainer needs
      prisma.trainerNeed.count({ where: { status: { notIn: ['CONVERTED_TO_REQUEST', 'CANCELLED'] } } }),
      prisma.trainerNeed.count({ where: { status: 'CONVERTED_TO_REQUEST' } }),
    ]);

    // Build 6-month trend
    const monthlyMap = new Map<string, { issued: number; total: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      monthlyMap.set(`${d.getFullYear()}-${d.getMonth()}`, { issued: 0, total: 0 });
    }
    for (const r of monthlyRequests) {
      const key = `${r.createdAt.getFullYear()}-${r.createdAt.getMonth()}`;
      if (monthlyMap.has(key)) {
        const entry = monthlyMap.get(key)!;
        entry.total++;
        if (r.status === 'ISSUED' || r.status === 'RETURNED') entry.issued++;
      }
    }
    const monthlyTrend = Array.from(monthlyMap.entries()).map(([key, v]) => {
      const [, month] = key.split('-').map(Number);
      return { month: AR_MONTHS[month], total: v.total, issued: v.issued };
    });

    // Resolve top requester names
    const requesterIds = topRequesters.map((r) => r.requesterId);
    const requesterUsers = await prisma.user.findMany({
      where: { id: { in: requesterIds } },
      select: { id: true, fullName: true, department: true },
    });
    const requesterMap = Object.fromEntries(requesterUsers.map((u) => [u.id, u]));
    const topRequestersList = topRequesters.map((r) => ({
      name: requesterMap[r.requesterId]?.fullName || '—',
      department: requesterMap[r.requesterId]?.department || '—',
      count: r._count._all,
    }));

    // Format audit
    const auditList = recentAudit.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      createdAt: log.createdAt.toISOString(),
      userName: log.user?.fullName || 'النظام',
      userRole: log.user?.roles?.[0] || null,
    }));

    const requestGrowth = requestsLastMonth > 0
      ? Math.round(((requestsThisMonth - requestsLastMonth) / requestsLastMonth) * 100)
      : requestsThisMonth > 0 ? 100 : 0;

    const fulfillmentRate = totalRequests > 0
      ? Math.round(((issuedRequests + returnedRequests) / totalRequests) * 100)
      : 0;

    return NextResponse.json({
      inventory: { total: totalItems, available: availableItems, lowStock: lowStockItems, outOfStock: outOfStockItems, returnable: returnableItems, consumable: consumableItems, totalValue: totalInventoryValue._sum.totalPrice || 0 },
      requests: { total: totalRequests, pending: pendingRequests, issued: issuedRequests, returned: returnedRequests, rejected: rejectedRequests, thisMonth: requestsThisMonth, lastMonth: requestsLastMonth, growth: requestGrowth, fulfillmentRate },
      returns: { total: totalReturns, pending: pendingReturns, good: approvedGoodReturns, damaged: approvedDamagedReturns },
      custody: { active: activeCustody, overdue: overdueCustody, returned: returnedCustody },
      users: { total: totalUsers, active: activeUsers, managers: managerCount, warehouse: warehouseCount, employees: userCount },
      rooms: { total: totalRooms, pending: pendingRoomBookings, approved: approvedRoomBookings },
      trainerNeeds: { pending: pendingNeeds, converted: convertedNeeds },
      monthlyTrend,
      topRequesters: topRequestersList,
      recentAudit: auditList,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'تعذر جلب تحليلات المدير' }, { status: 401 });
  }
}
