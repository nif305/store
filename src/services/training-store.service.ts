import {
  Role,
  StoreBundleQuantityMode,
  Status,
  StoreReservationStatus,
  TrainerNeedHandlingMode,
  TrainerNeedItemStatus,
  TrainerNeedStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { RequestService } from '@/services/request.service';
import type { SessionUser } from '@/lib/auth/session';
import { assertRoomsAvailable, ensureTrainingRoomsSeed } from '@/services/training-rooms.service';

const ON_DEMAND_NOTE = 'غير متوفر في المخزن، سيتم محاولة توفيره بناء على الطلب.';

const ON_DEMAND_ITEMS = [
  'لابتوب تدريبي',
  'شاحن لابتوب احتياطي',
  'وصلة HDMI',
  'محول USB-C متعدد المنافذ',
  'جهاز عرض متنقل',
  'حقيبة مدرب خاصة',
  'ملصقات نشاط تدريبي',
  'بطاقات تصويت',
  'شرائح USB',
  'حامل لوحات متنقل',
  'مؤقت تدريب',
  'بطاقات لعب أدوار',
  'أدوات تقسيم مجموعات',
  'نماذج تقييم مطبوعة',
  'شهادات خاصة',
  'لوحات كانبان',
  'مكبر صوت محمول',
  'ميكروفون لاسلكي',
  'كروت أسماء فاخرة',
  'حقيبة مستلزمات طارئة',
];

const PER_TRAINEE_KEYWORDS = ['قلم', 'أقلام', 'نوت', 'دفتر', 'دفاتر', 'فولدر', 'ملف'];
const EXCLUDED_DEFAULT_BUNDLE_KEYWORDS = ['شهادة', 'شهادات', 'غلاف', 'أغلفة'];
const DEFAULT_PER_TRAINEE_GROUPS = [
  ['قلم رصاص', 'أقلام', 'اقلام', 'قلم'],
  ['نوته', 'نوت', 'دفتر'],
  ['ملفات', 'فولدر', 'ملف'],
];
const TRAINER_NEEDS_DEFAULT_LIMIT = 5;
const TRAINER_NEEDS_MAX_LIMIT = 10;

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function normalizeQty(value: unknown) {
  const qty = Math.floor(Number(value || 0));
  return Number.isFinite(qty) ? Math.max(0, qty) : 0;
}

function normalizePage(value: unknown) {
  const page = Math.floor(Number(value || 1));
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function normalizeTrainerNeedsLimit(value: unknown) {
  const limit = Math.floor(Number(value || TRAINER_NEEDS_DEFAULT_LIMIT));
  if (!Number.isFinite(limit)) return TRAINER_NEEDS_DEFAULT_LIMIT;
  return Math.min(Math.max(limit, TRAINER_NEEDS_DEFAULT_LIMIT), TRAINER_NEEDS_MAX_LIMIT);
}

function onDemandCategory(title: string) {
  return /لابتوب|HDMI|USB|محول|عرض|شاحن|ميكروفون|مكبر/.test(title)
    ? 'الأجهزة التقنية والحاسب'
    : 'مواد عند الطلب';
}

function publicStoreImageUrl(type: 'item' | 'bundle', id: string, version?: Date | string | null) {
  const params = new URLSearchParams({ type, id });
  if (version) params.set('v', new Date(version).getTime().toString());
  return `/api/training-store/image?${params.toString()}`;
}

export function canManageTrainerNeeds(session: Pick<SessionUser, 'role' | 'canManageTrainerNeeds'>) {
  const roles = (session as Partial<Pick<SessionUser, 'roles'>>).roles || [];
  return session.role === Role.MANAGER || session.role === Role.WAREHOUSE || roles.includes(Role.MANAGER) || roles.includes(Role.WAREHOUSE) || !!session.canManageTrainerNeeds;
}

function scoreDefaultPerTraineeTitle(title: string, group: string[]) {
  const normalized = title.trim();
  const exactIndex = group.findIndex((word) => normalized === word);
  if (exactIndex >= 0) return exactIndex;
  const containsIndex = group.findIndex((word) => normalized.includes(word));
  return containsIndex >= 0 ? 100 + containsIndex : 999;
}

async function getDefaultPerTraineeCatalogItems() {
  const words = Array.from(new Set(DEFAULT_PER_TRAINEE_GROUPS.flat()));
  const catalog = await prisma.storeCatalogItem.findMany({
    where: {
      isVisible: true,
      isOnDemand: false,
      OR: words.map((word) => ({ title: { contains: word, mode: 'insensitive' as const } })),
    },
    include: { inventoryItem: true },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  });

  return DEFAULT_PER_TRAINEE_GROUPS
    .map((group) =>
      catalog
        .filter((item) => group.some((word) => item.title.includes(word)))
        .sort((a, b) => scoreDefaultPerTraineeTitle(a.title, group) - scoreDefaultPerTraineeTitle(b.title, group))[0]
    )
    .filter(Boolean) as typeof catalog;
}

async function appendDefaultPerTraineeRows(rows: { catalogItemId: string; quantity: number; coordinatorNote?: string }[], traineeCount: number) {
  if (traineeCount <= 0) return rows;
  const defaults = await getDefaultPerTraineeCatalogItems();
  const next = [...rows];
  for (const item of defaults) {
    const existing = next.find((row) => row.catalogItemId === item.id);
    if (existing) {
      existing.quantity = Math.max(existing.quantity, traineeCount);
    } else {
      next.push({
        catalogItemId: item.id,
        quantity: traineeCount,
        coordinatorNote: 'أضيف تلقائيا حسب عدد المتدربين.',
      });
    }
  }
  return next;
}

async function ensureStoreSeed() {
  const inventoryItems = await prisma.inventoryItem.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const existingCatalog = await prisma.storeCatalogItem.findMany({
    select: { id: true, inventoryItemId: true, title: true, description: true, category: true, imageUrl: true, isOnDemand: true },
  });
  const catalogByInventory = new Set(existingCatalog.map((item) => item.inventoryItemId).filter(Boolean));
  const onDemandTitles = new Set(existingCatalog.filter((item) => item.isOnDemand).map((item) => item.title));

  const missingInventoryRows = inventoryItems.filter((item) => !catalogByInventory.has(item.id));
  if (missingInventoryRows.length) {
    await prisma.storeCatalogItem.createMany({
      data: missingInventoryRows.map((item, index) => ({
        inventoryItemId: item.id,
        title: item.name,
        description: item.description || null,
        category: item.category || 'مواد تدريبية',
        imageUrl: item.imageUrl || null,
        isVisible: true,
        isOnDemand: false,
        sortOrder: item.sortOrder || index,
      })),
      skipDuplicates: true,
    });
  }

  const existingInventoryRows = existingCatalog.filter((item) => item.inventoryItemId);
  if (existingInventoryRows.length) {
    const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));
    const rowsNeedingSync = existingInventoryRows.filter((row) => {
        const inventory = inventoryById.get(row.inventoryItemId!);
        if (!inventory) return false;
        return (
          row.title !== inventory.name ||
          (row.description || null) !== (inventory.description || null) ||
          row.category !== (inventory.category || 'مواد تدريبية')
        );
      });
    if (rowsNeedingSync.length) {
      await Promise.all(
        rowsNeedingSync.map((row) => {
          const inventory = inventoryById.get(row.inventoryItemId!)!;
        return prisma.storeCatalogItem.update({
          where: { id: row.id },
          data: {
            title: inventory.name,
            description: inventory.description || null,
            category: inventory.category || 'مواد تدريبية',
          },
        });
        })
      );
    }
  }

  const missingOnDemand = ON_DEMAND_ITEMS.filter((title) => !onDemandTitles.has(title));
  const seededOnDemandRows = existingCatalog.filter((item) => item.isOnDemand && ON_DEMAND_ITEMS.includes(item.title));
  const retiredSeedRows = existingCatalog.filter((item) => item.isOnDemand && !ON_DEMAND_ITEMS.includes(item.title));
  if (retiredSeedRows.length) {
    await prisma.storeCatalogItem.updateMany({
      where: { id: { in: retiredSeedRows.map((item) => item.id) } },
      data: { isVisible: false },
    });
  }
  const seededOnDemandRowsNeedingSync = seededOnDemandRows.filter((item) => item.category !== onDemandCategory(item.title));
  if (seededOnDemandRowsNeedingSync.length) {
    await Promise.all(
      seededOnDemandRowsNeedingSync.map((item) =>
        prisma.storeCatalogItem.update({
          where: { id: item.id },
          data: { category: onDemandCategory(item.title) },
        })
      )
    );
  }
  if (missingOnDemand.length) {
    await prisma.storeCatalogItem.createMany({
      data: missingOnDemand.map((title, index) => ({
        title,
        description: ON_DEMAND_NOTE,
        category: onDemandCategory(title),
        isVisible: true,
        isOnDemand: true,
        onDemandNote: ON_DEMAND_NOTE,
        sortOrder: 1000 + index,
      })),
      skipDuplicates: true,
    });
  }

  const bundleCount = await prisma.storeBundle.count();
  const excludedBundleItemCount = await prisma.storeBundleItem.count({
    where: {
      catalogItem: {
        OR: EXCLUDED_DEFAULT_BUNDLE_KEYWORDS.map((word) => ({ title: { contains: word, mode: 'insensitive' as const } })),
      },
    },
  });
  if (excludedBundleItemCount > 0) {
    await prisma.storeBundleItem.deleteMany({
      where: {
        catalogItem: {
          OR: EXCLUDED_DEFAULT_BUNDLE_KEYWORDS.map((word) => ({ title: { contains: word, mode: 'insensitive' as const } })),
        },
      },
    });
  }
  if (bundleCount === 0) {
    const visibleItems = await prisma.storeCatalogItem.findMany({
      where: { isVisible: true, isOnDemand: false },
      take: 12,
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });

    const bundleDefs = [
      { title: 'بكج دورة حضورية', take: 5, description: 'مجموعة تشغيلية شائعة للدورات الحضورية.' },
      { title: 'بكج ورشة تطبيقية', take: 6, description: 'مواد مناسبة للأنشطة العملية وتقسيم المجموعات.' },
      { title: 'بكج قاعة تدريب', take: 4, description: 'مواد أساسية لتجهيز القاعة قبل بداية الدورة.' },
    ];

    for (let i = 0; i < bundleDefs.length; i += 1) {
      const bundle = await prisma.storeBundle.create({
        data: {
          title: bundleDefs[i].title,
          description: bundleDefs[i].description,
          sortOrder: i,
        },
      });
      const selected = visibleItems.slice(i * 2, i * 2 + bundleDefs[i].take);
      if (selected.length) {
        await prisma.storeBundleItem.createMany({
          data: selected.map((item) => ({
            bundleId: bundle.id,
            catalogItemId: item.id,
            quantity: 1,
            quantityMode: PER_TRAINEE_KEYWORDS.some((word) => item.title.includes(word))
              ? StoreBundleQuantityMode.PER_TRAINEE
              : StoreBundleQuantityMode.FIXED,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  const perTraineeBundleCount = await prisma.storeBundleItem.count({
    where: { quantityMode: StoreBundleQuantityMode.PER_TRAINEE },
  });
  if (perTraineeBundleCount === 0) {
    const perTraineeItems = await prisma.storeCatalogItem.findMany({
      where: {
        isVisible: true,
        OR: PER_TRAINEE_KEYWORDS.map((word) => ({ title: { contains: word, mode: 'insensitive' as const } })),
      },
      take: 8,
    });
    const bundles = await prisma.storeBundle.findMany({ select: { id: true } });
    for (const bundle of bundles) {
      await prisma.storeBundleItem.createMany({
        data: perTraineeItems.map((item) => ({
          bundleId: bundle.id,
          catalogItemId: item.id,
          quantity: 1,
          quantityMode: StoreBundleQuantityMode.PER_TRAINEE,
        })),
        skipDuplicates: true,
      });
    }
  }
}

function inventoryToStoreCatalogData(item: {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  sortOrder?: number | null;
}) {
  return {
    title: item.name,
    description: item.description || null,
    category: item.category || 'مواد تدريبية',
    imageUrl: item.imageUrl || null,
    isOnDemand: false,
    sortOrder: item.sortOrder || 0,
  };
}

export async function syncInventoryItemWithStore(inventoryItemId: string) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!item) return null;
  const existing = await prisma.storeCatalogItem.findFirst({ where: { inventoryItemId: item.id } });
  if (existing) {
    return prisma.storeCatalogItem.update({
      where: { id: existing.id },
      data: {
        ...inventoryToStoreCatalogData(item),
        inventoryItemId: item.id,
      },
    });
  }
  return prisma.storeCatalogItem.create({
    data: {
      inventoryItemId: item.id,
      ...inventoryToStoreCatalogData(item),
      isVisible: true,
    },
  });
}

export async function hideInventoryItemFromStore(inventoryItemId: string) {
  await prisma.storeCatalogItem.updateMany({
    where: { inventoryItemId },
    data: { isVisible: false },
  });
}

export async function syncStoreCatalogWithInventory() {
  await ensureStoreSeed();
  const inventoryItems = await prisma.inventoryItem.findMany({ select: { id: true } });
  await Promise.all(inventoryItems.map((item) => syncInventoryItemWithStore(item.id)));
}

async function activeReservationsByInventory(inventoryIds?: string[]) {
  const rows = await prisma.storeReservation.groupBy({
    by: ['inventoryItemId'],
    where: {
      status: StoreReservationStatus.ACTIVE,
      ...(inventoryIds?.length ? { inventoryItemId: { in: inventoryIds } } : {}),
    },
    _sum: { quantity: true },
  });

  return new Map(rows.map((row) => [row.inventoryItemId, row._sum.quantity || 0]));
}

function mapCatalogItem(item: any, reservationMap: Map<string, number>, options: { publicPayload?: boolean } = {}) {
  const inventory = item.inventoryItem;
  const stockQty = inventory?.availableQty || 0;
  const temporarilyReservedQty = inventory?.id ? reservationMap.get(inventory.id) || 0 : 0;
  const freeAfterReservations = Math.max(stockQty - temporarilyReservedQty, 0);
  const rawImageUrl = item.imageUrl || inventory?.imageUrl || null;
  const imageVersion = item.imageUrl ? item.updatedAt : inventory?.updatedAt || item.updatedAt;

  return {
    id: item.id,
    inventoryItemId: item.inventoryItemId,
    title: item.title,
    description: item.description,
    category: item.category,
    imageUrl: options.publicPayload ? publicStoreImageUrl('item', item.id, imageVersion) : rawImageUrl,
    isVisible: item.isVisible,
    isOnDemand: item.isOnDemand,
    onDemandNote: item.onDemandNote || (item.isOnDemand ? ON_DEMAND_NOTE : null),
    sortOrder: item.sortOrder,
    stockQty,
    temporarilyReservedQty,
    freeAfterReservations,
    canRequestWithReservation: true,
    unit: inventory?.unit || 'قطعة',
    alternatives: (item.alternativesFrom || []).map((alt: any) => ({
      id: alt.id,
      note: alt.note,
      requiresTrainerApproval: alt.requiresTrainerApproval,
      item: alt.alternative ? mapCatalogItem({ ...alt.alternative, alternativesFrom: [] }, reservationMap, options) : null,
    })),
  };
}

export async function getPublicCatalog() {
  await ensureStoreSeed();
  const catalog = await prisma.storeCatalogItem.findMany({
    where: { isVisible: true },
    select: {
      id: true,
      inventoryItemId: true,
      title: true,
      description: true,
      category: true,
      updatedAt: true,
      isVisible: true,
      isOnDemand: true,
      onDemandNote: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  });
  const inventoryRows = await prisma.inventoryItem.findMany({
    where: { id: { in: catalog.map((item) => item.inventoryItemId).filter(Boolean) as string[] } },
    select: { id: true, availableQty: true, unit: true, updatedAt: true },
  });
  const inventoryById = new Map(inventoryRows.map((item) => [item.id, item]));
  const reservationMap = await activeReservationsByInventory(
    catalog.map((item) => item.inventoryItemId).filter(Boolean) as string[]
  );

  const items = catalog.map((item) => mapCatalogItem({ ...item, inventoryItem: item.inventoryItemId ? inventoryById.get(item.inventoryItemId) : null }, reservationMap, { publicPayload: true }));
  const categories = Array.from(new Set(items.map((item) => item.category))).sort((a, b) => a.localeCompare(b, 'ar'));
  const bundles = await prisma.storeBundle.findMany({
    where: { isVisible: true },
    select: {
      id: true,
      title: true,
      description: true,
      updatedAt: true,
      isVisible: true,
      items: {
        where: { catalogItem: { isVisible: true } },
        select: {
          catalogItemId: true,
          quantity: true,
          quantityMode: true,
          catalogItem: { select: { title: true, updatedAt: true } },
        },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  });

  return {
    categories,
    items,
    bundles: bundles.map((bundle) => ({
      id: bundle.id,
      title: bundle.title,
      description: bundle.description,
      imageUrl: publicStoreImageUrl('bundle', bundle.id, bundle.updatedAt),
      isVisible: bundle.isVisible,
      items: bundle.items.map((row) => ({
        catalogItemId: row.catalogItemId,
        quantity: row.quantity,
        quantityMode: row.quantityMode,
        title: row.catalogItem.title,
        imageUrl: publicStoreImageUrl('item', row.catalogItemId, row.catalogItem.updatedAt),
      })),
    })),
  };
}

function parseImageDataUrl(value?: string | null) {
  const imageUrl = normalizeText(value);
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('/')) {
    return { redirectUrl: imageUrl, contentType: null, bytes: null };
  }
  const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    redirectUrl: null,
    contentType: match[1],
    bytes: Buffer.from(match[2], 'base64'),
  };
}

export async function getPublicStoreImage(type: string, id: string) {
  const normalizedType = normalizeText(type);
  const normalizedId = normalizeText(id);
  if (!normalizedId) return null;

  if (normalizedType === 'bundle') {
    const bundle = await prisma.storeBundle.findFirst({
      where: { id: normalizedId, isVisible: true },
      select: { imageUrl: true },
    });
    return parseImageDataUrl(bundle?.imageUrl);
  }

  const item = await prisma.storeCatalogItem.findFirst({
    where: { id: normalizedId, isVisible: true },
    select: {
      imageUrl: true,
      inventoryItem: { select: { imageUrl: true } },
    },
  });
  return parseImageDataUrl(item?.imageUrl || item?.inventoryItem?.imageUrl);
}

export async function getStoreAdminCatalog() {
  await ensureStoreSeed();
  const catalog = await prisma.storeCatalogItem.findMany({
    include: {
      inventoryItem: true,
      alternativesFrom: {
        include: {
          alternative: { include: { inventoryItem: true } },
        },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  });
  const reservationMap = await activeReservationsByInventory(
    catalog.map((item) => item.inventoryItemId).filter(Boolean) as string[]
  );

  const items = catalog.map((item) => mapCatalogItem(item, reservationMap));
  const categories = Array.from(new Set(items.map((item) => item.category))).sort((a, b) => a.localeCompare(b, 'ar'));
  const bundles = await prisma.storeBundle.findMany({
    include: {
      items: {
        include: {
          catalogItem: { include: { inventoryItem: true } },
        },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  });

  return {
    categories,
    items,
    bundles: bundles.map((bundle) => ({
      id: bundle.id,
      title: bundle.title,
      description: bundle.description,
      imageUrl: bundle.imageUrl,
      isVisible: bundle.isVisible,
      items: bundle.items.map((row) => ({
        catalogItemId: row.catalogItemId,
        quantity: row.quantity,
        quantityMode: row.quantityMode,
        title: row.catalogItem.title,
        imageUrl: row.catalogItem.imageUrl || row.catalogItem.inventoryItem?.imageUrl || null,
      })),
    })),
  };
}

export async function updateCatalogItem(id: string, data: any) {
  const existing = await prisma.storeCatalogItem.findUnique({
    where: { id },
    select: { inventoryItemId: true, isOnDemand: true },
  });
  if (!existing) throw new Error('المادة غير موجودة');

  if (existing.inventoryItemId && !existing.isOnDemand) {
    return prisma.storeCatalogItem.update({
      where: { id },
      data: {
        isVisible: typeof data.isVisible === 'boolean' ? data.isVisible : undefined,
        onDemandNote: normalizeText(data.onDemandNote) || null,
        sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : undefined,
      },
    });
  }

  return prisma.storeCatalogItem.update({
    where: { id },
    data: {
      title: normalizeText(data.title) || undefined,
      description: normalizeText(data.description) || null,
      category: normalizeText(data.category) || undefined,
      imageUrl: normalizeText(data.imageUrl || data.imageDataUrl) || null,
      isVisible: typeof data.isVisible === 'boolean' ? data.isVisible : undefined,
      onDemandNote: normalizeText(data.onDemandNote) || null,
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : undefined,
    },
  });
}

export async function createOnDemandCatalogItem(data: any) {
  const title = normalizeText(data.title);
  if (!title) throw new Error('اسم المادة مطلوب');

  return prisma.storeCatalogItem.create({
    data: {
      title,
      description: normalizeText(data.description) || ON_DEMAND_NOTE,
      category: normalizeText(data.category) || 'مواد عند الطلب',
      imageUrl: normalizeText(data.imageUrl) || null,
      isVisible: true,
      isOnDemand: true,
      onDemandNote: normalizeText(data.onDemandNote) || ON_DEMAND_NOTE,
      sortOrder: 1200,
    },
  });
}

export async function createTrainerNeed(data: any) {
  await ensureStoreSeed();
  await ensureTrainingRoomsSeed();

  const trainerName = normalizeText(data.trainerName);
  const courseName = normalizeText(data.courseName);
  const traineeCount = normalizeQty(data.traineeCount);
  const startDate = data.startDate ? new Date(data.startDate) : null;
  const endDate = data.endDate ? new Date(data.endDate) : null;
  const requestedRoomId = normalizeText(data.roomId || data.requestedRoomId);
  const requestedLayout = normalizeText(data.requestedLayout);
  const roomSelections = Array.isArray(data.roomSelections)
    ? data.roomSelections
        .map((row: any) => ({
          roomId: normalizeText(row.roomId),
          layout: normalizeText(row.layout),
          startDate: normalizeText(row.startDate),
          endDate: normalizeText(row.endDate),
        }))
        .filter((row: any) => row.roomId)
    : [];
  const primaryRoomId = roomSelections[0]?.roomId || requestedRoomId;
  let rows = Array.isArray(data.items)
    ? data.items
        .map((item: any) => ({ catalogItemId: normalizeText(item.catalogItemId), quantity: normalizeQty(item.quantity) }))
        .filter((item: any) => item.catalogItemId && item.quantity > 0)
    : [];

  if (!trainerName || !courseName || !startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime())) {
    throw new Error('بيانات الدورة الأساسية غير مكتملة');
  }
  if (!rows.length) throw new Error('يجب اختيار مادة واحدة على الأقل');
  rows = await appendDefaultPerTraineeRows(rows, traineeCount);

  const catalog = await prisma.storeCatalogItem.findMany({
    where: { id: { in: rows.map((item: any) => item.catalogItemId) }, isVisible: true },
    include: { inventoryItem: true },
  });
  const byId = new Map(catalog.map((item) => [item.id, item]));
  if (catalog.length !== rows.length) throw new Error('توجد مادة غير متاحة في المتجر');
  let requestedRoom = null;
  if (primaryRoomId) {
    const requestedRoomIds = Array.from(new Set([primaryRoomId, ...roomSelections.map((row: any) => row.roomId)].filter(Boolean)));
    const availableRooms = await prisma.trainingRoom.findMany({
      where: { id: { in: requestedRoomIds }, isVisible: true },
      select: { id: true },
    });
    if (availableRooms.length !== requestedRoomIds.length) throw new Error('توجد قاعة محددة غير متاحة');
    requestedRoom = availableRooms[0] || null;
    const roomAvailabilitySelections = (roomSelections.length
      ? roomSelections
      : [{ roomId: primaryRoomId, layout: requestedLayout, startDate: startDate.toISOString(), endDate: (endDate || startDate).toISOString() }]
    ).map((row: any) => ({
      roomId: row.roomId,
      startDate: row.startDate ? new Date(row.startDate) : startDate,
      endDate: row.endDate ? new Date(row.endDate) : (endDate || startDate),
    }));
    await assertRoomsAvailable(roomAvailabilitySelections);
  }

  const count = await prisma.trainerNeed.count();
  const code = `TN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

  const need = await prisma.$transaction(async (tx) => {
    const created = await tx.trainerNeed.create({
      data: {
        code,
        trainerName,
        courseName,
        traineeCount,
        startDate,
        endDate,
        status: TrainerNeedStatus.NEW,
        items: {
          create: rows.map((row: any) => {
            const item = byId.get(row.catalogItemId)!;
            const available = item.inventoryItem?.availableQty || 0;
            const shortage = item.inventoryItemId ? Math.max(row.quantity - available, 0) : row.quantity;
            return {
              catalogItemId: item.id,
              inventoryItemId: item.inventoryItemId,
              title: item.title,
              requestedQty: row.quantity,
              availableAtSubmission: available,
              shortageQty: shortage,
              status: item.isOnDemand
                ? TrainerNeedItemStatus.ON_DEMAND
                : shortage > 0
                  ? TrainerNeedItemStatus.SHORTAGE
                  : TrainerNeedItemStatus.AVAILABLE,
              handlingMode: item.isOnDemand
                ? TrainerNeedHandlingMode.TRY_TO_PROVIDE
                : shortage > 0
                  ? TrainerNeedHandlingMode.INTERNAL_SOURCE
                  : TrainerNeedHandlingMode.RESERVE_FROM_STOCK,
            };
          }),
        },
      },
      include: { items: true },
    });
    if (primaryRoomId) {
      await tx.trainingRoomBooking.create({
        data: {
          trainerNeedId: created.id,
          requestedRoomId: primaryRoomId,
          requestedLayout: roomSelections[0]?.layout || requestedLayout || null,
          requestedPlan: roomSelections.length ? roomSelections : undefined,
          startDate,
          endDate: endDate || startDate,
        },
      });
    }
    return created;
  });

  const targets = await prisma.user.findMany({
    where: {
      status: Status.ACTIVE,
      OR: [
        { roles: { hasSome: [Role.MANAGER, Role.WAREHOUSE] } },
        { canManageTrainerNeeds: true },
      ],
    },
    select: { id: true },
  });
  if (targets.length) {
    await prisma.notification.createMany({
      data: targets.map((user) => ({
        userId: user.id,
        type: 'TRAINER_NEED',
        title: 'احتياج مدرب جديد',
        message: `تم رفع احتياج تجهيز دورة برقم ${need.code}`,
        link: `/materials/trainer-needs?open=${need.id}`,
        entityId: need.id,
        entityType: 'TRAINER_NEED',
      })),
    });
  }

  return need;
}

function includeNeed() {
  return {
    assignedTo: { select: { id: true, fullName: true, department: true, email: true } },
    linkedRequest: { select: { id: true, code: true, status: true } },
    roomBooking: {
      include: {
        requestedRoom: true,
        approvedRoom: true,
      },
    },
    items: {
      include: {
        inventoryItem: true,
        catalogItem: {
          include: {
            alternativesFrom: {
              include: {
                alternative: { include: { inventoryItem: true } },
              },
            },
          },
        },
        reservations: true,
      },
      orderBy: { createdAt: 'asc' as const },
    },
  };
}

async function mapNeed(need: any) {
  const inventoryIds = need.items.map((item: any) => item.inventoryItemId).filter(Boolean);
  const reservationMap = await activeReservationsByInventory(inventoryIds);
  return {
    ...need,
    items: need.items.map((item: any) => {
      const stockQty = item.inventoryItem?.availableQty || 0;
      const temporarilyReservedQty = item.inventoryItemId ? reservationMap.get(item.inventoryItemId) || 0 : 0;
      return {
        ...item,
        stockQty,
        temporarilyReservedQty,
        freeAfterReservations: Math.max(stockQty - temporarilyReservedQty, 0),
        canRequestWithReservation: true,
        alternatives: (item.catalogItem?.alternativesFrom || []).map((alt: any) => ({
          id: alt.id,
          note: alt.note,
          item: alt.alternative,
        })),
      };
    }),
  };
}

function trainerNeedsBucketWhere(bucket: unknown) {
  const doneStatuses = [TrainerNeedStatus.CONVERTED_TO_REQUEST, TrainerNeedStatus.CANCELLED];
  if (bucket === 'done') return { status: { in: doneStatuses } };
  if (bucket === 'active') {
    return {
      status: { notIn: [...doneStatuses, TrainerNeedStatus.NEW, TrainerNeedStatus.IN_REVIEW] },
      assignedToId: { not: null },
    };
  }
  return {
    status: { notIn: doneStatuses },
    OR: [{ assignedToId: null }, { status: { in: [TrainerNeedStatus.NEW, TrainerNeedStatus.IN_REVIEW] } }],
  };
}

export async function listTrainerNeeds(
  session?: Pick<SessionUser, 'id' | 'role'> & Partial<Pick<SessionUser, 'roles'>>,
  options: { bucket?: string | null; page?: unknown; limit?: unknown } = {}
) {
  const roles = session?.roles || [];
  const canSeeAll = !session || session.role === Role.MANAGER || session.role === Role.WAREHOUSE || roles.includes(Role.MANAGER) || roles.includes(Role.WAREHOUSE);
  const page = normalizePage(options.page);
  const limit = normalizeTrainerNeedsLimit(options.limit);
  const skip = (page - 1) * limit;
  const visibilityWhere = canSeeAll
    ? {}
    : {
        OR: [
          { assignedToId: null },
          { assignedToId: session.id },
        ],
      };
  const bucket = options.bucket === 'active' || options.bucket === 'done' ? options.bucket : 'pending';
  const where = { AND: [visibilityWhere, trainerNeedsBucketWhere(bucket)] };
  const [needs, total, pending, active, done] = await Promise.all([
    prisma.trainerNeed.findMany({
      where,
      include: includeNeed(),
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.trainerNeed.count({ where }),
    prisma.trainerNeed.count({ where: { AND: [visibilityWhere, trainerNeedsBucketWhere('pending')] } }),
    prisma.trainerNeed.count({ where: { AND: [visibilityWhere, trainerNeedsBucketWhere('active')] } }),
    prisma.trainerNeed.count({ where: { AND: [visibilityWhere, trainerNeedsBucketWhere('done')] } }),
  ]);
  const rows = await Promise.all(needs.map(mapNeed));

  return {
    rows,
    counts: { pending, active, done },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getTrainerNeed(id: string) {
  const need = await prisma.trainerNeed.findUnique({ where: { id }, include: includeNeed() });
  if (!need) throw new Error('احتياج المدرب غير موجود');
  return mapNeed(need);
}

export async function listTrainerNeedAssignees() {
  const users = await prisma.user.findMany({
    where: {
      status: Status.ACTIVE,
      OR: [{ roles: { hasSome: [Role.MANAGER, Role.WAREHOUSE] } }, { canManageTrainerNeeds: true }],
    },
    select: { id: true, fullName: true, department: true, email: true, roles: true, canManageTrainerNeeds: true },
    orderBy: { fullName: 'asc' },
  });
  return users;
}

export async function assignTrainerNeed(id: string, assignedToId: string | null) {
  const need = await prisma.trainerNeed.update({
    where: { id },
    data: {
      assignedToId: assignedToId || null,
      status: assignedToId ? TrainerNeedStatus.ASSIGNED : TrainerNeedStatus.IN_REVIEW,
    },
    include: includeNeed(),
  });
  return mapNeed(need);
}

export async function updateTrainerNeedOrder(id: string, data: any) {
  const need = await prisma.trainerNeed.findUnique({ where: { id }, include: includeNeed() });
  if (!need) throw new Error('احتياج المدرب غير موجود');
  if (need.linkedRequestId || need.status === TrainerNeedStatus.CONVERTED_TO_REQUEST) {
    throw new Error('لا يمكن تعديل الطلب بعد تحويله إلى طلب مواد');
  }

  const nextTraineeCount = data.traineeCount === undefined ? need.traineeCount : normalizeQty(data.traineeCount);
  let rows = Array.isArray(data.items)
    ? data.items
        .map((item: any) => ({
          catalogItemId: normalizeText(item.catalogItemId),
          quantity: normalizeQty(item.requestedQty ?? item.quantity),
          coordinatorNote: normalizeText(item.coordinatorNote),
        }))
        .filter((item: any) => item.catalogItemId && item.quantity > 0)
    : [];

  if (!rows.length) throw new Error('يجب أن يحتوي الطلب على مادة واحدة على الأقل');
  rows = await appendDefaultPerTraineeRows(rows, nextTraineeCount);

  const catalogIds: string[] = Array.from(new Set(rows.map((item: any) => String(item.catalogItemId))));
  const catalog: any[] = await prisma.storeCatalogItem.findMany({
    where: { id: { in: catalogIds }, isVisible: true },
    include: { inventoryItem: true },
  });
  const byId = new Map(catalog.map((item) => [item.id, item]));
  if (catalog.length !== catalogIds.length) throw new Error('توجد مادة غير متاحة في المتجر');

  await prisma.$transaction(async (tx) => {
    await tx.storeReservation.updateMany({
      where: { needItemId: { in: need.items.map((item: any) => item.id) }, status: StoreReservationStatus.ACTIVE },
      data: { status: StoreReservationStatus.RELEASED, releasedAt: new Date() },
    });
    await tx.trainerNeedItem.deleteMany({ where: { needId: id } });
    await tx.trainerNeedItem.createMany({
      data: rows.map((row: any) => {
        const item = byId.get(row.catalogItemId)!;
        const available = item.inventoryItem?.availableQty || 0;
        const shortage = item.inventoryItemId ? Math.max(row.quantity - available, 0) : row.quantity;
        return {
          needId: id,
          catalogItemId: item.id,
          inventoryItemId: item.inventoryItemId,
          title: item.title,
          requestedQty: row.quantity,
          approvedQty: row.quantity,
          availableAtSubmission: available,
          reservedQty: 0,
          shortageQty: shortage,
          status: item.isOnDemand
            ? TrainerNeedItemStatus.ON_DEMAND
            : shortage > 0
              ? TrainerNeedItemStatus.SHORTAGE
              : TrainerNeedItemStatus.AVAILABLE,
          handlingMode: item.isOnDemand
            ? TrainerNeedHandlingMode.TRY_TO_PROVIDE
            : shortage > 0
              ? TrainerNeedHandlingMode.INTERNAL_SOURCE
              : TrainerNeedHandlingMode.RESERVE_FROM_STOCK,
          coordinatorNote: row.coordinatorNote || null,
        };
      }),
    });
    await tx.trainerNeed.update({
      where: { id },
      data: {
        traineeCount: nextTraineeCount,
        status: TrainerNeedStatus.IN_REVIEW,
        readinessScore: 0,
        decisionNote: normalizeText(data.decisionNote) || need.decisionNote,
      },
    });
  });

  return getTrainerNeed(id);
}

export async function proposeTrainerNeedPlan(id: string) {
  const need = await prisma.trainerNeed.findUnique({ where: { id }, include: includeNeed() });
  if (!need) throw new Error('احتياج المدرب غير موجود');
  const reservationMap = await activeReservationsByInventory(need.items.map((item) => item.inventoryItemId).filter(Boolean) as string[]);

  let readyQty = 0;
  let totalQty = 0;

  await prisma.$transaction(
    need.items.map((item: any) => {
      const requestedQty = item.requestedQty;
      totalQty += requestedQty;
      const stockQty = item.inventoryItem?.availableQty || 0;
      const activeReservedQty = item.inventoryItemId ? reservationMap.get(item.inventoryItemId) || 0 : 0;
      const freeAfterReservations = Math.max(stockQty - activeReservedQty, 0);
      const availableForThisNeed = item.inventoryItemId ? Math.min(requestedQty, stockQty) : 0;
      readyQty += availableForThisNeed;
      const shortageQty = Math.max(requestedQty - availableForThisNeed, 0);
      const hasAlternative = (item.catalogItem?.alternativesFrom || []).length > 0;
      const status =
        !item.inventoryItemId ? TrainerNeedItemStatus.ON_DEMAND :
        shortageQty === 0 ? TrainerNeedItemStatus.AVAILABLE :
        hasAlternative ? TrainerNeedItemStatus.ALTERNATIVE_PROPOSED :
        TrainerNeedItemStatus.SHORTAGE;
      const handlingMode =
        !item.inventoryItemId ? TrainerNeedHandlingMode.TRY_TO_PROVIDE :
        shortageQty === 0 ? TrainerNeedHandlingMode.RESERVE_FROM_STOCK :
        hasAlternative ? TrainerNeedHandlingMode.USE_ALTERNATIVE :
        freeAfterReservations > 0 ? TrainerNeedHandlingMode.RESERVE_FROM_STOCK :
        TrainerNeedHandlingMode.INTERNAL_SOURCE;

      return prisma.trainerNeedItem.update({
        where: { id: item.id },
        data: {
          shortageQty,
          status,
          handlingMode,
          coordinatorNote:
            activeReservedQty > 0
              ? `يوجد حجز مؤقت على نفس المادة (${activeReservedQty})، ويمكن الاستمرار بالطلب قبل الصرف النهائي.`
              : item.coordinatorNote,
        },
      });
    })
  );

  const readinessScore = totalQty ? Math.round((readyQty / totalQty) * 100) : 0;
  const updated = await prisma.trainerNeed.update({
    where: { id },
    data: { readinessScore, status: TrainerNeedStatus.PLAN_PROPOSED },
    include: includeNeed(),
  });
  return mapNeed(updated);
}

export async function reserveTrainerNeedAvailable(id: string, actorId: string) {
  const need = await prisma.trainerNeed.findUnique({ where: { id }, include: includeNeed() });
  if (!need) throw new Error('احتياج المدرب غير موجود');

  await prisma.$transaction(async (tx) => {
    for (const item of need.items) {
      await tx.storeReservation.updateMany({
        where: { needItemId: item.id, status: StoreReservationStatus.ACTIVE },
        data: { status: StoreReservationStatus.RELEASED, releasedAt: new Date() },
      });

      if (!item.inventoryItemId) continue;
      const otherReserved = await tx.storeReservation.aggregate({
        where: {
          inventoryItemId: item.inventoryItemId,
          status: StoreReservationStatus.ACTIVE,
          needItem: { needId: { not: id } },
        },
        _sum: { quantity: true },
      });
      const freeQty = Math.max((item.inventoryItem?.availableQty || 0) - (otherReserved._sum.quantity || 0), 0);
      const reserveQty = Math.min(item.requestedQty, freeQty);
      if (reserveQty > 0) {
        await tx.storeReservation.create({
          data: {
            needItemId: item.id,
            inventoryItemId: item.inventoryItemId,
            quantity: reserveQty,
            status: StoreReservationStatus.ACTIVE,
            createdById: actorId,
          },
        });
      }

      await tx.trainerNeedItem.update({
        where: { id: item.id },
        data: {
          reservedQty: reserveQty,
          shortageQty: Math.max(item.requestedQty - reserveQty, 0),
          status: reserveQty >= item.requestedQty ? TrainerNeedItemStatus.RESERVED : TrainerNeedItemStatus.SHORTAGE,
          handlingMode: reserveQty >= item.requestedQty ? TrainerNeedHandlingMode.RESERVE_FROM_STOCK : item.handlingMode,
        },
      });
    }
  });

  const updated = await prisma.trainerNeed.findUnique({ where: { id }, include: includeNeed() });
  const hasShortage = !!updated?.items.some((item) => item.shortageQty > 0 || !item.inventoryItemId);
  const saved = await prisma.trainerNeed.update({
    where: { id },
    data: { status: hasShortage ? TrainerNeedStatus.SHORTAGE_IN_PROGRESS : TrainerNeedStatus.RESERVED_AVAILABLE },
    include: includeNeed(),
  });
  return mapNeed(saved);
}

export async function releaseTrainerNeedReservations(id: string, status: TrainerNeedStatus = TrainerNeedStatus.CANCELLED) {
  await prisma.$transaction(async (tx) => {
    const need = await tx.trainerNeed.findUnique({ where: { id }, include: { items: true } });
    if (!need) throw new Error('احتياج المدرب غير موجود');
    await tx.storeReservation.updateMany({
      where: { needItemId: { in: need.items.map((item) => item.id) }, status: StoreReservationStatus.ACTIVE },
      data: { status: StoreReservationStatus.CANCELLED, releasedAt: new Date() },
    });
    await tx.trainerNeedItem.updateMany({
      where: { needId: id },
      data: { status: TrainerNeedItemStatus.CANCELLED },
    });
    await tx.trainerNeed.update({ where: { id }, data: { status } });
  });
  return getTrainerNeed(id);
}

export async function deleteTrainerNeed(id: string) {
  const need = await prisma.trainerNeed.findUnique({
    where: { id },
    select: { id: true, linkedRequestId: true, status: true, items: { select: { id: true } } },
  });
  if (!need) throw new Error('طلب المدرب غير موجود');
  if (need.linkedRequestId || need.status === TrainerNeedStatus.CONVERTED_TO_REQUEST) {
    throw new Error('لا يمكن حذف الطلب بعد تحويله إلى طلب مواد. يمكن فتح طلب المواد المرتبط ومتابعته من صفحة الطلبات.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.storeReservation.updateMany({
      where: { needItemId: { in: need.items.map((item) => item.id) }, status: StoreReservationStatus.ACTIVE },
      data: { status: StoreReservationStatus.CANCELLED, releasedAt: new Date() },
    });
    await tx.trainerNeed.delete({ where: { id } });
  });

  return { id, deleted: true };
}

export async function convertTrainerNeedToRequest(id: string, session: SessionUser) {
  const need = await prisma.trainerNeed.findUnique({ where: { id }, include: includeNeed() });
  if (!need) throw new Error('احتياج المدرب غير موجود');
  if (need.linkedRequestId) return getTrainerNeed(id);

  const requestItems = need.items
    .filter((item: any) => item.inventoryItemId && item.reservedQty > 0)
    .map((item: any) => ({ itemId: item.inventoryItemId, quantity: item.reservedQty }));
  if (!requestItems.length) throw new Error('لا توجد مواد محجوزة قابلة للتحويل إلى طلب صرف');

  const request = await RequestService.create({
    requesterId: session.id,
    department: session.department,
    purpose: `تجهيز دورة: ${need.courseName} - المدرب: ${need.trainerName}`,
    notes: `تم إنشاؤه من احتياج المدرب ${need.code}. الحجز الذكي لا يخصم المخزون؛ الخصم يتم عند الصرف من المخزن.`,
    items: requestItems.map((item: any) => ({
      ...item,
      expectedReturnDate: need.endDate ? need.endDate.toISOString().slice(0, 10) : null,
    })),
  });

  await prisma.$transaction(async (tx) => {
    await tx.storeReservation.updateMany({
      where: { needItemId: { in: need.items.map((item: any) => item.id) }, status: StoreReservationStatus.ACTIVE },
      data: { status: StoreReservationStatus.CONVERTED, releasedAt: new Date() },
    });
    await tx.trainerNeedItem.updateMany({
      where: { needId: id, inventoryItemId: { not: null }, reservedQty: { gt: 0 } },
      data: { status: TrainerNeedItemStatus.CONVERTED },
    });
    await tx.trainerNeed.update({
      where: { id },
      data: {
        linkedRequestId: request.id,
        status: TrainerNeedStatus.CONVERTED_TO_REQUEST,
      },
    });
  });

  return getTrainerNeed(id);
}

export async function createStoreBundle(data: any) {
  const title = normalizeText(data.title);
  const items = Array.isArray(data.items)
    ? data.items.map((item: any) => ({
        catalogItemId: normalizeText(item.catalogItemId),
        quantity: normalizeQty(item.quantity) || 1,
        quantityMode: item.quantityMode === StoreBundleQuantityMode.PER_TRAINEE ? StoreBundleQuantityMode.PER_TRAINEE : StoreBundleQuantityMode.FIXED,
      })).filter((item: any) => item.catalogItemId)
    : [];
  if (!title) throw new Error('اسم البكج مطلوب');

  return prisma.storeBundle.create({
    data: {
      title,
      description: normalizeText(data.description) || null,
      imageUrl: normalizeText(data.imageUrl) || null,
      isVisible: true,
      items: { create: items },
    },
  });
}

export async function updateStoreBundle(id: string, data: any) {
  const title = normalizeText(data.title);
  const items = Array.isArray(data.items)
    ? data.items.map((item: any) => ({
        catalogItemId: normalizeText(item.catalogItemId),
        quantity: normalizeQty(item.quantity) || 1,
        quantityMode: item.quantityMode === StoreBundleQuantityMode.PER_TRAINEE ? StoreBundleQuantityMode.PER_TRAINEE : StoreBundleQuantityMode.FIXED,
      })).filter((item: any) => item.catalogItemId)
    : [];
  if (!title) throw new Error('اسم البكج مطلوب');

  return prisma.$transaction(async (tx) => {
    const bundle = await tx.storeBundle.update({
      where: { id },
      data: {
        title,
        description: normalizeText(data.description) || null,
        imageUrl: normalizeText(data.imageUrl || data.imageDataUrl) || null,
        isVisible: typeof data.isVisible === 'boolean' ? data.isVisible : true,
      },
    });
    await tx.storeBundleItem.deleteMany({ where: { bundleId: id } });
    if (items.length) {
      await tx.storeBundleItem.createMany({
        data: items.map((item: any) => ({ ...item, bundleId: id })),
        skipDuplicates: true,
      });
    }
    return bundle;
  });
}

export async function deleteStoreBundle(id: string) {
  return prisma.storeBundle.delete({ where: { id } });
}

export async function upsertAlternative(data: any) {
  const sourceItemId = normalizeText(data.sourceItemId);
  const alternativeId = normalizeText(data.alternativeId);
  if (!sourceItemId || !alternativeId || sourceItemId === alternativeId) throw new Error('بيانات البديل غير مكتملة');

  return prisma.storeItemAlternative.upsert({
    where: { sourceItemId_alternativeId: { sourceItemId, alternativeId } },
    update: {
      note: normalizeText(data.note) || null,
      requiresTrainerApproval: !!data.requiresTrainerApproval,
    },
    create: {
      sourceItemId,
      alternativeId,
      note: normalizeText(data.note) || null,
      requiresTrainerApproval: !!data.requiresTrainerApproval,
    },
  });
}
