import { CustodyStatus, ItemType, RequestStatus, ReturnStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function startOfCurrentYear() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
}

function resolvePeriodStart(period?: string | null) {
  const value = String(period || 'year').toLowerCase();
  const now = new Date();
  if (value === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (value === '90d') return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  if (value === 'all') return new Date(0);
  return startOfCurrentYear();
}

export const ReportService = {
  getMaterialsExecutiveSummary: async (period?: string | null) => {
    const periodStart = resolvePeriodStart(period);

    const [
      totalItems,
      lowStockItems,
      outOfStockItems,
      consumableCount,
      returnableCount,
      overdueCustody,
      requests,
      approvedReturns,
      activeCustodyCount,
      activeCustodyRows,
    ] = await Promise.all([
      prisma.inventoryItem.count(),
      prisma.inventoryItem.count({ where: { status: 'LOW_STOCK' } }),
      prisma.inventoryItem.count({ where: { status: 'OUT_OF_STOCK' } }),
      prisma.inventoryItem.count({ where: { type: 'CONSUMABLE' } }),
      prisma.inventoryItem.count({ where: { type: 'RETURNABLE' } }),
      prisma.custodyRecord.count({ where: { status: 'OVERDUE' } }),
      prisma.request.findMany({
        where: { createdAt: { gte: periodStart } },
        select: {
          id: true,
          code: true,
          status: true,
          requesterId: true,
          createdAt: true,
          requester: {
            select: {
              fullName: true,
              department: true,
            },
          },
          items: {
            select: {
              itemId: true,
              quantity: true,
              item: {
                select: {
                  code: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
        },
      }),
      prisma.returnRequest.findMany({
        where: {
          status: ReturnStatus.APPROVED,
          processedAt: { gte: periodStart },
        },
        select: {
          custody: {
            select: {
              quantity: true,
            },
          },
        },
      }),
      prisma.custodyRecord.count({
        where: {
          status: { in: [CustodyStatus.ACTIVE, CustodyStatus.RETURN_REQUESTED, CustodyStatus.OVERDUE] },
        },
      }),
      prisma.custodyRecord.findMany({
        where: {
          status: { in: [CustodyStatus.ACTIVE, CustodyStatus.RETURN_REQUESTED, CustodyStatus.OVERDUE] },
        },
        select: { quantity: true },
      }),
    ]);

    const issuedStatuses = new Set<RequestStatus>([RequestStatus.ISSUED, RequestStatus.RETURNED]);
    const issuedRequests = requests.filter((request) => issuedStatuses.has(request.status));
    const returnedRequests = requests.filter((request) => request.status === RequestStatus.RETURNED);
    const pendingRequests = requests.filter((request) => request.status === RequestStatus.PENDING).length;
    const rejectedRequests = requests.filter((request) => request.status === RequestStatus.REJECTED).length;

    const topConsumedItems = new Map<string, { itemId: string; name: string; code: string; quantity: number }>();
    const topIssuedUsers = new Map<string, { userId: string; fullName: string; department: string; quantity: number }>();
    const userConsumption = new Map<string, { userId: string; fullName: string; department: string; quantity: number }>();
    let totalIssuedQuantityYTD = 0;
    let totalConsumedQuantityYTD = 0;

    for (const request of issuedRequests) {
      let requestTotalQty = 0;
      let requestConsumableQty = 0;

      for (const row of request.items) {
        const qty = Number(row.quantity || 0);
        totalIssuedQuantityYTD += qty;
        requestTotalQty += qty;

        if (row.item?.type === ItemType.CONSUMABLE) {
          totalConsumedQuantityYTD += qty;
          requestConsumableQty += qty;
          const current = topConsumedItems.get(row.itemId) || {
            itemId: row.itemId,
            name: row.item?.name || 'مادة',
            code: row.item?.code || '-',
            quantity: 0,
          };
          current.quantity += qty;
          topConsumedItems.set(row.itemId, current);
        }
      }

      if (request.requesterId) {
        const issuedUser = topIssuedUsers.get(request.requesterId) || {
          userId: request.requesterId,
          fullName: request.requester?.fullName || '-',
          department: request.requester?.department || '-',
          quantity: 0,
        };
        issuedUser.quantity += requestTotalQty;
        topIssuedUsers.set(request.requesterId, issuedUser);

        const consumptionUser = userConsumption.get(request.requesterId) || {
          userId: request.requesterId,
          fullName: request.requester?.fullName || '-',
          department: request.requester?.department || '-',
          quantity: 0,
        };
        consumptionUser.quantity += requestConsumableQty;
        userConsumption.set(request.requesterId, consumptionUser);
      }
    }

    const totalReturnedQuantityYTD = approvedReturns.reduce(
      (sum, row) => sum + Number(row.custody?.quantity || 0),
      0
    );

    const healthPercentage =
      totalItems > 0
        ? Math.max(0, Math.round(((totalItems - lowStockItems - outOfStockItems) / totalItems) * 100))
        : 0;

    return {
      system: 'materials',
      totalItems,
      lowStockItems,
      outOfStockItems,
      consumableCount,
      returnableCount,
      overdueCustody,
      activeCustody: activeCustodyCount,
      activeCustodyQuantity: activeCustodyRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
      pendingRequests,
      rejectedRequests,
      totalIssuedRequests: issuedRequests.length,
      totalReturnedRequests: returnedRequests.length,
      totalIssuedQuantityYTD,
      totalConsumedQuantityYTD,
      totalReturnedQuantityYTD,
      healthPercentage,
      topConsumedItems: Array.from(topConsumedItems.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 10),
      topIssuedUsers: Array.from(topIssuedUsers.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 10),
      userConsumption: Array.from(userConsumption.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 20),
      requestsByStatus: {
        pending: pendingRequests,
        rejected: rejectedRequests,
        issued: issuedRequests.length,
        returned: returnedRequests.length,
      },
      recentRequests: requests
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8)
        .map((request) => ({
          id: request.id,
          code: request.code,
          status: request.status,
          requesterName: request.requester?.fullName || '-',
          department: request.requester?.department || '-',
          createdAt: request.createdAt,
          itemCount: request.items.length,
        })),
    };
  },

  getExecutiveSummary: async (_system?: string | null, period?: string | null) => {
    return ReportService.getMaterialsExecutiveSummary(period);
  },
};
