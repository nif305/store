import { CustodyStatus, ItemType, RequestStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type ArchiveSource = 'materials';
export type ArchiveFolderKey =
  | 'material-consumable'
  | 'material-returnable'
  | 'material-custody-returned';

type ArchiveRow = {
  id: string;
  source: ArchiveSource;
  folder: ArchiveFolderKey;
  title: string;
  code: string;
  status: string;
  requesterName: string;
  requesterDepartment: string;
  description: string;
  createdAt?: string | null;
  extra?: string;
};

function paginate<T>(rows: T[], page = 1, limit = 5) {
  const safePage = Math.max(1, Math.floor(page || 1));
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit || 5)));
  const start = (safePage - 1) * safeLimit;
  return {
    rows: rows.slice(start, start + safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / safeLimit)),
    },
  };
}

function matchesSearch(row: ArchiveRow, search?: string | null) {
  const value = String(search || '').trim().toLowerCase();
  if (!value) return true;
  return [
    row.title,
    row.code,
    row.status,
    row.requesterName,
    row.requesterDepartment,
    row.description,
    row.extra,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(value);
}

async function getIssuedRequestRows(folder: Extract<ArchiveFolderKey, 'material-consumable' | 'material-returnable'>) {
  const itemType = folder === 'material-consumable' ? ItemType.CONSUMABLE : ItemType.RETURNABLE;
  const requests = await prisma.request.findMany({
    where: {
      status: { in: [RequestStatus.ISSUED, RequestStatus.RETURNED] },
      items: {
        some: {
          item: { type: itemType },
        },
      },
    },
    include: {
      requester: {
        select: {
          fullName: true,
          department: true,
        },
      },
      items: {
        include: {
          item: {
            select: {
              name: true,
              code: true,
              type: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return requests.map<ArchiveRow>((request) => {
    const matchingItems = request.items.filter((item) => item.item?.type === itemType);
    return {
      id: request.id,
      source: 'materials',
      folder,
      title: request.purpose || 'طلب مواد',
      code: request.code,
      status: request.status,
      requesterName: request.requester?.fullName || '-',
      requesterDepartment: request.requester?.department || request.department || '-',
      description: matchingItems.map((item) => `${item.item?.name || item.itemId} (${item.quantity})`).join('، '),
      createdAt: request.createdAt.toISOString(),
      extra: request.notes || undefined,
    };
  });
}

async function getReturnedCustodyRows() {
  const rows = await prisma.custodyRecord.findMany({
    where: { status: CustodyStatus.RETURNED },
    include: {
      user: {
        select: {
          fullName: true,
          department: true,
        },
      },
      item: {
        select: {
          name: true,
          code: true,
        },
      },
      request: {
        select: {
          code: true,
          purpose: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return rows.map<ArchiveRow>((row) => ({
    id: row.id,
    source: 'materials',
    folder: 'material-custody-returned',
    title: row.item?.name || 'عهدة معادة',
    code: row.item?.code || row.request?.code || row.id,
    status: row.status,
    requesterName: row.user?.fullName || '-',
    requesterDepartment: row.user?.department || '-',
    description: row.returnCondition || row.request?.purpose || 'عهدة تم إرجاعها',
    createdAt: (row.actualReturn || row.updatedAt || row.createdAt).toISOString(),
    extra: row.notes || undefined,
  }));
}

export const ArchiveService = {
  getFolderData: async ({
    folder,
    page = 1,
    limit = 5,
    search,
  }: {
    source: ArchiveSource;
    folder: ArchiveFolderKey;
    page?: number;
    limit?: number;
    search?: string | null;
  }) => {
    const [consumableRows, returnableRows, returnedCustodyRows] = await Promise.all([
      getIssuedRequestRows('material-consumable'),
      getIssuedRequestRows('material-returnable'),
      getReturnedCustodyRows(),
    ]);

    const folderRows: Record<ArchiveFolderKey, ArchiveRow[]> = {
      'material-consumable': consumableRows,
      'material-returnable': returnableRows,
      'material-custody-returned': returnedCustodyRows,
    };

    const activeRows = (folderRows[folder] || folderRows['material-consumable']).filter((row) =>
      matchesSearch(row, search)
    );
    const paginated = paginate(activeRows, page, limit);

    return {
      rows: paginated.rows,
      counts: {
        'material-consumable': consumableRows.length,
        'material-returnable': returnableRows.length,
        'material-custody-returned': returnedCustodyRows.length,
      },
      stats: {
        total: consumableRows.length + returnableRows.length + returnedCustodyRows.length,
        folders: 3,
        activeFolderCount: activeRows.length,
      },
      pagination: paginated.pagination,
    };
  },
};
