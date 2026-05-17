import { NextRequest, NextResponse } from 'next/server';
import { ItemStatus, ItemType, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { InventoryService } from '@/services/inventory.service';
import { approvedInventorySeed } from '@/lib/inventory/approvedInventory';
import { getInventorySearchTerms } from '@/lib/inventoryLocalization';
import { resolveSessionUser } from '@/lib/auth/session';

function normalizeStatus(status: string | null): ItemStatus | undefined {
  if (!status) return undefined;

  const normalized = String(status).trim().toUpperCase();

  if (normalized === ItemStatus.AVAILABLE) return ItemStatus.AVAILABLE;
  if (normalized === ItemStatus.LOW_STOCK) return ItemStatus.LOW_STOCK;
  if (normalized === ItemStatus.OUT_OF_STOCK) return ItemStatus.OUT_OF_STOCK;

  return undefined;
}

function normalizeType(type: string | null): ItemType | undefined {
  if (!type) return undefined;

  const normalized = String(type).trim().toUpperCase();

  if (normalized === ItemType.RETURNABLE) return ItemType.RETURNABLE;
  if (normalized === ItemType.CONSUMABLE) return ItemType.CONSUMABLE;

  return undefined;
}

function canManageInventory(role: Role) {
  return role === Role.MANAGER || role === Role.WAREHOUSE;
}

function resolveErrorStatus(error: unknown, fallback: number, request: NextRequest) {
  const message = String((error as { message?: string })?.message || '');
  const hasSession = request.cookies.has('inventory_platform_session') || request.cookies.has('user_id');
  if (!hasSession) return 401;
  if (message.includes('تسجيل الدخول') || message.includes('الحساب') || message.includes('المستخدم')) {
    return 401;
  }
  return fallback;
}

export async function GET(request: NextRequest) {
  try {
    await resolveSessionUser(request);
    const searchParams = request.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '12', 10);
    const search = (searchParams.get('search') || '').trim();
    const category = (searchParams.get('category') || '').trim();
    const status = normalizeStatus(searchParams.get('status'));
    const type = normalizeType(searchParams.get('type'));
    const searchTerms = getInventorySearchTerms(search);
    const requestMode =
      searchParams.get('onlyAvailableForRequest') === 'true' ||
      searchParams.get('requestMode') === 'true';

    const baseWhere: any = {
      ...(searchTerms.length
        ? {
            OR: searchTerms.flatMap((term) => [
              { name: { contains: term, mode: 'insensitive' as const } },
              { code: { contains: term, mode: 'insensitive' as const } },
              { category: { contains: term, mode: 'insensitive' as const } },
              { subcategory: { contains: term, mode: 'insensitive' as const } },
            ]),
          }
        : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(category ? { category } : {}),
    };

    const [result, stats, categoryRows, allItems] = await Promise.all([
      InventoryService.getAll({
        page,
        limit,
        search,
        category,
        status,
        type,
        requestMode,
      } as any),
      InventoryService.getStats(),
      prisma.inventoryItem.findMany({
        where: baseWhere,
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      }),
      prisma.inventoryItem.findMany({
        where: baseWhere,
        select: {
          id: true,
          type: true,
          status: true,
          quantity: true,
          availableQty: true,
        },
      }),
    ]);

    const returnableCount = allItems.filter((item) => item.type === ItemType.RETURNABLE).length;
    const consumableCount = allItems.filter((item) => item.type === ItemType.CONSUMABLE).length;
    const availableCount = allItems.filter((item) => item.status !== ItemStatus.OUT_OF_STOCK).length;
    const usedCount = allItems.filter((item) => item.availableQty < item.quantity).length;
    const [visibleInStoreCount, missingImagesCount] = await Promise.all([
      prisma.inventoryItem.count({
        where: {
          ...baseWhere,
          storeCatalogItems: { some: { isOnDemand: false, isVisible: true } },
        },
      }),
      prisma.inventoryItem.count({
        where: {
          ...baseWhere,
          OR: [{ imageUrl: null }, { imageUrl: '' }],
        },
      }),
    ]);

    return NextResponse.json({
      ...result,
      categories: categoryRows.map((row) => row.category).filter(Boolean),
      stats: {
        totalItems: stats.total,
        totalUnits: stats.totalQuantity,
        lowStockCount: stats.lowStock,
        outOfStockCount: stats.outOfStock,
        totalEstimatedValue: stats.totalValue,
        returnableCount,
        consumableCount,
        availableCount,
        usedCount,
        visibleInStoreCount,
        missingImagesCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر جلب بيانات المخزون' },
      { status: resolveErrorStatus(error, 500, request) },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    if (!canManageInventory(session.role)) {
      return NextResponse.json({ error: 'غير مصرح بإدارة المخزون' }, { status: 403 });
    }

    const body = await request.json();

    if (body?.mode === 'seedApprovedInventory') {
      let created = 0;
      let updated = 0;

      for (const item of approvedInventorySeed) {
        const exists = await prisma.inventoryItem.findFirst({
          where: {
            name: item.name,
            category: item.category,
            type: item.type,
          },
          select: { id: true },
        });

        if (exists) {
          await InventoryService.update(exists.id, {
            name: item.name,
            category: item.category,
            subcategory: item.subcategory,
            type: item.type,
            quantity: item.quantity,
            minStock: item.minStock,
            unit: item.unit,
            sortOrder: item.sortOrder,
            description: null,
            location: null,
            notes: null,
            unitPrice: null,
            financialTracking: false,
          });
          updated += 1;
        } else {
          await InventoryService.create({
            name: item.name,
            category: item.category,
            subcategory: item.subcategory,
            type: item.type,
            quantity: item.quantity,
            minStock: item.minStock,
            unit: item.unit,
            sortOrder: item.sortOrder,
            description: null,
            location: null,
            notes: null,
            unitPrice: null,
            financialTracking: false,
          });
          created += 1;
        }
      }

      return NextResponse.json({
        success: true,
        created,
        updated,
        total: approvedInventorySeed.length,
      });
    }

    const item = await InventoryService.create(body);
    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'تعذر إنشاء الصنف' },
      { status: resolveErrorStatus(error, 400, request) },
    );
  }
}
