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

function escapeSvg(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function visualKind(title: string, category: string) {
  const text = `${title} ${category}`;
  if (/لابتوب|حاسب|كمبيوتر/i.test(text)) return 'laptop';
  if (/ايباد|آيباد|ipad|تابلت/i.test(text)) return 'tablet';
  if (/عرض|بروجكتور|projector/i.test(text)) return 'projector';
  if (/ميكروفون|مايك/i.test(text)) return 'microphone';
  if (/مكبر|سماعة|speaker/i.test(text)) return 'speaker';
  if (/HDMI|USB|محول|وصلة|شاحن/i.test(text)) return 'cable';
  if (/قلم|أقلام|سبورة/i.test(text)) return 'pens';
  if (/نوت|دفتر|دفاتر/i.test(text)) return 'notebook';
  if (/فولدر|ملف|حقيبة/i.test(text)) return 'folder';
  if (/شهادة|شهادات|غلاف|أغلفة/i.test(text)) return 'certificate';
  if (/لوحة|فليب|كانبان|حامل/i.test(text)) return 'board';
  if (/إسعاف|اسعاف|طوارئ/i.test(text)) return 'firstAid';
  if (/رياضي|بدني|كرة/i.test(text)) return 'sport';
  return 'training';
}

function productIcon(kind: string) {
  const common = `filter="url(#softShadow)"`;
  switch (kind) {
    case 'laptop':
      return `<g ${common}><rect x="210" y="118" width="220" height="136" rx="18" fill="url(#device)" stroke="#123f45" stroke-width="8"/><rect x="232" y="140" width="176" height="88" rx="10" fill="#eaf5f3"/><path d="M178 266h284l34 38H144z" fill="#d6b879"/><path d="M240 282h160" stroke="#123f45" stroke-width="10" stroke-linecap="round"/></g>`;
    case 'tablet':
      return `<g ${common}><rect x="232" y="94" width="176" height="222" rx="28" fill="url(#device)" stroke="#123f45" stroke-width="8"/><rect x="254" y="124" width="132" height="154" rx="12" fill="#eaf5f3"/><circle cx="320" cy="296" r="8" fill="#d6b879"/></g>`;
    case 'projector':
      return `<g ${common}><rect x="205" y="168" width="230" height="118" rx="24" fill="url(#device)"/><circle cx="274" cy="226" r="38" fill="#eaf5f3" stroke="#d6b879" stroke-width="10"/><circle cx="274" cy="226" r="18" fill="#123f45"/><path d="M438 200l72-32v116l-72-32z" fill="#d6b879"/><path d="M244 300h152" stroke="#123f45" stroke-width="12" stroke-linecap="round"/></g>`;
    case 'microphone':
      return `<g ${common}><rect x="280" y="92" width="80" height="158" rx="40" fill="url(#device)"/><path d="M246 204c0 58 36 94 74 94s74-36 74-94" fill="none" stroke="#d6b879" stroke-width="16" stroke-linecap="round"/><path d="M320 298v42M274 340h92" stroke="#123f45" stroke-width="16" stroke-linecap="round"/><path d="M296 134h48M296 170h48M296 206h48" stroke="#eaf5f3" stroke-width="8" stroke-linecap="round"/></g>`;
    case 'speaker':
      return `<g ${common}><rect x="236" y="110" width="168" height="210" rx="40" fill="url(#device)"/><circle cx="320" cy="176" r="42" fill="#eaf5f3" stroke="#d6b879" stroke-width="12"/><circle cx="320" cy="264" r="34" fill="#123f45" stroke="#eaf5f3" stroke-width="10"/></g>`;
    case 'cable':
      return `<g ${common}><path d="M214 142c-70 74 46 82 12 146-24 45-96 12-70-42" fill="none" stroke="#123f45" stroke-width="24" stroke-linecap="round"/><path d="M334 142c88 22 94 122 14 154" fill="none" stroke="#d6b879" stroke-width="24" stroke-linecap="round"/><rect x="352" y="112" width="88" height="58" rx="14" fill="#123f45"/><rect x="412" y="128" width="44" height="26" rx="6" fill="#d6b879"/><rect x="274" y="268" width="92" height="54" rx="14" fill="#123f45"/></g>`;
    case 'pens':
      return `<g ${common}><rect x="228" y="94" width="34" height="214" rx="17" fill="#123f45" transform="rotate(-14 245 201)"/><rect x="304" y="88" width="34" height="220" rx="17" fill="#d6b879" transform="rotate(8 321 198)"/><rect x="378" y="104" width="34" height="204" rx="17" fill="#2A6364" transform="rotate(18 395 206)"/><path d="M204 314h232" stroke="#123f45" stroke-width="14" stroke-linecap="round"/></g>`;
    case 'notebook':
      return `<g ${common}><rect x="226" y="102" width="198" height="236" rx="22" fill="#fff7e8" stroke="#123f45" stroke-width="8"/><path d="M266 102v236" stroke="#d6b879" stroke-width="14"/><path d="M298 158h82M298 204h82M298 250h82" stroke="#123f45" stroke-width="9" stroke-linecap="round"/></g>`;
    case 'folder':
      return `<g ${common}><path d="M182 144h132l28 34h116v142H182z" fill="#d6b879"/><path d="M182 178h276v142H182z" fill="#123f45"/><path d="M214 218h196" stroke="#eaf5f3" stroke-width="14" stroke-linecap="round"/></g>`;
    case 'certificate':
      return `<g ${common}><rect x="210" y="102" width="220" height="236" rx="20" fill="#fffaf0" stroke="#d6b879" stroke-width="10"/><path d="M258 168h124M258 212h124M258 256h78" stroke="#123f45" stroke-width="10" stroke-linecap="round"/><circle cx="376" cy="276" r="28" fill="#7c1e3e"/><path d="M360 306l-16 38 34-18 34 18-16-38" fill="#7c1e3e"/></g>`;
    case 'board':
      return `<g ${common}><rect x="188" y="104" width="264" height="172" rx="18" fill="#eaf5f3" stroke="#123f45" stroke-width="12"/><path d="M232 160h176M232 204h124" stroke="#2A6364" stroke-width="12" stroke-linecap="round"/><path d="M320 276v62M240 338h160" stroke="#d6b879" stroke-width="14" stroke-linecap="round"/></g>`;
    case 'firstAid':
      return `<g ${common}><rect x="218" y="122" width="204" height="182" rx="28" fill="#fff" stroke="#123f45" stroke-width="10"/><path d="M286 122v-30h68v30" fill="none" stroke="#123f45" stroke-width="12"/><path d="M320 172v82M279 213h82" stroke="#7c1e3e" stroke-width="24" stroke-linecap="round"/></g>`;
    case 'sport':
      return `<g ${common}><circle cx="320" cy="210" r="92" fill="#eaf5f3" stroke="#123f45" stroke-width="12"/><path d="M250 170c40 18 94 18 140 0M250 250c40-18 94-18 140 0M320 118c-30 54-30 130 0 184M320 118c30 54 30 130 0 184" stroke="#d6b879" stroke-width="10" fill="none" stroke-linecap="round"/></g>`;
    default:
      return `<g ${common}><rect x="214" y="116" width="212" height="172" rx="28" fill="url(#device)"/><path d="M254 164h132M254 208h92M254 252h118" stroke="#eaf5f3" stroke-width="14" stroke-linecap="round"/><path d="M230 306h180" stroke="#d6b879" stroke-width="16" stroke-linecap="round"/></g>`;
  }
}

function svgImage(title: string, category: string) {
  const isTech = category.includes('تقنية') || category.includes('حاسب') || /لابتوب|ايباد|HDMI|USB|ميكروفون|مكبر|عرض/i.test(title);
  const isCertificate = /شهادة|غلاف|طباعة/i.test(`${title} ${category}`);
  const primary = isTech ? '#123f45' : isCertificate ? '#7c1e3e' : '#2A6364';
  const accent = '#d6b879';
  const safeTitle = escapeSvg(title.length > 34 ? `${title.slice(0, 32)}…` : title);
  const kind = visualKind(title, category);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" direction="rtl">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#f8fbfb"/>
        <stop offset="1" stop-color="#eef4f3"/>
      </linearGradient>
      <linearGradient id="device" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="${primary}"/>
        <stop offset="1" stop-color="#3f7473"/>
      </linearGradient>
      <filter id="softShadow" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#163e44" flood-opacity=".20"/>
      </filter>
    </defs>
    <rect width="640" height="400" rx="0" fill="url(#bg)"/>
    <circle cx="92" cy="84" r="76" fill="${accent}" opacity=".14"/>
    <circle cx="548" cy="314" r="98" fill="${primary}" opacity=".09"/>
    <rect x="46" y="34" width="548" height="300" rx="34" fill="#fff" opacity=".78"/>
    <ellipse cx="320" cy="322" rx="162" ry="24" fill="#163e44" opacity=".08"/>
    ${productIcon(kind)}
    <text x="320" y="365" text-anchor="middle" font-family="Cairo, Arial, Tahoma, sans-serif" font-size="30" font-weight="800" fill="${primary}">${safeTitle}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

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
          data: { category: onDemandCategory(item.title), isVisible: true },
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
    imageUrl: item.imageUrl || inventory?.imageUrl || svgImage(item.title, item.category),
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
        imageUrl: row.catalogItem.imageUrl || row.catalogItem.inventoryItem?.imageUrl || svgImage(row.catalogItem.title, row.catalogItem.category),
      })),
    })),
  };
}

export async function getStoreAdminCatalog() {
  await ensureStoreSeed();
  const data = await getPublicCatalog();
  return data;
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

  const trainerName = normalizeText(data.trainerName);
  const courseName = normalizeText(data.courseName);
  const traineeCount = normalizeQty(data.traineeCount);
  const startDate = data.startDate ? new Date(data.startDate) : null;
  const endDate = data.endDate ? new Date(data.endDate) : null;
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

  const count = await prisma.trainerNeed.count();
  const code = `TN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

  const need = await prisma.trainerNeed.create({
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

export async function listTrainerNeeds() {
  const needs = await prisma.trainerNeed.findMany({
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
      const reserveQty = Math.min(item.requestedQty, item.inventoryItem?.availableQty || 0);
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
