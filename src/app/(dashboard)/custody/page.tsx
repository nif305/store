'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  getInventoryDisplayCategory,
  getInventoryDisplayName,
} from '@/lib/inventoryLocalization';

type CustodyStatus = 'ACTIVE' | 'RETURN_REQUESTED' | 'RETURNED' | 'OVERDUE';

type ReturnRequestSummary = {
  id: string;
  code: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  conditionNote?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
};

type CustodyItem = {
  id: string;
  code: string;
  itemName: string;
  category?: string | null;
  quantity: number;
  assignedToUserId: string;
  assignedToUserName: string;
  assignedToDepartment?: string | null;
  assignedToEmail?: string | null;
  assignedDate: string;
  dueDate?: string | null;
  notes?: string | null;
  status: CustodyStatus;
  requestCode?: string | null;
  requestPurpose?: string | null;
  returnRequests: ReturnRequestSummary[];
};

type CustodyApiRow = {
  id: string;
  issueDate: string;
  dueDate?: string | null;
  expectedReturn?: string | null;
  notes?: string | null;
  status: CustodyStatus;
  userId: string;
  user?: {
    id?: string | null;
    fullName?: string | null;
    department?: string | null;
    email?: string | null;
  } | null;
  quantity?: number | null;
  item?: {
    name?: string | null;
    code?: string | null;
    category?: string | null;
    type?: 'RETURNABLE' | 'CONSUMABLE' | null;
  } | null;
  request?: {
    id?: string | null;
    code?: string | null;
    purpose?: string | null;
    createdAt?: string | null;
  } | null;
  returnRequests?: ReturnRequestSummary[];
};

type CustodyStats = {
  total: number;
  active: number;
  overdue: number;
  returnRequested: number;
  returned?: number;
};

type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type CustodyApiResponse = {
  data?: CustodyApiRow[];
  stats?: CustodyStats;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

function formatDate(date?: string | null) {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString('ar-SA');
  } catch {
    return '-';
  }
}

function statusLabel(status: CustodyStatus, lang = 'ar') {
  if (lang === 'en') {
    if (status === 'ACTIVE') return 'Active';
    if (status === 'OVERDUE') return 'Overdue';
    if (status === 'RETURN_REQUESTED') return 'Return Requested';
    return 'Returned';
  }
  if (status === 'ACTIVE') return 'نشطة';
  if (status === 'OVERDUE') return 'متأخرة';
  if (status === 'RETURN_REQUESTED') return 'طُلب إرجاعها';
  return 'أُعيدت';
}

function statusVariant(status: CustodyStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'OVERDUE') return 'danger';
  if (status === 'RETURN_REQUESTED') return 'warning';
  return 'neutral';
}

function mapCustodyRow(row: CustodyApiRow, language: 'ar' | 'en'): CustodyItem | null {
  if (row.item?.type && row.item.type !== 'RETURNABLE') return null;
  if (!row.item?.code && !row.item?.name) return null;

  return {
    id: row.id,
    code: row.item?.code || '-',
    itemName: getInventoryDisplayName(row.item, language),
    category: getInventoryDisplayCategory(row.item, language) || row.user?.department || null,
    quantity: Number(row.quantity || 0),
    assignedToUserId: row.userId,
    assignedToUserName: row.user?.fullName || 'المستخدم',
    assignedToDepartment: row.user?.department || null,
    assignedToEmail: row.user?.email || null,
    assignedDate: row.issueDate,
    dueDate: row.dueDate || row.expectedReturn || null,
    notes: row.notes || null,
    status: row.status,
    requestCode: row.request?.code || null,
    requestPurpose: row.request?.purpose || null,
    returnRequests: Array.isArray(row.returnRequests) ? row.returnRequests : [],
  };
}

export default function CustodyPage() {
  const { user } = useAuth();
  const { language } = useI18n();
  const searchParams = useSearchParams();
  const openId = String(searchParams.get('open') || '').trim();
  const activeRole = String(user?.role || 'user').toLowerCase();
  const canManageCustody = activeRole === 'manager' || activeRole === 'warehouse';
  const [items, setItems] = useState<CustodyItem[]>([]);
  const [stats, setStats] = useState<CustodyStats>({
    total: 0,
    active: 0,
    overdue: 0,
    returnRequested: 0,
    returned: 0,
  });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [submittingReturnId, setSubmittingReturnId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'OVERDUE' | 'RETURN_REQUESTED'>('ALL');
  const [selectedItem, setSelectedItem] = useState<CustodyItem | null>(null);
  const [search, setSearch] = useState('');

  const refresh = useCallback(async (page = pagination.page) => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
      });

      if (activeFilter !== 'ALL') {
        params.set('status', activeFilter);
      }

      if (openId) {
        params.set('open', openId);
      }

      const response = await fetch(`/api/custody?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      const data: CustodyApiResponse = await response.json().catch(() => ({ data: [] }));
      const mapped = Array.isArray(data?.data)
        ? (data.data.map((row) => mapCustodyRow(row, language)).filter(Boolean) as CustodyItem[])
        : [];
      const nextPagination: PaginationState = {
        page: Number(data?.pagination?.page || page || 1),
        limit: Number(data?.pagination?.limit || pagination.limit || 5),
        total: Number(data?.pagination?.total || 0),
        totalPages: Math.max(1, Number(data?.pagination?.totalPages || 1)),
      };

      if (page > nextPagination.totalPages && nextPagination.totalPages > 0) {
        setPagination((prev) => ({ ...prev, page: nextPagination.totalPages }));
        return;
      }

      setItems(mapped);
      setStats({
        total: Number(data?.stats?.total || 0),
        active: Number(data?.stats?.active || 0),
        overdue: Number(data?.stats?.overdue || 0),
        returnRequested: Number(data?.stats?.returnRequested || 0),
        returned: Number(data?.stats?.returned || 0),
      });
      setPagination(nextPagination);
    } catch {
      setItems([]);
      setStats({ total: 0, active: 0, overdue: 0, returnRequested: 0, returned: 0 });
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
    } finally {
      setLoading(false);
    }
  }, [activeFilter, language, openId, pagination.limit, pagination.page]);

  useEffect(() => {
    void refresh(pagination.page);
  }, [pagination.page, refresh]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [activeFilter]);

  useEffect(() => {
    if (!openId || loading) return;
    const match = items.find((item) => item.id === openId);
    if (match && selectedItem?.id !== match.id) {
      setSelectedItem(match);
    }
  }, [items, loading, openId, selectedItem?.id]);

  const pendingReturnFor = useCallback(
    (item: CustodyItem) => item.returnRequests.find((r) => r.status === 'PENDING'),
    []
  );

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) =>
      [
        item.code,
        item.itemName,
        item.category,
        item.assignedToUserName,
        item.assignedToDepartment,
        item.assignedToEmail,
        item.requestCode,
        item.requestPurpose,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [items, search]);

  const createReturnRequest = async (item: CustodyItem) => {
    if (pendingReturnFor(item) || item.status === 'RETURN_REQUESTED') return;

    setSubmittingReturnId(item.id);
    try {
      const response = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          custodyId: item.id,
          returnType: 'GOOD',
          damageDetails: '',
          damageImages: '',
          declarationAck: true,
          notes: '',
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        alert(data?.error || 'تعذر تسجيل طلب الإرجاع');
        return;
      }

      await refresh(pagination.page);
    } finally {
      setSubmittingReturnId(null);
    }
  };

  const showingOverdue = useMemo(() => stats.overdue > 0, [stats.overdue]);

  const statusColor = (s: CustodyStatus) => s === 'OVERDUE' ? '#73384B' : s === 'RETURN_REQUESTED' ? '#8a6a37' : s === 'RETURNED' ? '#4F8F7A' : '#2A6364';
  const statusBg = (s: CustodyStatus) => s === 'OVERDUE' ? '#f4e7eb' : s === 'RETURN_REQUESTED' ? '#f7f1e4' : s === 'RETURNED' ? '#edf4f0' : '#eef5f4';

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header gradient */}
      <section className="overflow-hidden rounded-[20px] bg-gradient-to-l from-[#1a3c3c] to-[#2A6364] p-5 text-white shadow-[0_12px_32px_rgba(42,99,100,0.25)]">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[22px] font-extrabold">
            {canManageCustody ? 'العهد لدى الموظفين' : 'عهدتي'}
          </h1>
          <Link href="/materials/requests"
            className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-2.5 text-[13px] font-extrabold text-[#2A6364] shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition hover:bg-[#f0fbf9]">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            طلب مادة
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: 'إجمالي العهد', value: stats.total },
            { label: 'نشطة', value: stats.active },
            { label: 'متأخرة', value: stats.overdue },
            { label: 'طلبات إرجاع', value: stats.returnRequested },
          ].map((s) => (
            <div key={s.label} className="rounded-[14px] border border-white/10 bg-white/10 px-3 py-3 backdrop-blur-sm">
              <div className="text-[11px] text-white/60">{s.label}</div>
              <div className="mt-1 text-[24px] font-extrabold">{s.value}</div>
            </div>
          ))}
        </div>

        {showingOverdue && (
          <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-white/20 bg-[#73384B]/40 px-3 py-2 text-[12px] text-white">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            {stats.overdue} عهدة تجاوزت تاريخ الإرجاع المحدد
          </div>
        )}
      </section>

      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {([['ALL', 'الكل'], ['ACTIVE', 'نشطة'], ['OVERDUE', 'متأخرة'], ['RETURN_REQUESTED', 'طُلب إرجاعها']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveFilter(key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-[12px] font-bold transition ${activeFilter === key ? 'border-[#2A6364] bg-[#2A6364] text-white' : 'border-[#DADBD9] bg-white text-[#5A5A5A] hover:border-[#2A6364]/30'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" fill="none" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B5BDBE]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={canManageCustody ? 'ابحث باسم المستلم أو المادة أو الطلب...' : 'ابحث باسم المادة أو رقم الطلب...'}
            className="h-10 w-full rounded-full border border-[#DADBD9] bg-white pr-9 pl-4 text-[13px] outline-none focus:border-[#2A6364]/50" />
        </div>
      </div>

      {/* Items grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {loading ? (
          [1,2,3,4].map((i) => <div key={i} className="h-40 animate-pulse rounded-[16px] bg-[#F0F0F0]" />)
        ) : visibleItems.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center justify-center rounded-[20px] border border-[#DADBD9] bg-white py-16 text-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12 text-[#DADBD9]" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z"/>
            </svg>
            <p className="mt-3 text-[13px] text-[#B5BDBE]">لا توجد عهد مسجلة حاليًا</p>
          </div>
        ) : (
          visibleItems.map((item) => {
            const openReturn = pendingReturnFor(item);
            const sColor = statusColor(item.status);
            const sBg = statusBg(item.status);

            return (
              <div key={item.id} className="overflow-hidden rounded-[16px] border border-[#DADBD9] bg-white">
                {/* Card header */}
                <div className="flex items-center justify-between gap-3 border-b border-[#DADBD9] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ backgroundColor: sBg }}>
                      <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" stroke={sColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2 4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="text-[14px] font-extrabold text-[#2A2A2A] leading-tight">{item.itemName}</div>
                      <div className="font-mono text-[10px] text-[#B5BDBE]">{item.code}</div>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: sBg, color: sColor }}>
                    {statusLabel(item.status, language)}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-4">
                  {canManageCustody && (
                    <div className="mb-3 flex items-center gap-2 rounded-[10px] bg-[#eef5f4] px-3 py-2">
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-[#2A6364]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <div>
                        <div className="text-[12px] font-bold text-[#2A6364]">{item.assignedToUserName}</div>
                        {item.assignedToDepartment && <div className="text-[10px] text-[#B5BDBE]">{item.assignedToDepartment}</div>}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-[8px] bg-[#F9F9F9] px-3 py-2">
                      <div className="text-[10px] text-[#B5BDBE]">الكمية</div>
                      <div className="font-bold text-[#2A2A2A]">{item.quantity}</div>
                    </div>
                    <div className="rounded-[8px] bg-[#F9F9F9] px-3 py-2">
                      <div className="text-[10px] text-[#B5BDBE]">الفئة</div>
                      <div className="font-bold text-[#2A2A2A] truncate">{item.category || '—'}</div>
                    </div>
                    <div className="rounded-[8px] bg-[#F9F9F9] px-3 py-2">
                      <div className="text-[10px] text-[#B5BDBE]">تاريخ الاستلام</div>
                      <div className="font-bold text-[#2A2A2A]">{formatDate(item.assignedDate)}</div>
                    </div>
                    <div className={`rounded-[8px] px-3 py-2 ${item.status === 'OVERDUE' ? 'bg-[#f4e7eb]' : 'bg-[#F9F9F9]'}`}>
                      <div className="text-[10px] text-[#B5BDBE]">موعد الإرجاع</div>
                      <div className={`font-bold ${item.status === 'OVERDUE' ? 'text-[#73384B]' : 'text-[#2A2A2A]'}`}>{formatDate(item.dueDate)}</div>
                    </div>
                  </div>

                  {item.requestCode && (
                    <div className="mt-2 flex items-center gap-2 rounded-[8px] bg-[#F9F9F9] px-3 py-2 text-[11px]">
                      <span className="text-[#B5BDBE]">طلب الصرف:</span>
                      <span className="font-mono font-bold text-[#2A6364]">{item.requestCode}</span>
                    </div>
                  )}
                </div>

                {/* Card footer */}
                <div className="flex gap-2 border-t border-[#DADBD9] px-4 pb-4 pt-3">
                  <button onClick={() => setSelectedItem(item)}
                    className="flex-1 rounded-[10px] border border-[#DADBD9] py-2 text-[12px] font-semibold text-[#5A5A5A] hover:bg-[#F9F9F9]">
                    التفاصيل
                  </button>
                  {item.status === 'RETURN_REQUESTED' || openReturn ? (
                    <div className="flex-1 rounded-[10px] bg-[#f7f1e4] py-2 text-center text-[12px] font-semibold text-[#8a6a37]">
                      طلب إرجاع مفتوح
                    </div>
                  ) : item.status !== 'RETURNED' ? (
                    <button onClick={() => createReturnRequest(item)} disabled={submittingReturnId === item.id}
                      className="flex-1 rounded-[10px] bg-[#2A6364] py-2 text-[12px] font-bold text-white transition hover:bg-[#1e5152] disabled:opacity-40">
                      {submittingReturnId === item.id ? '...' : 'طلب إرجاع'}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-[16px] border border-[#DADBD9] bg-white px-4 py-3">
          <button onClick={() => setPagination((p) => ({ ...p, page: Math.max(p.page - 1, 1) }))} disabled={pagination.page <= 1}
            className="rounded-full border border-[#DADBD9] px-4 py-1.5 text-[12px] font-bold text-[#5A5A5A] disabled:opacity-40">السابق</button>
          <div className="text-[12px] font-bold text-[#2A6364]">
            {pagination.page} / {pagination.totalPages}
          </div>
          <button onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.page + 1, p.totalPages) }))} disabled={pagination.page >= pagination.totalPages}
            className="rounded-full border border-[#DADBD9] px-4 py-1.5 text-[12px] font-bold text-[#5A5A5A] disabled:opacity-40">التالي</button>
        </div>
      )}

      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title="تفاصيل العهدة">
        <div className="space-y-4" dir="rtl">
          <div className="grid grid-cols-2 gap-2 rounded-[14px] bg-[#F9F9F9] p-4 text-[13px]">
            {[
              ['المستلم', selectedItem?.assignedToUserName],
              ['الإدارة', selectedItem?.assignedToDepartment],
              ['الكمية', String(selectedItem?.quantity ?? '—')],
              ['رقم الطلب', selectedItem?.requestCode],
              ['المادة', selectedItem?.itemName],
              ['الرقم', selectedItem?.code],
              ['الفئة', selectedItem?.category],
              ['تاريخ الاستلام', formatDate(selectedItem?.assignedDate)],
              ['موعد الإرجاع', formatDate(selectedItem?.dueDate)],
              [language === 'en' ? 'Status' : 'الحالة', selectedItem ? statusLabel(selectedItem.status, language) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-[8px] bg-white px-3 py-2">
                <div className="text-[10px] text-[#B5BDBE]">{k}</div>
                <div className="text-[13px] font-semibold text-[#2A2A2A]">{v || '—'}</div>
              </div>
            ))}
          </div>
          {selectedItem?.notes && (
            <div className="rounded-[12px] border border-[#DADBD9] bg-white p-3 text-[13px] text-[#5A5A5A] whitespace-pre-wrap">
              {selectedItem.notes}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <button onClick={() => setSelectedItem(null)}
              className="rounded-[10px] border border-[#DADBD9] px-5 py-2 text-[13px] font-semibold text-[#5A5A5A] hover:bg-[#F9F9F9]">
              إغلاق
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
