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
import { ensureTrainingRoomsSeed } from '@/services/training-rooms.service';

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

const PER_TRAINEE_KEYWORDS = ['قلم', 'أقلام', 'نوت', 'دفتر', 'دفاتر', 'فولدر', 'ملف', 'شهادة', 'شهادات', 'غلاف', 'أغلفة'];

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function normalizeQty(value: unknown) {
  const qty = Math.floor(Number(value || 0));
  return Number.isFinite(qty) ? Math.max(0, qty) : 0;
}

function onDemandCategory(title: string) {
  return /لابتوب|HDMI|USB|محول|عرض|شاحن|ميكروفون|مكبر/.test(title)
    ? 'الأجهزة التقنية والحاسب'
    : 'مواد عند الطلب';
}

export function canManageTrainerNeeds(session: Pick<SessionUser, 'role' | 'canManageTrainerNeeds'>) {
  return session.role === Role.MANAGER || session.role === Role.WAREHOUSE || !!session.canManageTrainerNeeds;
}

async function ensureStoreSeed() {
  const inventoryItems = await prisma.inventoryItem.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const existingCatalog = await prisma.storeCatalogItem.findMany({
    select: { id: true, inventoryItemId: true, title: true, isOnDemand: true },
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
    await Promise.all(
      existingInventoryRows.map((row) => {
        const inventory = inventoryById.get(row.inventoryItemId!);
        if (!inventory) return null;
        return prisma.storeCatalogItem.update({
          where: { id: row.id },
          data: {
            title: inventory.name,
            description: inventory.description || null,
            category: inventory.category || 'مواد تدريبية',
          },
        });
      }).filter(Boolean) as Promise<unknown>[]
    );
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
  if (seededOnDemandRows.length) {
    await Promise.all(
      seededOnDemandRows.map((item) =>
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

function mapCatalogItem(item: any, reservationMap: Map<string, number>) {
  const inventory = item.inventoryItem;
  const stockQty = inventory?.availableQty || 0;
  const temporarilyReservedQty = inventory?.id ? reservationMap.get(inventory.id) || 0 : 0;
  const freeAfterReservations = Math.max(stockQty - temporarilyReservedQty, 0);

  return {
    id: item.id,
    inventoryItemId: item.inventoryItemId,
    title: item.title,
    description: item.description,
    category: item.category,
    imageUrl: item.imageUrl || inventory?.imageUrl || null,
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
      item: alt.alternative ? mapCatalogItem({ ...alt.alternative, alternativesFrom: [] }, reservationMap) : null,
    })),
  };
}

export async function getPublicCatalog() {
  await ensureStoreSeed();
  const catalog = await prisma.storeCatalogItem.findMany({
    where: { isVisible: true },
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
    where: { isVisible: true },
    include: {
      items: {
        where: { catalogItem: { isVisible: true } },
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
  const rows = Array.isArray(data.items)
    ? data.items
        .map((item: any) => ({ catalogItemId: normalizeText(item.catalogItemId), quantity: normalizeQty(item.quantity) }))
        .filter((item: any) => item.catalogItemId && item.quantity > 0)
    : [];

  if (!trainerName || !courseName || !startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime()) || traineeCount <= 0) {
    throw new Error('بيانات الدورة الأساسية غير مكتملة');
  }
  if (!rows.length) throw new Error('يجب اختيار مادة واحدة على الأقل');

  const catalog = await prisma.storeCatalogItem.findMany({
    where: { id: { in: rows.map((item: any) => item.catalogItemId) }, isVisible: true },
    include: { inventoryItem: true },
  });
  const byId = new Map(catalog.map((item) => [item.id, item]));
  if (catalog.length !== rows.length) throw new Error('توجد مادة غير متاحة في المتجر');
  let requestedRoom = null;
  if (requestedRoomId) {
    requestedRoom = await prisma.trainingRoom.findFirst({
      where: { id: requestedRoomId, isVisible: true },
      select: { id: true },
    });
    if (!requestedRoom) throw new Error('القاعة المحددة غير متاحة');
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
    if (requestedRoomId) {
      await tx.trainingRoomBooking.create({
        data: {
          trainerNeedId: created.id,
          requestedRoomId,
          requestedLayout: requestedLayout || null,
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

export async function listTrainerNeeds(session?: Pick<SessionUser, 'id' | 'role'>) {
  const canSeeAll = !session || session.role === Role.MANAGER || session.role === Role.WAREHOUSE;
  const needs = await prisma.trainerNeed.findMany({
    where: canSeeAll
      ? undefined
      : {
          OR: [
            { assignedToId: null },
            { assignedToId: session.id },
          ],
        },
    include: includeNeed(),
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
  });
  return Promise.all(needs.map(mapNeed));
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

  const rows = Array.isArray(data.items)
    ? data.items
        .map((item: any) => ({
          catalogItemId: normalizeText(item.catalogItemId),
          quantity: normalizeQty(item.requestedQty ?? item.quantity),
          coordinatorNote: normalizeText(item.coordinatorNote),
        }))
        .filter((item: any) => item.catalogItemId && item.quantity > 0)
    : [];

  if (!rows.length) throw new Error('يجب أن يحتوي الطلب على مادة واحدة على الأقل');

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
