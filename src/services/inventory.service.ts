import {
  ItemStatus,
  ItemType,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getInventorySearchTerms } from '@/lib/inventoryLocalization';
import { hideInventoryItemFromStore, syncInventoryItemWithStore } from '@/services/training-store.service';

type InventoryFilters = {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  type?: string;
  onlyAvailableForRequest?: boolean;
  requestMode?: boolean;
};

type InventoryPayload = {
  code?: string;
  name: string;
  description?: string | null;
  category: string;
  subcategory?: string | null;
  type?: ItemType;
  quantity?: number;
  minStock?: number;
  unit?: string;
  location?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  unitPrice?: number | null;
  maintenanceIntervalDays?: number | null;
  nextMaintenanceDueAt?: string | Date | null;
  financialTracking?: boolean;
  sortOrder?: number;
  showInStore?: boolean;
  storeOnDemandNote?: string | null;
  storeSortOrder?: number;
};

function normalizeNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Math.floor(Number(value));
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function normalizeNullableDate(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calculateStatus(quantity: number, minStock: number): ItemStatus {
  if (quantity <= 0) return ItemStatus.OUT_OF_STOCK;
  if (quantity <= minStock) return ItemStatus.LOW_STOCK;
  return ItemStatus.AVAILABLE;
}

function calculateTotalPrice(quantity: number, unitPrice: number | null) {
  if (unitPrice === null) return null;
  return Number((quantity * unitPrice).toFixed(2));
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function resolveNextMaintenanceDueAt(intervalDays: number | null, dueAt: Date | null) {
  if (!intervalDays) return null;
  if (dueAt) return dueAt;
  return addDays(new Date(), intervalDays);
}

function toDecimal(value: number | null) {
  if (value === null) return null;
  return new Prisma.Decimal(value);
}

function normalizeCodePrefix(value: string) {
  return value
    .trim()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, 3)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') || 'GEN';
}

function getCategoryPrefix(category: string) {
  const map: Record<string, string> = {
    'معدات التدريب الأمني والدفاعي': 'SEC',
    'الإسعافات الأولية والسلامة': 'MED',
    'الواقع الافتراضي والتصوير والمحاكاة': 'VR',
    'الأجهزة التقنية والحاسب': 'TEC',
    'التجهيزات التدريبية والقاعة': 'TRN',
    'الأدوات الرياضية والتدريب البدني': 'SPT',
    'القرطاسية والمواد المكتبية': 'STA',
    'الهويات والشهادات والمطبوعات': 'IDN',
  };

  return map[category.trim()] || normalizeCodePrefix(category);
}

async function generateInventoryCode(category: string, type: ItemType) {
  const categoryPrefix = getCategoryPrefix(category);
  const typePrefix = type === ItemType.RETURNABLE ? 'R' : 'C';
  const prefix = `${categoryPrefix}-${typePrefix}-`;

  const lastItem = await prisma.inventoryItem.findFirst({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      code: true,
    },
  });

  const lastNumber = lastItem?.code
    ? Number(lastItem.code.split('-').pop() || '0')
    : 0;

  const nextNumber = String(lastNumber + 1).padStart(4, '0');
  return `${prefix}${nextNumber}`;
}

async function buildCreateData(data: InventoryPayload): Promise<Prisma.InventoryItemCreateInput> {
  const quantity = normalizeNumber(data.quantity, 0);
  const minStock = normalizeNumber(data.minStock, 5);
  const unitPrice = normalizeNullableNumber(data.unitPrice);
  const maintenanceIntervalDays = normalizeNullableInteger(data.maintenanceIntervalDays);
  const nextMaintenanceDueAt = resolveNextMaintenanceDueAt(
    maintenanceIntervalDays,
    normalizeNullableDate(data.nextMaintenanceDueAt)
  );
  const financialTracking =
    typeof data.financialTracking === 'boolean'
      ? data.financialTracking
      : unitPrice !== null;
  const itemType = data.type || ItemType.RETURNABLE;
  const generatedCode = await generateInventoryCode(data.category.trim(), itemType);

  return {
    code: generatedCode,
    name: data.name.trim(),
    description: data.description?.trim() || null,
    category: data.category.trim(),
    subcategory: data.subcategory?.trim() || null,
    type: itemType,
    quantity,
    availableQty: quantity,
    reservedQty: 0,
    minStock,
    unit: data.unit?.trim() || 'قطعة',
    maintenanceIntervalDays,
    nextMaintenanceDueAt,
    location: data.location?.trim() || null,
    notes: data.notes?.trim() || null,
    imageUrl: data.imageUrl?.trim() || null,
    financialTracking,
    unitPrice: toDecimal(unitPrice),
    totalPrice: toDecimal(calculateTotalPrice(quantity, unitPrice)),
    status: calculateStatus(quantity, minStock),
    sortOrder: normalizeNumber(data.sortOrder, 0),
  };
}

async function buildUpdateData(
  current: {
    quantity: number;
    reservedQty: number;
    minStock: number;
    unitPrice: Prisma.Decimal | null;
    category: string;
    type: ItemType;
    maintenanceIntervalDays: number | null;
    nextMaintenanceDueAt: Date | null;
  },
  data: Partial<InventoryPayload>,
): Promise<Prisma.InventoryItemUpdateInput> {
  const quantity =
    data.quantity !== undefined
      ? normalizeNumber(data.quantity, current.quantity)
      : current.quantity;

  const minStock =
    data.minStock !== undefined
      ? normalizeNumber(data.minStock, current.minStock)
      : current.minStock;

  const incomingUnitPrice =
    data.unitPrice !== undefined
      ? normalizeNullableNumber(data.unitPrice)
      : current.unitPrice !== null
        ? Number(current.unitPrice)
        : null;
  const nextMaintenanceIntervalDays =
    data.maintenanceIntervalDays !== undefined
      ? normalizeNullableInteger(data.maintenanceIntervalDays)
      : current.maintenanceIntervalDays;
  const requestedDueAt =
    data.nextMaintenanceDueAt !== undefined
      ? normalizeNullableDate(data.nextMaintenanceDueAt)
      : current.nextMaintenanceDueAt;
  const nextMaintenanceDueAt =
    !nextMaintenanceIntervalDays
      ? null
      : data.nextMaintenanceDueAt !== undefined
        ? resolveNextMaintenanceDueAt(nextMaintenanceIntervalDays, requestedDueAt)
        : data.maintenanceIntervalDays !== undefined
          ? resolveNextMaintenanceDueAt(nextMaintenanceIntervalDays, current.nextMaintenanceDueAt)
          : requestedDueAt;

  const nextCategory = data.category?.trim() || current.category;
  const nextType = data.type || current.type;

  const availableQty = Math.max(quantity - current.reservedQty, 0);
  const totalPrice = calculateTotalPrice(quantity, incomingUnitPrice);
  const financialTracking =
    typeof data.financialTracking === 'boolean'
      ? data.financialTracking
      : incomingUnitPrice !== null;

  const shouldRegenerateCode =
    (!!data.category && data.category.trim() !== current.category) ||
    (!!data.type && data.type !== current.type);

  return {
    code: shouldRegenerateCode
      ? await generateInventoryCode(nextCategory, nextType)
      : undefined,
    name: data.name?.trim(),
    description:
      data.description !== undefined ? data.description?.trim() || null : undefined,
    category: data.category?.trim(),
    subcategory:
      data.subcategory !== undefined ? data.subcategory?.trim() || null : undefined,
    type: data.type,
    quantity,
    availableQty,
    minStock,
    unit: data.unit?.trim(),
    maintenanceIntervalDays: nextMaintenanceIntervalDays,
    nextMaintenanceDueAt,
    location: data.location !== undefined ? data.location?.trim() || null : undefined,
    notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
    imageUrl: data.imageUrl !== undefined ? data.imageUrl?.trim() || null : undefined,
    financialTracking,
    unitPrice: toDecimal(incomingUnitPrice),
    totalPrice: toDecimal(totalPrice),
    status: calculateStatus(availableQty, minStock),
    sortOrder:
      data.sortOrder !== undefined
        ? normalizeNumber(data.sortOrder, 0)
        : undefined,
  };
}

export const InventoryService = {
  create: async (data: InventoryPayload) => {
    const item = await prisma.inventoryItem.create({
      data: await buildCreateData(data),
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE_INVENTORY',
        entity: 'InventoryItem',
        entityId: item.id,
        details: JSON.stringify({
          code: item.code,
          name: item.name,
          category: item.category,
          type: item.type,
        }),
      },
    });

    await syncInventoryItemWithStore(item.id);

    return item;
  },

  getAll: async ({
    page = 1,
    limit = 12,
    search = '',
    category = '',
    status = '',
    type = '',
    onlyAvailableForRequest = false,
    requestMode = false,
  }: InventoryFilters) => {
    const skip = (page - 1) * limit;
    const requestOnly = onlyAvailableForRequest || requestMode;
    const searchTerms = getInventorySearchTerms(search);

    const where: Prisma.InventoryItemWhereInput = {
      AND: [
        searchTerms.length
          ? {
              OR: searchTerms.flatMap((term) => [
                { name: { contains: term, mode: 'insensitive' as const } },
                { code: { contains: term, mode: 'insensitive' as const } },
                { category: { contains: term, mode: 'insensitive' as const } },
                { subcategory: { contains: term, mode: 'insensitive' as const } },
                { location: { contains: term, mode: 'insensitive' as const } },
              ]),
            }
          : {},
        category ? { category } : {},
        status ? { status: status as ItemStatus } : {},
        type ? { type: type as ItemType } : {},
        requestOnly
          ? {
              availableQty: { gte: 0 },
            }
          : {},
      ],
    };

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        include: {
          storeCatalogItems: {
            where: { isOnDemand: false },
            take: 1,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              isVisible: true,
              imageUrl: true,
              onDemandNote: true,
              sortOrder: true,
            },
          },
          _count: {
            select: {
              custodyRecords: { where: { status: { in: ['ACTIVE', 'OVERDUE', 'RETURN_REQUESTED'] } } },
            },
          },
        },
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getById: async (id: string) =>
    prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        custodyRecords: {
          where: { status: 'ACTIVE' },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        maintenanceRequests: {
          take: 3,
          orderBy: { createdAt: 'desc' },
        },
      },
    }),

  update: async (id: string, data: Partial<InventoryPayload>) => {
    const current = await prisma.inventoryItem.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        quantity: true,
        availableQty: true,
        reservedQty: true,
        minStock: true,
        unitPrice: true,
        category: true,
        type: true,
        maintenanceIntervalDays: true,
        nextMaintenanceDueAt: true,
      },
    });

    if (!current) {
      throw new Error('الصنف غير موجود');
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: await buildUpdateData(current, data),
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_INVENTORY',
        entity: 'InventoryItem',
        entityId: id,
        details: JSON.stringify({
          before: {
            code: current.code,
            name: current.name,
            quantity: current.quantity,
            availableQty: current.availableQty,
            category: current.category,
            type: current.type,
          },
          after: {
            code: updated.code,
            name: updated.name,
            quantity: updated.quantity,
            availableQty: updated.availableQty,
            category: updated.category,
            type: updated.type,
          },
        }),
      },
    });

    const linkedCatalog = await syncInventoryItemWithStore(updated.id);
    if (
      linkedCatalog &&
      (data.showInStore !== undefined ||
        data.storeOnDemandNote !== undefined ||
        data.storeSortOrder !== undefined)
    ) {
      await prisma.storeCatalogItem.update({
        where: { id: linkedCatalog.id },
        data: {
          isVisible: data.showInStore,
          onDemandNote:
            data.storeOnDemandNote !== undefined
              ? data.storeOnDemandNote?.trim() || null
              : undefined,
          sortOrder:
            data.storeSortOrder !== undefined
              ? normalizeNumber(data.storeSortOrder, 0)
              : undefined,
        },
      });
    }

    return updated;
  },

  delete: async (id: string) => {
    const activeCustody = await prisma.custodyRecord.count({
      where: { itemId: id, status: 'ACTIVE' },
    });

    if (activeCustody > 0) {
      throw new Error('لا يمكن حذف الصنف لوجود عهد نشطة مرتبطة به');
    }

    await hideInventoryItemFromStore(id);
    await prisma.inventoryItem.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE_INVENTORY',
        entity: 'InventoryItem',
        entityId: id,
      },
    });

    return { success: true };
  },

  adjustStock: async (id: string, quantityChange: number, reason: string) => {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new Error('الصنف غير موجود');
    }

    const newQuantity = item.quantity + quantityChange;
    const newAvailable = item.availableQty + quantityChange;

    if (newQuantity < 0 || newAvailable < 0) {
      throw new Error('الكمية لا يمكن أن تكون سالبة');
    }

    const status = calculateStatus(newAvailable, item.minStock);
    const unitPrice = item.unitPrice ? Number(item.unitPrice) : null;
    const totalPrice = calculateTotalPrice(newQuantity, unitPrice);

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        quantity: newQuantity,
        availableQty: newAvailable,
        status,
        totalPrice: toDecimal(totalPrice),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'ADJUST_STOCK',
        entity: 'InventoryItem',
        entityId: id,
        details: JSON.stringify({ quantityChange, reason }),
      },
    });

    return updated;
  },

  getStats: async () => {
    const [
      total,
      available,
      lowStock,
      outOfStock,
      financialItems,
      allItems,
      returnableCount,
      consumableCount,
    ] = await Promise.all([
      prisma.inventoryItem.count(),
      prisma.inventoryItem.count({
        where: { status: ItemStatus.AVAILABLE },
      }),
      prisma.inventoryItem.count({
        where: { status: ItemStatus.LOW_STOCK },
      }),
      prisma.inventoryItem.count({
        where: { status: ItemStatus.OUT_OF_STOCK },
      }),
      prisma.inventoryItem.count({
        where: { financialTracking: true },
      }),
      prisma.inventoryItem.findMany({
        select: {
          quantity: true,
          availableQty: true,
          unitPrice: true,
          totalPrice: true,
        },
      }),
      prisma.inventoryItem.count({
        where: { type: ItemType.RETURNABLE },
      }),
      prisma.inventoryItem.count({
        where: { type: ItemType.CONSUMABLE },
      }),
    ]);

    const totalQuantity = allItems.reduce((sum, item) => sum + item.quantity, 0);

    const totalValue = allItems.reduce((sum, item) => {
      if (item.totalPrice) return sum + Number(item.totalPrice);
      if (item.unitPrice) return sum + item.quantity * Number(item.unitPrice);
      return sum;
    }, 0);

    return {
      total,
      available,
      lowStock,
      outOfStock,
      financialItems,
      totalQuantity,
      totalAvailableQuantity: allItems.reduce(
        (sum, item) => sum + Number(item.availableQty || 0),
        0,
      ),
      totalValue: Number(totalValue.toFixed(2)),
      returnableCount,
      consumableCount,
    };
  },
};
