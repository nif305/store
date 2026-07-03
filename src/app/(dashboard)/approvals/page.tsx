'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type RequestStatus = 'PENDING' | 'REJECTED' | 'ISSUED' | 'RETURNED' | 'DRAFT';

type RequestRecord = {
  id: string;
  code: string;
  department: string;
  purpose: string;
  status: RequestStatus;
  notes?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  requester?: {
    fullName?: string;
    department?: string;
  };
  items?: Array<{
    id: string;
    quantity: number;
    item?: {
      name?: string;
    };
  }>;
};

type ViewFilter = 'ALL' | 'PENDING' | 'ISSUED' | 'REJECTED' | 'RETURNED';

type RequestStats = {
  total: number;
  pending: number;
  issued: number;
  rejected: number;
  returned: number;
};

type PaginationState = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
};

const STATUS_MAP: Record<RequestStatus, { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }> = {
  PENDING: { label: 'بانتظار معالجة مسؤول المخزن', variant: 'warning' },
  ISSUED: { label: 'تم الصرف', variant: 'success' },
  REJECTED: { label: 'مرفوض / ملغي', variant: 'danger' },
  RETURNED: { label: 'تمت الإعادة', variant: 'neutral' },
  DRAFT: { label: 'مسودة', variant: 'neutral' },
};

function formatDate(date?: string) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ViewFilter>('ALL');
  const [stats, setStats] = useState<RequestStats>({
    total: 0,
    pending: 0,
    issued: 0,
    rejected: 0,
    returned: 0,
  });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 5,
  });

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });

      if (filter !== 'ALL') {
        params.set('status', filter);
      }

      const res = await fetch(`/api/requests?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await res.json();
      const rows = Array.isArray(data?.data) ? data.data : [];
      const nextPagination: PaginationState = {
        page: Number(data?.pagination?.page || pagination.page),
        totalPages: Number(data?.pagination?.totalPages || 1),
        total: Number(data?.pagination?.total || rows.length),
        limit: Number(data?.pagination?.limit || pagination.limit),
      };

      if (pagination.page > nextPagination.totalPages && nextPagination.totalPages > 0) {
        setPagination((prev) => ({ ...prev, page: nextPagination.totalPages }));
        return;
      }

      setRequests(rows);
      setStats({
        total: Number(data?.stats?.total || 0),
        pending: Number(data?.stats?.pending || 0),
        issued: Number(data?.stats?.issued || 0),
        rejected: Number(data?.stats?.rejected || 0),
        returned: Number(data?.stats?.returned || 0),
      });
      setPagination(nextPagination);
    } catch {
      setRequests([]);
      setStats({ total: 0, pending: 0, issued: 0, rejected: 0, returned: 0 });
    } finally {
      setLoading(false);
    }
  }, [filter, pagination.limit, pagination.page]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [filter]);

  const filteredRequests = useMemo(() => requests, [requests]);

  if (user?.role !== 'manager') {
    return (
      <div className="rounded-[22px] border border-red-200 bg-red-50 p-6 text-center text-red-700 sm:rounded-[26px]">
        غير مصرح لك بالوصول لهذه الصفحة
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-[24px] border border-surface-border bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[24px] leading-[1.25] text-primary sm:text-[30px]">
              متابعة الطلبات التشغيلية
            </h1>
            <p className="mt-2 text-[13px] leading-7 text-slate-500 sm:text-[14px]">
              متابعة الطلبات التشغيلية ومستوى إنجازها
            </p>
          </div>

          <span className="inline-flex w-full items-center justify-center rounded-full border border-[#d0b284]/40 bg-[#d0b284]/15 px-3 py-2 text-sm font-bold text-[#8a6a28] sm:w-auto">
            {stats.total} طلب
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="rounded-[22px] p-4 text-center sm:rounded-[26px]">
          <div className="text-xs text-slate-500">الإجمالي</div>
          <div className="mt-2 text-2xl font-extrabold text-[#016564]">{stats.total}</div>
        </Card>
        <Card className="rounded-[22px] p-4 text-center sm:rounded-[26px]">
          <div className="text-xs text-slate-500">بانتظار المخزن</div>
          <div className="mt-2 text-2xl font-extrabold text-[#d0b284]">{stats.pending}</div>
        </Card>
        <Card className="rounded-[22px] p-4 text-center sm:rounded-[26px]">
          <div className="text-xs text-slate-500">تم الصرف</div>
          <div className="mt-2 text-2xl font-extrabold text-[#498983]">{stats.issued}</div>
        </Card>
        <Card className="rounded-[22px] p-4 text-center sm:rounded-[26px]">
          <div className="text-xs text-slate-500">المرفوضة</div>
          <div className="mt-2 text-2xl font-extrabold text-[#7c1e3e]">{stats.rejected}</div>
        </Card>
        <Card className="rounded-[22px] p-4 text-center sm:rounded-[26px]">
          <div className="text-xs text-slate-500">تمت الإعادة</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-700">{stats.returned}</div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['ALL', 'الكل'],
          ['PENDING', 'بانتظار المخزن'],
          ['ISSUED', 'تم الصرف'],
          ['REJECTED', 'المرفوضة'],
          ['RETURNED', 'تمت الإعادة'],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={filter === value ? 'primary' : 'secondary'}
            onClick={() => setFilter(value as ViewFilter)}
          >
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <Card className="rounded-[24px] p-8 text-center sm:rounded-[28px]">جارِ التحميل...</Card>
      ) : filteredRequests.length === 0 ? (
        <Card className="rounded-[24px] p-8 text-center text-gray-500 sm:rounded-[28px]">
          لا توجد طلبات مطابقة لهذا التصنيف
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 sm:gap-4">
          {filteredRequests.map((req) => {
            const statusMeta = STATUS_MAP[req.status] || STATUS_MAP.DRAFT;
            return (
              <Card key={req.id} className="rounded-[24px] p-4 sm:rounded-[28px] sm:p-5">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="break-all text-[18px] font-bold text-[#016564] sm:text-[20px]">{req.code}</div>
                      <div className="mt-1 text-xs text-slate-500 sm:text-sm">{req.department}</div>
                    </div>
                    <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="font-semibold text-slate-800">{req.requester?.fullName || 'غير معروف'}</div>
                    {req.requester?.department ? <div className="text-slate-500">{req.requester.department}</div> : null}
                    <div className="break-words leading-7 text-slate-600">{req.purpose}</div>
                    <div className="text-xs text-slate-400">{formatDate(req.createdAt)}</div>
                    {req.notes ? <div className="text-xs leading-6 text-slate-500">ملاحظات: {req.notes}</div> : null}
                    {req.rejectionReason ? <div className="text-xs leading-6 text-[#7c1e3e]">سبب الرفض/الإلغاء: {req.rejectionReason}</div> : null}
                  </div>

                  <div className="rounded-[20px] bg-slate-50 p-3 text-sm sm:rounded-[22px] sm:p-4">
                    <div className="mb-2 font-semibold text-slate-700">المواد المطلوبة</div>
                    <ul className="space-y-2 text-slate-600">
                      {req.items?.map((it) => (
                        <li key={it.id} className="break-words leading-7">
                          {it.item?.name || 'صنف'} × {it.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && pagination.totalPages > 1 ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-[24px] border border-[#d6d7d4] bg-white px-4 py-4 shadow-sm sm:flex-row sm:rounded-[28px] sm:px-5">
          <div className="text-sm font-bold text-[#016564]">
            الصفحة {pagination.page} من {pagination.totalPages}
          </div>
          <div className="text-xs text-slate-500">إجمالي السجلات في هذا العرض: {pagination.total}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page <= 1}
              className="rounded-full border border-[#d6d7d4] px-4 py-2 text-sm font-bold text-[#425554] disabled:cursor-not-allowed disabled:opacity-40"
            >
              السابق
            </button>
            <button
              type="button"
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  page: Math.min(prev.totalPages, prev.page + 1),
                }))
              }
              disabled={pagination.page >= pagination.totalPages}
              className="rounded-full border border-[#d6d7d4] px-4 py-2 text-sm font-bold text-[#425554] disabled:cursor-not-allowed disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
