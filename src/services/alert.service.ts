import { CustodyStatus, ItemStatus, ItemType, Role, Status } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const LOW_STOCK_REMINDER_TYPE = 'WAREHOUSE_LOW_STOCK_REMINDER';
const MAINTENANCE_REMINDER_TYPE = 'WAREHOUSE_MAINTENANCE_REMINDER';
const CUSTODY_USER_REMINDER_TYPE = 'CUSTODY_OVERDUE_REMINDER';
const CUSTODY_OPERATIONS_REMINDER_TYPE = 'CUSTODY_OVERDUE_OPERATIONS';

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Riyadh',
  }).format(value);
}

function formatIntervalLabel(days: number | null | undefined) {
  if (!days || days <= 0) return 'بحسب الجدولة المعتمدة';
  if (days === 30) return 'كل شهر';
  if (days === 60) return 'كل شهرين';
  return `كل ${days} يوم`;
}

function normalizeInventoryStatus(item: { availableQty: number; minStock: number }) {
  if (item.availableQty <= 0) return ItemStatus.OUT_OF_STOCK;
  if (item.availableQty <= item.minStock) return ItemStatus.LOW_STOCK;
  return ItemStatus.AVAILABLE;
}

function buildMaintenanceCycleKey(item: { id: string; nextMaintenanceDueAt: Date | null }) {
  if (!item.nextMaintenanceDueAt) return item.id;
  return `${item.id}|${item.nextMaintenanceDueAt.toISOString().slice(0, 10)}`;
}

async function loadWarehouseUsers() {
  return prisma.user.findMany({
    where: {
      status: Status.ACTIVE,
      roles: { has: Role.WAREHOUSE },
    },
    select: { id: true },
  });
}

async function loadCustodyOperationsUsers() {
  return prisma.user.findMany({
    where: {
      status: Status.ACTIVE,
      roles: { hasSome: [Role.MANAGER, Role.WAREHOUSE] },
    },
    select: { id: true },
  });
}

async function syncCustodyDeadlineAlerts() {
  const now = new Date();

  await prisma.custodyRecord.updateMany({
    where: {
      status: CustodyStatus.ACTIVE,
      expectedReturn: { lt: now },
    },
    data: { status: CustodyStatus.OVERDUE },
  });

  const overdueRecords = await prisma.custodyRecord.findMany({
    where: {
      status: CustodyStatus.OVERDUE,
      expectedReturn: { lt: now },
    },
    include: {
      user: {
        select: {
          fullName: true,
        },
      },
      item: {
        select: {
          code: true,
          name: true,
        },
      },
      request: {
        select: {
          code: true,
        },
      },
    },
    orderBy: { expectedReturn: 'asc' },
  });

  if (!overdueRecords.length) return [];

  const operationsUsers = await loadCustodyOperationsUsers();
  const targetIds = Array.from(
    new Set([
      ...overdueRecords.map((record) => record.userId),
      ...operationsUsers.map((user) => user.id),
    ])
  );

  const existingNotifications = await prisma.notification.findMany({
    where: {
      userId: { in: targetIds },
      type: { in: [CUSTODY_USER_REMINDER_TYPE, CUSTODY_OPERATIONS_REMINDER_TYPE] },
      entityId: { in: overdueRecords.map((record) => record.id) },
      OR: [
        { isRead: false },
        { createdAt: { gte: addDays(new Date(), -3) } },
      ],
    },
    select: {
      userId: true,
      type: true,
      entityId: true,
    },
  });

  const existingKeys = new Set(
    existingNotifications.map((item) => `${item.userId}:${item.type}:${item.entityId}`)
  );

  const toCreate = [];

  for (const record of overdueRecords) {
    const itemName = record.item?.name || 'مادة مسجلة كعهدة';
    const itemCode = record.item?.code || record.request?.code || record.id;
    const dueLabel = record.expectedReturn ? formatDate(record.expectedReturn) : 'غير محدد';
    const custodyLink = `/materials/custody?open=${record.id}`;

    const employeeKey = `${record.userId}:${CUSTODY_USER_REMINDER_TYPE}:${record.id}`;
    if (!existingKeys.has(employeeKey)) {
      toCreate.push({
        userId: record.userId,
        type: CUSTODY_USER_REMINDER_TYPE,
        title: 'تذكير بإرجاع عهدة متأخرة',
        message: `العهدة "${itemName}" برقم ${itemCode} تجاوزت موعد الإرجاع المحدد (${dueLabel}). يرجى رفع طلب إرجاع أو التواصل مع مسؤول المخزن.`,
        link: custodyLink,
        entityId: record.id,
        entityType: 'CUSTODY',
      });
    }

    for (const operationsUser of operationsUsers) {
      const operationsKey = `${operationsUser.id}:${CUSTODY_OPERATIONS_REMINDER_TYPE}:${record.id}`;
      if (existingKeys.has(operationsKey)) continue;

      toCreate.push({
        userId: operationsUser.id,
        type: CUSTODY_OPERATIONS_REMINDER_TYPE,
        title: 'عهدة متأخرة تحتاج متابعة',
        message: `العهدة "${itemName}" لدى ${record.user?.fullName || 'موظف'} تجاوزت موعد الإرجاع (${dueLabel}).`,
        link: custodyLink,
        entityId: record.id,
        entityType: 'CUSTODY',
      });
    }
  }

  if (toCreate.length) {
    await prisma.notification.createMany({ data: toCreate });
  }

  return overdueRecords;
}

export const AlertService = {
  checkLowStock: async () => {
    const warehouseUsers = await loadWarehouseUsers();
    if (!warehouseUsers.length) return [];

    const items = await prisma.inventoryItem.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        availableQty: true,
        minStock: true,
        unit: true,
      },
    });

    const normalizedItems = await Promise.all(
      items.map(async (item) => {
        const nextStatus = normalizeInventoryStatus(item);
        if (item.status !== nextStatus) {
          await prisma.inventoryItem.update({
            where: { id: item.id },
            data: { status: nextStatus },
          });
        }

        return { ...item, status: nextStatus };
      })
    );

    const lowStockItems = normalizedItems.filter((item) => item.availableQty <= item.minStock);
    if (!lowStockItems.length) return [];

    const existingNotifications = await prisma.notification.findMany({
      where: {
        userId: { in: warehouseUsers.map((user) => user.id) },
        type: LOW_STOCK_REMINDER_TYPE,
        entityId: { in: lowStockItems.map((item) => item.id) },
        OR: [
          { isRead: false },
          { createdAt: { gte: addDays(new Date(), -7) } },
        ],
      },
      select: {
        userId: true,
        entityId: true,
      },
    });

    const existingKeys = new Set(
      existingNotifications.map((item) => `${item.userId}:${item.entityId}`)
    );

    const toCreate = warehouseUsers.flatMap((user) =>
      lowStockItems
        .filter((item) => !existingKeys.has(`${user.id}:${item.id}`))
        .map((item) => ({
          userId: user.id,
          type: LOW_STOCK_REMINDER_TYPE,
          title: item.status === ItemStatus.OUT_OF_STOCK ? 'مادة نافدة من المخزون' : 'مادة منخفضة المخزون',
          message:
            item.status === ItemStatus.OUT_OF_STOCK
              ? `المادة "${item.name}" نفدت تمامًا من المخزون.`
              : `المادة "${item.name}" انخفض رصيدها إلى ${item.availableQty} ${item.unit} والحد الأدنى ${item.minStock}.`,
          link: '/materials/inventory',
          entityId: item.id,
          entityType: 'inventory',
        }))
    );

    if (toCreate.length) {
      await prisma.notification.createMany({ data: toCreate });
    }

    return lowStockItems;
  },

  checkMaintenanceNeeds: async () => {
    const warehouseUsers = await loadWarehouseUsers();
    if (!warehouseUsers.length) return [];

    const dueItems = await prisma.inventoryItem.findMany({
      where: {
        type: ItemType.RETURNABLE,
        maintenanceIntervalDays: { not: null },
        nextMaintenanceDueAt: { lte: new Date() },
      },
      select: {
        id: true,
        name: true,
        maintenanceIntervalDays: true,
        nextMaintenanceDueAt: true,
      },
      orderBy: { nextMaintenanceDueAt: 'asc' },
    });

    if (!dueItems.length) return [];

    const cycleKeys = dueItems.map((item) => buildMaintenanceCycleKey(item));
    const existingNotifications = await prisma.notification.findMany({
      where: {
        userId: { in: warehouseUsers.map((user) => user.id) },
        type: MAINTENANCE_REMINDER_TYPE,
        entityId: { in: cycleKeys },
        OR: [
          { isRead: false },
          { createdAt: { gte: addDays(new Date(), -7) } },
        ],
      },
      select: {
        userId: true,
        entityId: true,
      },
    });

    const existingKeys = new Set(
      existingNotifications.map((item) => `${item.userId}:${item.entityId}`)
    );

    const toCreate = warehouseUsers.flatMap((user) =>
      dueItems
        .filter((item) => !existingKeys.has(`${user.id}:${buildMaintenanceCycleKey(item)}`))
        .map((item) => ({
          userId: user.id,
          type: MAINTENANCE_REMINDER_TYPE,
          title: 'موعد صيانة دورية مستحق',
          message: `حان موعد الصيانة الدورية للمادة "${item.name}" والمجدولة ${formatIntervalLabel(item.maintenanceIntervalDays)}.`,
          link: '/materials/inventory',
          entityId: buildMaintenanceCycleKey(item),
          entityType: 'inventory',
        }))
    );

    if (toCreate.length) {
      await prisma.notification.createMany({ data: toCreate });
    }

    return dueItems;
  },

  syncWarehouseAlerts: async () => {
    const [lowStock, maintenance, custody] = await Promise.all([
      AlertService.checkLowStock(),
      AlertService.checkMaintenanceNeeds(),
      syncCustodyDeadlineAlerts(),
    ]);

    return { lowStock, maintenance, custody };
  },

  syncManagerAlerts: async () => {
    const custody = await syncCustodyDeadlineAlerts();
    return { custody };
  },

  syncUserAlerts: async () => {
    const custody = await syncCustodyDeadlineAlerts();
    return { custody };
  },
};
