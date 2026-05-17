import {
  RequestStatus,
  Prisma,
  ItemStatus,
  Role,
  Status,
  ItemType,
  CustodyStatus,
  ReturnStatus,
  ReturnItemCondition,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

type RequestItemInput = {
  itemId: string;
  quantity: number;
  expectedReturnDate?: string | null;
};

function normalizePositiveQuantity(quantity: number) {
  const value = Number(quantity);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('الكمية المطلوبة غير صحيحة');
  }
  return Math.floor(value);
}

function parseExpectedReturn(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function computeItemStatus(availableQty: number, minStock: number) {
  if (availableQty <= 0) return ItemStatus.OUT_OF_STOCK;
  if (availableQty > minStock) return ItemStatus.AVAILABLE;
  return ItemStatus.LOW_STOCK;
}

function isPreIssueStatus(status: RequestStatus) {
  return status === RequestStatus.PENDING || status === RequestStatus.APPROVED;
}

function normalizeRequestStatusForClient(status: RequestStatus) {
  return status === RequestStatus.APPROVED ? RequestStatus.PENDING : status;
}

function buildRequestStatusFilter(
  status?: RequestStatus,
  view?: string | null,
): Prisma.RequestWhereInput['status'] | undefined {
  if (status) {
    return status === RequestStatus.PENDING
      ? { in: [RequestStatus.PENDING, RequestStatus.APPROVED] }
      : status;
  }

  const normalizedView = String(view || '').trim().toLowerCase();

  if (normalizedView === 'new' || normalizedView === 'pending') {
    return { in: [RequestStatus.PENDING, RequestStatus.APPROVED] };
  }

  if (normalizedView === 'finished') {
    return { in: [RequestStatus.ISSUED, RequestStatus.RETURNED, RequestStatus.REJECTED] };
  }

  if (normalizedView === 'returns' || normalizedView === 'returned') {
    return RequestStatus.RETURNED;
  }

  return undefined;
}

async function ensureCoreUsers() {
  return;
}

async function validateItemsForRequest(items: RequestItemInput[]) {
  const normalizedItems = items.map((item) => ({
    itemId: String(item.itemId),
    quantity: normalizePositiveQuantity(item.quantity),
    expectedReturnDate: item.expectedReturnDate || null,
  }));

  const itemIds = [...new Set(normalizedItems.map((item) => item.itemId))];

  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds } },
    select: {
      id: true,
      name: true,
      type: true,
      availableQty: true,
      quantity: true,
      minStock: true,
      status: true,
    },
  });

  if (inventoryItems.length !== itemIds.length) {
    throw new Error('بعض الأصناف المطلوبة غير موجودة في المخزون');
  }

  const inventoryMap = new Map(inventoryItems.map((item) => [item.id, item]));

  for (const row of normalizedItems) {
    const stockItem = inventoryMap.get(row.itemId);

    if (!stockItem) {
      throw new Error('بعض الأصناف المطلوبة غير موجودة في المخزون');
    }

    if (stockItem.status === ItemStatus.OUT_OF_STOCK || stockItem.availableQty <= 0) {
      throw new Error(`الصنف ${stockItem.name} غير متوفر في المخزون`);
    }

    if (row.quantity > stockItem.availableQty) {
      throw new Error(
        `الكمية المطلوبة للصنف ${stockItem.name} تتجاوز المتاح حاليًا (${stockItem.availableQty})`
      );
    }

    if (stockItem.type === ItemType.RETURNABLE && !row.expectedReturnDate) {
      throw new Error(`يجب تحديد تاريخ الإرجاع المتوقع للصنف ${stockItem.name}`);
    }

    if (row.expectedReturnDate && !parseExpectedReturn(row.expectedReturnDate)) {
      throw new Error(`تاريخ الإرجاع المتوقع للصنف ${stockItem.name} غير صحيح`);
    }
  }

  return normalizedItems;
}

async function loadRequestOrThrow(id: string) {
  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      requester: {
        select: {
          id: true,
          fullName: true,
          department: true,
          email: true,
        },
      },
      items: {
        include: {
          item: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
              availableQty: true,
              unit: true,
            },
          },
          returnRequests: {
            select: {
              id: true,
              quantity: true,
              status: true,
            },
          },
        },
      },
      custodyRecords: true,
    },
  });

  if (!request) {
    throw new Error('الطلب غير موجود');
  }

  return request;
}

function mapRequestWithDerivedData<
  T extends {
    status: RequestStatus;
    items: Array<{
      id: string;
      itemId: string;
      quantity: number;
      notes: string | null;
      returnRequests?: Array<{
        id: string;
        quantity: number;
        status: ReturnStatus;
      }>;
      item?: {
        id: string;
        name: string;
        code: string;
        type: ItemType;
        availableQty: number;
        unit: string;
      } | null;
    }>;
    custodyRecords?: Array<{
      itemId: string;
      quantity: number;
      status: CustodyStatus;
    }>;
  }
>(request: T) {
  const activeByItem = new Map<string, number>();

  for (const record of request.custodyRecords || []) {
    if (
      record.status === CustodyStatus.ACTIVE ||
      record.status === CustodyStatus.RETURN_REQUESTED ||
      record.status === CustodyStatus.OVERDUE
    ) {
      activeByItem.set(record.itemId, (activeByItem.get(record.itemId) || 0) + record.quantity);
    }
  }

  return {
    ...request,
    status: normalizeRequestStatusForClient(request.status),
    items: request.items.map((item) => ({
      ...item,
      expectedReturnDate: item.notes || null,
      activeIssuedQty: activeByItem.get(item.itemId) || 0,
    })),
  };
}

async function getRequestById(id: string) {
  const request = await loadRequestOrThrow(id);
  return mapRequestWithDerivedData(request);
}

async function createRequest(data: {
  requesterId: string;
  department: string;
  purpose: string;
  items: RequestItemInput[];
  notes?: string;
}) {
  await ensureCoreUsers();

  if (!data.requesterId) throw new Error('معرف المستخدم مطلوب');
  if (!data.department?.trim()) throw new Error('الإدارة مطلوبة');
  if (!data.purpose?.trim()) throw new Error('الغرض من الطلب مطلوب');
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('يجب إضافة صنف واحد على الأقل');
  }

  const normalizedItems = await validateItemsForRequest(data.items);
  const count = await prisma.request.count();
  const code = `REQ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

  const request = await prisma.request.create({
    data: {
      code,
      requesterId: data.requesterId,
      department: data.department.trim(),
      purpose: data.purpose.trim(),
      notes: data.notes?.trim() || null,
      status: RequestStatus.PENDING,
      items: {
        create: normalizedItems.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          notes: item.expectedReturnDate || null,
        })),
      },
    },
    include: {
      requester: {
        select: {
          id: true,
          fullName: true,
          department: true,
          email: true,
        },
      },
      items: {
        include: {
          item: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
              availableQty: true,
              unit: true,
            },
          },
          returnRequests: {
            select: {
              id: true,
              quantity: true,
              status: true,
            },
          },
        },
      },
      custodyRecords: true,
    },
  });

  const targets = await prisma.user.findMany({
    where: {
      roles: { hasSome: [Role.MANAGER, Role.WAREHOUSE] },
      status: Status.ACTIVE,
    },
    select: { id: true },
  });

  if (targets.length) {
    await prisma.notification.createMany({
      data: targets.map((user) => ({
        userId: user.id,
        type: 'NEW_REQUEST',
        title: 'طلب مواد جديد',
        message: `تم إنشاء طلب جديد برقم ${request.code}`,
        link: `/requests?open=${request.id}`,
        entityId: request.id,
        entityType: 'REQUEST',
      })),
    });
  }

  return mapRequestWithDerivedData(request);
}

async function getAllRequests({
  userId,
  role,
  page = 1,
  limit = 100,
  status,
  view,
}: {
  userId: string;
  role: Role | string;
  page?: number;
  limit?: number;
  status?: RequestStatus;
  view?: string | null;
}) {
  await ensureCoreUsers();

  const normalizedRole = String(role || '').toUpperCase();
  const safeLimit = Math.min(Math.max(1, Math.floor(limit || 1)), 100);
  const safePage = Math.max(1, Math.floor(page || 1));
  const skip = (safePage - 1) * safeLimit;
  const statusFilter = buildRequestStatusFilter(status, view);

  const baseWhere: Prisma.RequestWhereInput = {
    ...(normalizedRole === 'USER' ? { requesterId: userId } : {}),
  };

  const where: Prisma.RequestWhereInput = {
    ...baseWhere,
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [requests, total, pendingCount, rejectedCount, issuedCount, returnedCount] = await Promise.all([
    prisma.request.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            department: true,
            email: true,
          },
        },
        items: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                code: true,
                type: true,
                availableQty: true,
                unit: true,
              },
            },
            returnRequests: {
              select: {
                id: true,
                quantity: true,
                status: true,
              },
            },
          },
        },
        custodyRecords: true,
      },
    }),
    prisma.request.count({ where }),
    prisma.request.count({
      where: {
        ...baseWhere,
        status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] },
      },
    }),
    prisma.request.count({
      where: {
        ...baseWhere,
        status: RequestStatus.REJECTED,
      },
    }),
    prisma.request.count({
      where: {
        ...baseWhere,
        status: RequestStatus.ISSUED,
      },
    }),
    prisma.request.count({
      where: {
        ...baseWhere,
        status: RequestStatus.RETURNED,
      },
    }),
  ]);

  return {
    data: requests.map(mapRequestWithDerivedData),
    stats: {
      total: pendingCount + rejectedCount + issuedCount + returnedCount,
      pending: pendingCount,
      rejected: rejectedCount,
      issued: issuedCount,
      returned: returnedCount,
      warehouseNew: pendingCount,
      warehouseFinished: issuedCount + returnedCount + rejectedCount,
      warehouseReturns: returnedCount,
    },
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

async function updateBeforeIssue(
  requestId: string,
  userId: string,
  data: {
    purpose: string;
    notes?: string;
    items: RequestItemInput[];
  }
) {
  await ensureCoreUsers();

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, requesterId: true, status: true },
  });

  if (!request) throw new Error('الطلب غير موجود');
  if (request.requesterId !== userId) throw new Error('لا تملك صلاحية تعديل هذا الطلب');
  if (!isPreIssueStatus(request.status)) {
    throw new Error('يمكن تعديل الطلب فقط قبل الصرف');
  }

  if (!data.purpose?.trim()) throw new Error('الغرض من الطلب مطلوب');
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('يجب إضافة صنف واحد على الأقل');
  }

  const normalizedItems = await validateItemsForRequest(data.items);

  await prisma.$transaction(async (tx) => {
    await tx.requestItem.deleteMany({
      where: { requestId },
    });

    await tx.request.update({
      where: { id: requestId },
      data: {
        purpose: data.purpose.trim(),
        notes: data.notes?.trim() || null,
        status: RequestStatus.PENDING,
        items: {
          create: normalizedItems.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            notes: item.expectedReturnDate || null,
          })),
        },
      },
    });
  });

  return getRequestById(requestId);
}

async function cancelBeforeIssue(requestId: string, userId: string, notes?: string) {
  await ensureCoreUsers();

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, requesterId: true, status: true, code: true },
  });

  if (!request) throw new Error('الطلب غير موجود');
  if (request.requesterId !== userId) throw new Error('لا تملك صلاحية إلغاء هذا الطلب');
  if (!isPreIssueStatus(request.status)) {
    throw new Error('لا يمكن إلغاء الطلب بعد الصرف');
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: {
      status: RequestStatus.REJECTED,
      rejectionReason: 'تم الإلغاء من الموظف',
      processedAt: new Date(),
      processedById: userId,
      notes: notes?.trim() || null,
    },
  });

  const targets = await prisma.user.findMany({
    where: {
      roles: { hasSome: [Role.MANAGER, Role.WAREHOUSE] },
      status: Status.ACTIVE,
    },
    select: { id: true },
  });

  if (targets.length) {
    await prisma.notification.createMany({
      data: targets.map((user) => ({
        userId: user.id,
        type: 'REQUEST_CANCELLED',
        title: 'تم إلغاء طلب',
        message: `قام الموظف بإلغاء الطلب ${request.code} قبل الصرف.`,
        link: `/requests?open=${request.id}`,
        entityId: request.id,
        entityType: 'REQUEST',
      })),
    });
  }

  return updated;
}

async function rejectRequest(requestId: string, actorId: string, reason: string) {
  await ensureCoreUsers();

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, code: true, requesterId: true, status: true },
  });

  if (!request) throw new Error('الطلب غير موجود');
  if (!isPreIssueStatus(request.status)) {
    throw new Error('لا يمكن رفض الطلب في حالته الحالية');
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: {
      status: RequestStatus.REJECTED,
      rejectionReason: reason || 'تم رفض الطلب',
      processedAt: new Date(),
      processedById: actorId,
    },
  });

  await prisma.notification.create({
    data: {
      userId: request.requesterId,
      type: 'REQUEST_REJECTED',
      title: 'تم رفض الطلب',
      message: `تم رفض الطلب ${request.code}${reason ? ` بسبب: ${reason}` : ''}`,
      link: `/requests?open=${request.id}`,
      entityId: request.id,
      entityType: 'REQUEST',
    },
  });

  return updated;
}


async function approveRequest(requestId: string, actorId: string, notes?: string) {
  await ensureCoreUsers();

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      requester: {
        select: { id: true },
      },
    },
  });

  if (!request) throw new Error('الطلب غير موجود');
  if (request.status !== RequestStatus.PENDING) {
    if (request.status === RequestStatus.APPROVED) {
      return request;
    }
    throw new Error('لا يمكن اعتماد الطلب في حالته الحالية');
  }

  const approved = await prisma.request.update({
    where: { id: requestId },
    data: {
      status: RequestStatus.APPROVED,
      processedAt: new Date(),
      processedById: actorId,
      rejectionReason: null,
      notes: [request.notes, notes?.trim()].filter(Boolean).join(' | ') || request.notes,
    },
  });

  const targets = await prisma.user.findMany({
    where: {
      roles: { has: Role.WAREHOUSE },
      status: Status.ACTIVE,
    },
    select: { id: true },
  });

  if (targets.length) {
    await prisma.notification.createMany({
      data: targets.map((user) => ({
        userId: user.id,
        type: 'REQUEST_APPROVED',
        title: 'طلب جاهز للصرف',
        message: `تم اعتماد الطلب ${request.code} إداريًا وأصبح جاهزًا للصرف من المستودع.`,
        link: `/requests?open=${request.id}`,
        entityId: request.id,
        entityType: 'REQUEST',
      })),
    });
  }

  await prisma.notification.create({
    data: {
      userId: request.requesterId,
      type: 'REQUEST_APPROVED',
      title: 'تم اعتماد الطلب',
      message: `تم اعتماد الطلب ${request.code} إداريًا وجارٍ تجهيزه للصرف.`,
      link: `/requests?open=${request.id}`,
      entityId: request.id,
      entityType: 'REQUEST',
    },
  });

  return approved;
}

async function issueRequest(requestId: string, actorId: string, notes?: string) {
  await ensureCoreUsers();

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      items: {
        include: { item: true },
      },
      requester: true,
    },
  });

  if (!request) throw new Error('الطلب غير موجود');
  if (!isPreIssueStatus(request.status)) {
    throw new Error('الطلب ليس في حالة قابلة للصرف');
  }

  const result = await prisma.$transaction(async (tx) => {
    for (const reqItem of request.items) {
      const item = await tx.inventoryItem.findUnique({
        where: { id: reqItem.itemId },
      });

      if (!item) throw new Error(`الصنف ${reqItem.item?.name || ''} غير موجود`);
      if (item.availableQty < reqItem.quantity || item.quantity < reqItem.quantity) {
        throw new Error(`الكمية غير كافية للصنف ${item.name}`);
      }

      const isReturnable = item.type === ItemType.RETURNABLE;
      const nextAvailable = item.availableQty - reqItem.quantity;
      const nextQuantity = isReturnable ? item.quantity : item.quantity - reqItem.quantity;

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          availableQty: nextAvailable,
          quantity: nextQuantity,
          status: computeItemStatus(nextAvailable, item.minStock),
        },
      });

      if (isReturnable) {
        const custodyNotes = [request.notes, notes?.trim()].filter(Boolean).join(' | ') || null;
        await tx.custodyRecord.create({
          data: {
            userId: request.requesterId,
            itemId: item.id,
            requestId: request.id,
            quantity: reqItem.quantity,
            issueDate: new Date(),
            expectedReturn: parseExpectedReturn(reqItem.notes),
            status: CustodyStatus.ACTIVE,
            notes: custodyNotes,
          },
        });
      }
    }

    return tx.request.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.ISSUED,
        processedAt: new Date(),
        processedById: actorId,
        rejectionReason: null,
        notes: [request.notes, notes?.trim()].filter(Boolean).join(' | ') || request.notes,
      },
    });
  });

  await prisma.notification.create({
    data: {
      userId: request.requesterId,
      type: 'REQUEST_ISSUED',
      title: 'تم صرف المواد',
      message: `تم صرف الطلب ${request.code} بنجاح، ويمكنك مراجعة حالته من صفحة الطلبات.`,
      link: `/requests?open=${request.id}`,
      entityId: request.id,
      entityType: 'REQUEST',
    },
  });

  return result;
}

async function adjustAfterIssue(
  requestId: string,
  userId: string,
  data: {
    notes?: string;
    items: Array<{ itemId: string; quantityToReturn: number }>;
  }
) {
  await ensureCoreUsers();

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      items: {
        include: { item: true },
      },
    },
  });

  if (!request) throw new Error('الطلب غير موجود');
  if (request.requesterId !== userId) throw new Error('لا تملك صلاحية هذا الإجراء');
  if (request.status !== RequestStatus.ISSUED) {
    throw new Error('هذا الإجراء متاح فقط بعد الصرف');
  }

  const rows = Array.isArray(data.items)
    ? data.items
        .map((row) => ({
          itemId: String(row.itemId),
          quantityToReturn: normalizePositiveQuantity(row.quantityToReturn),
        }))
        .filter((row) => row.quantityToReturn > 0)
    : [];

  if (rows.length === 0) {
    throw new Error('يجب تحديد كمية واحدة على الأقل للإرجاع');
  }

  let runningCount = await prisma.returnRequest.count();

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const reqItem = request.items.find((item) => item.itemId === row.itemId);

      if (!reqItem) {
        throw new Error('الصنف المطلوب غير مرتبط بهذا الطلب');
      }

      if (reqItem.item?.type !== ItemType.RETURNABLE) {
        throw new Error(`الصنف ${reqItem.item?.name || ''} ليس مادة مسترجعة`);
      }

      const activeRecords = await tx.custodyRecord.findMany({
        where: {
          requestId,
          userId,
          itemId: row.itemId,
          status: CustodyStatus.ACTIVE,
        },
        orderBy: { issueDate: 'asc' },
      });

      const totalActive = activeRecords.reduce((sum, record) => sum + record.quantity, 0);
      if (totalActive < row.quantityToReturn) {
        throw new Error(
          `الكمية المطلوب إرجاعها للصنف ${reqItem.item?.name || ''} تتجاوز المصروف فعليًا`
        );
      }

      let remaining = row.quantityToReturn;

      for (const record of activeRecords) {
        if (remaining <= 0) break;

        const splitQty = Math.min(record.quantity, remaining);

        if (splitQty === record.quantity) {
          await tx.custodyRecord.update({
            where: { id: record.id },
            data: {
              status: CustodyStatus.RETURN_REQUESTED,
              notes: data.notes?.trim() || record.notes,
            },
          });

          runningCount += 1;
          await tx.returnRequest.create({
            data: {
              code: `RET-${new Date().getFullYear()}-${String(runningCount).padStart(4, '0')}`,
              custodyId: record.id,
              requesterId: userId,
              conditionNote: data.notes?.trim() || null,
              status: ReturnStatus.PENDING,
              returnType: ReturnItemCondition.GOOD,
              declarationAck: true,
            },
          });
        } else {
          await tx.custodyRecord.update({
            where: { id: record.id },
            data: {
              quantity: record.quantity - splitQty,
            },
          });

          const splitRecord = await tx.custodyRecord.create({
            data: {
              userId: record.userId,
              itemId: record.itemId,
              requestId: record.requestId,
              quantity: splitQty,
              issueDate: record.issueDate,
              expectedReturn: record.expectedReturn,
              status: CustodyStatus.RETURN_REQUESTED,
              notes: data.notes?.trim() || record.notes,
            },
          });

          runningCount += 1;
          await tx.returnRequest.create({
            data: {
              code: `RET-${new Date().getFullYear()}-${String(runningCount).padStart(4, '0')}`,
              custodyId: splitRecord.id,
              requesterId: userId,
              conditionNote: data.notes?.trim() || null,
              status: ReturnStatus.PENDING,
              returnType: ReturnItemCondition.GOOD,
              declarationAck: true,
            },
          });
        }

        remaining -= splitQty;
      }
    }
  });

  return getRequestById(requestId);
}

export const RequestService = {
  create: createRequest,
  getAll: getAllRequests,
  getById: getRequestById,
  updateBeforeIssue,
  cancelBeforeIssue,
  reject: rejectRequest,
  issue: issueRequest,
  adjustAfterIssue,
  approve: approveRequest,
};
