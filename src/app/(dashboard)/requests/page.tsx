'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  getInventoryDisplayName,
  getInventoryDisplayUnit,
  getInventorySearchText,
  getInventoryTypeLabel,
} from '@/lib/inventoryLocalization';

type InventoryItem = {
  id: string;
  code?: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  availableQty: number;
  quantity: number;
  unit?: string | null;
  status?: string;
  type?: 'RETURNABLE' | 'CONSUMABLE';
};

type RequestItemRow = {
  id: string;
  itemId: string;
  quantity: number;
  notes?: string | null;
  expectedReturnDate?: string | null;
  activeIssuedQty?: number;
  returnRequests?: Array<{
    id: string;
    quantity?: number;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  }>;
  item?: {
    id?: string;
    name?: string;
    code?: string;
    availableQty?: number;
    unit?: string | null;
    type?: 'RETURNABLE' | 'CONSUMABLE';
  };
};

type RequestRow = {
  id: string;
  requesterId?: string;
  code: string;
  purpose: string;
  notes?: string | null;
  status: 'PENDING' | 'REJECTED' | 'ISSUED' | 'RETURNED' | 'DRAFT';
  createdAt: string;
  rejectionReason?: string | null;
  requester?: {
    id?: string;
    fullName?: string;
    department?: string;
    email?: string;
  };
  items?: RequestItemRow[];
};

type SelectedItem = {
  itemId: string;
  quantity: number;
  expectedReturnDate?: string;
};

type RequestStats = {
  total: number;
  pending: number;
  rejected: number;
  issued: number;
  returned: number;
  warehouseNew: number;
  warehouseFinished: number;
  warehouseReturns: number;
};

type PaginationState = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
};

type FormMode = 'create' | 'edit' | 'adjust';
type WarehouseViewMode = 'new' | 'finished' | 'returns';

const STATUS_MAP: Record<
  string,
  { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }
> = {
  PENDING: { label: 'جديد', variant: 'warning' },
  REJECTED: { label: 'ملغي / مرفوض', variant: 'danger' },
  ISSUED: { label: 'تم الصرف', variant: 'success' },
  RETURNED: { label: 'تمت الإعادة', variant: 'neutral' },
  DRAFT: { label: 'مسودة', variant: 'neutral' },
};

function formatDate(date?: string | null) {
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  } catch {
    return '—';
  }
}

function normalizeArabic(value: string) {
  return (value || '')
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/\s+/g, ' ');
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10"
      />
    </div>
  );
}

function RequestItemsPreview({
  items,
  requestCode,
  language,
}: {
  items: RequestItemRow[];
  requestCode: string;
  language: 'ar' | 'en';
}) {
  const [open, setOpen] = useState(false);

  if (!items?.length) {
    return <span className="text-sm text-[#61706f]">—</span>;
  }

  const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d6d7d4] bg-[#f8f9f9] px-3 py-2 text-sm font-bold text-[#016564] transition hover:bg-[#eef6f5]"
        >
          <span>عرض المواد</span>
          <span className="rounded-full bg-[#016564] px-2 py-0.5 text-xs text-white">
            {items.length}
          </span>
        </button>

        <div className="text-xs text-[#61706f]">إجمالي الكمية: {totalQty}</div>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title={`مواد الطلب ${requestCode}`}>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[#e8ecec] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-bold text-[#152625]">
                    {getInventoryDisplayName(item.item, language)}
                  </div>
                  <div className="mt-1 text-xs text-[#61706f]">الكمية: {item.quantity}</div>
                  {item.expectedReturnDate ? (
                    <div className="mt-1 text-xs text-[#61706f]">
                      الإرجاع المتوقع: {formatDate(item.expectedReturnDate)}
                    </div>
                  ) : null}
                  {(item.activeIssuedQty || 0) > 0 ? (
                    <div className="mt-1 text-xs text-[#016564]">
                      المتبقي غير المعاد: {item.activeIssuedQty}
                    </div>
                  ) : null}
                </div>

                <Badge variant={item.item?.type === 'RETURNABLE' ? 'info' : 'neutral'}>
                  {getInventoryTypeLabel(item.item?.type, language)}
                </Badge>
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              إغلاق
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function FormShell({
  isOpen,
  onClose,
  title,
  children,
  footer,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 px-0 py-0 sm:px-4 sm:py-6">
      <div className="mx-auto flex h-full items-center justify-center">
        <div className="flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-[1080px] sm:rounded-[28px] sm:border sm:border-[#d6d7d4]">
          <div className="flex items-start justify-between gap-3 border-b border-[#eceeed] px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold text-[#016564] sm:text-xl">{title}</h2>
            </div>

            <Button type="button" variant="ghost" onClick={onClose} className="shrink-0">
              إغلاق
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto bg-white px-4 py-4 sm:px-6 sm:py-5">{children}</div>

          <div className="border-t border-[#eceeed] bg-[#fcfcfc] px-4 py-4 sm:px-6">{footer}</div>
        </div>
      </div>
    </div>
  );
}

export default function RequestsPage() {
  const { user } = useAuth();
  const { language } = useI18n();
  const en = language === 'en';
  const tx = (ar: string, eng: string) => en ? eng : ar;
  const searchParams = useSearchParams();
  const router = useRouter();

  const isManager = user?.role === 'manager';
  const isWarehouse = user?.role === 'warehouse';
  const isEmployee = user?.role === 'user';
  const canIssue = isWarehouse;
  const canUseWarehouseTabs = isWarehouse || isManager;

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RequestStats>({
    total: 0,
    pending: 0,
    rejected: 0,
    issued: 0,
    returned: 0,
    warehouseNew: 0,
    warehouseFinished: 0,
    warehouseReturns: 0,
  });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 5,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [activeRequest, setActiveRequest] = useState<RequestRow | null>(null);

  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedExpectedReturn, setSelectedExpectedReturn] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [warehouseViewMode, setWarehouseViewMode] = useState<WarehouseViewMode>('new');

  const sessionHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'x-active-role': user?.role || 'user',
    }),
    [user?.role]
  );

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });

      if (canUseWarehouseTabs) {
        params.set('view', warehouseViewMode);
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
        rejected: Number(data?.stats?.rejected || 0),
        issued: Number(data?.stats?.issued || 0),
        returned: Number(data?.stats?.returned || 0),
        warehouseNew: Number(data?.stats?.warehouseNew || 0),
        warehouseFinished: Number(data?.stats?.warehouseFinished || 0),
        warehouseReturns: Number(data?.stats?.warehouseReturns || 0),
      });
      setPagination(nextPagination);
    } catch {
      setRequests([]);
      setStats({
        total: 0,
        pending: 0,
        rejected: 0,
        issued: 0,
        returned: 0,
        warehouseNew: 0,
        warehouseFinished: 0,
        warehouseReturns: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [canUseWarehouseTabs, pagination.limit, pagination.page, warehouseViewMode]);

  const fetchInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '200',
        lang: language,
      });
      const res = await fetch(`/api/inventory?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await res.json();
      setAvailableItems(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setAvailableItems([]);
    } finally {
      setInventoryLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [warehouseViewMode]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && isEmployee) {
      openCreateModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isEmployee]);

  useEffect(() => {
    if (isModalOpen) {
      fetchInventory();
    }
  }, [isModalOpen, fetchInventory]);

  const resetForm = useCallback(() => {
    setPurpose('');
    setNotes('');
    setSelectedItems([]);
    setSelectedInventoryId('');
    setSelectedQuantity(1);
    setSelectedExpectedReturn('');
    setItemSearch('');
    setActiveRequest(null);
    setFormMode('create');
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    resetForm();
    if (searchParams.get('new') === '1') {
      router.replace('/materials/requests');
    }
  }, [resetForm, router, searchParams]);

  const openCreateModal = () => {
    resetForm();
    setFormMode('create');
    setIsModalOpen(true);
  };

  const openEditModal = (requestRow: RequestRow) => {
    resetForm();
    setFormMode('edit');
    setActiveRequest(requestRow);
    setPurpose(requestRow.purpose || '');
    setNotes(requestRow.notes || '');
    setSelectedItems(
      (requestRow.items || []).map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        expectedReturnDate: item.expectedReturnDate || '',
      }))
    );
    setIsModalOpen(true);
  };

  const openAdjustModal = (requestRow: RequestRow) => {
    resetForm();
    setFormMode('adjust');
    setActiveRequest(requestRow);
    setSelectedItems(
      (requestRow.items || [])
        .filter((item) => (item.activeIssuedQty || 0) > 0)
        .map((item) => ({
          itemId: item.itemId,
          quantity: 0,
        }))
    );
    setIsModalOpen(true);
  };

  const displayedRequests = requests;

  const filteredInventory = useMemo(() => {
    const q = normalizeArabic(itemSearch);
    const inventoryBase = availableItems.filter((item) => item.availableQty > 0);

    if (!q) return inventoryBase.slice(0, 20);

    return inventoryBase
      .filter((item) => {
        const haystack = normalizeArabic(getInventorySearchText(item, language));
        return haystack.includes(q);
      })
      .slice(0, 20);
  }, [availableItems, itemSearch, language]);

  const selectedInventoryItem = useMemo(() => {
    return availableItems.find((item) => item.id === selectedInventoryId) || null;
  }, [availableItems, selectedInventoryId]);

  const resolveItem = (itemId: string) =>
    availableItems.find((item) => item.id === itemId) ||
    activeRequest?.items?.find((item) => item.itemId === itemId)?.item ||
    requests.flatMap((request) => request.items || []).find((item) => item.itemId === itemId)?.item;

  const addItemToForm = () => {
    if (!selectedInventoryId || selectedQuantity < 1) return;

    const inventoryItem = availableItems.find((item) => item.id === selectedInventoryId);
    if (!inventoryItem) return;

    const existing = selectedItems.find((item) => item.itemId === selectedInventoryId);
    const nextQty = (existing?.quantity || 0) + selectedQuantity;

    if (nextQty > inventoryItem.availableQty) {
      alert(`الكمية تتجاوز المتاح للصنف ${inventoryItem.name}`);
      return;
    }

    if (inventoryItem.type === 'RETURNABLE' && !selectedExpectedReturn) {
      alert('حدد تاريخ الإرجاع المتوقع للمادة المسترجعة');
      return;
    }

    if (existing) {
      setSelectedItems((prev) =>
        prev.map((item) =>
          item.itemId === selectedInventoryId
            ? {
                ...item,
                quantity: nextQty,
                expectedReturnDate:
                  inventoryItem.type === 'RETURNABLE'
                    ? selectedExpectedReturn || item.expectedReturnDate
                    : '',
              }
            : item
        )
      );
    } else {
      setSelectedItems((prev) => [
        ...prev,
        {
          itemId: selectedInventoryId,
          quantity: selectedQuantity,
          expectedReturnDate:
            inventoryItem.type === 'RETURNABLE' ? selectedExpectedReturn : '',
        },
      ]);
    }

    setSelectedInventoryId('');
    setSelectedQuantity(1);
    setSelectedExpectedReturn('');
    setItemSearch('');
  };

  const updateSelectedItemQty = (itemId: string, quantity: number) => {
    const safeQty = Math.max(0, Math.floor(quantity || 0));
    setSelectedItems((prev) =>
      prev.map((item) => (item.itemId === itemId ? { ...item, quantity: safeQty } : item))
    );
  };

  const updateSelectedItemExpectedReturn = (itemId: string, value: string) => {
    setSelectedItems((prev) =>
      prev.map((item) => (item.itemId === itemId ? { ...item, expectedReturnDate: value } : item))
    );
  };

  const removeSelectedItem = (itemId: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.itemId !== itemId));
  };

  const handleIssueOrReject = async (
    id: string,
    action: 'issue' | 'reject',
    notesValue?: string
  ) => {
    const res = await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: sessionHeaders,
      body: JSON.stringify({
        action,
        notes: notesValue || '',
        reason: notesValue || '',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data?.error || 'تعذر تنفيذ العملية');
      return;
    }

    await fetchRequests();
  };

  const handleEmployeeCancel = async (id: string) => {
    const res = await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: sessionHeaders,
      body: JSON.stringify({
        action: 'cancel',
        notes: 'تم الإلغاء من الموظف',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data?.error || 'تعذر إلغاء الطلب');
      return;
    }

    await fetchRequests();
  };

  const handleSubmit = async () => {
    const cleanedItems =
      formMode === 'adjust'
        ? selectedItems
            .filter((item) => item.quantity > 0)
            .map((item) => ({
              itemId: item.itemId,
              quantityToReturn: item.quantity,
            }))
        : selectedItems
            .filter((item) => item.quantity > 0)
            .map((item) => ({
              itemId: item.itemId,
              quantity: item.quantity,
              expectedReturnDate: item.expectedReturnDate || null,
            }));

    if (formMode !== 'adjust' && !purpose.trim()) {
      alert('الغرض من الطلب مطلوب');
      return;
    }

    if (cleanedItems.length === 0) {
      alert('أضف مادة واحدة على الأقل');
      return;
    }

    const invalidReturnable = selectedItems.some((row) => {
      const item = resolveItem(row.itemId) as InventoryItem | undefined;
      return item?.type === 'RETURNABLE' && !row.expectedReturnDate && formMode !== 'adjust';
    });

    if (invalidReturnable) {
      alert('يوجد صنف مسترجع بدون تاريخ إرجاع متوقع');
      return;
    }

    setSubmitting(true);
    try {
      let res: Response;

      if (formMode === 'create') {
        res = await fetch('/api/requests', {
          method: 'POST',
          credentials: 'include',
          headers: sessionHeaders,
          body: JSON.stringify({
            purpose,
            notes,
            items: cleanedItems,
          }),
        });
      } else if (formMode === 'edit' && activeRequest) {
        res = await fetch(`/api/requests/${activeRequest.id}`, {
          method: 'PATCH',
          headers: sessionHeaders,
          body: JSON.stringify({
            action: 'update',
            purpose,
            notes,
            items: cleanedItems,
          }),
        });
      } else if (formMode === 'adjust' && activeRequest) {
        res = await fetch(`/api/requests/${activeRequest.id}`, {
          method: 'PATCH',
          headers: sessionHeaders,
          body: JSON.stringify({
            action: 'adjust_after_issue',
            notes,
            items: cleanedItems,
          }),
        });
      } else {
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || 'تعذر حفظ العملية');
        return;
      }

      handleCloseModal();
      await fetchRequests();
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle =
    formMode === 'create'
      ? 'طلب مواد جديد'
      : formMode === 'edit'
      ? 'تعديل الطلب قبل الصرف'
      : 'طلب إرجاع فائض';

  const statCards = canUseWarehouseTabs
    ? [
        { label: 'طلبات جديدة', value: stats.warehouseNew, color: '#2A6364', bg: '#eef5f4', border: '#cce4e4' },
        { label: 'طلبات منتهية', value: stats.warehouseFinished, color: '#8a6a37', bg: '#f7f1e4', border: '#e8ddbf' },
        { label: 'طلبات أُعيدت', value: stats.warehouseReturns, color: '#4F8F7A', bg: '#edf4f0', border: '#c5dfd7' },
        { label: 'تم الصرف', value: stats.issued, color: '#1e6b4c', bg: '#e8f5ef', border: '#cce6d7' },
        { label: 'مرفوضة', value: stats.rejected, color: '#73384B', bg: '#f4e7eb', border: '#ecd0d8' },
      ]
    : [
        { label: 'إجمالي الطلبات', value: stats.total, color: '#2A6364', bg: '#eef5f4', border: '#cce4e4' },
        { label: 'جديدة', value: stats.pending, color: '#8a6a37', bg: '#f7f1e4', border: '#e8ddbf' },
        { label: 'تمت الإعادة', value: stats.returned, color: '#4F8F7A', bg: '#edf4f0', border: '#c5dfd7' },
        { label: 'تم الصرف', value: stats.issued, color: '#1e6b4c', bg: '#e8f5ef', border: '#cce6d7' },
        { label: 'مرفوضة', value: stats.rejected, color: '#73384B', bg: '#f4e7eb', border: '#ecd0d8' },
      ];

  return (
    <div className="space-y-4 sm:space-y-5" dir="rtl">
      {/* Header */}
      <section className="overflow-hidden rounded-[20px] bg-gradient-to-l from-[#1a3c3c] to-[#2A6364] p-5 text-white shadow-[0_12px_32px_rgba(42,99,100,0.25)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-extrabold">
              {isEmployee ? tx('طلباتي', 'My Requests') : isWarehouse ? tx('الطلبات التشغيلية', 'Operational Requests') : tx('متابعة الطلبات', 'Request Tracking')}
            </h1>
          </div>
          {isEmployee && (
            <button onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-2.5 text-[13px] font-extrabold text-[#2A6364] shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition hover:bg-[#f0fbf9]">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              طلب جديد
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-[14px] border border-white/10 bg-white/10 px-3 py-3 backdrop-blur-sm">
              <div className="text-[11px] text-white/60">{s.label}</div>
              <div className="mt-1 text-[24px] font-extrabold">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      {canUseWarehouseTabs ? (
        <section className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {([['new', 'الجديدة'], ['finished', 'المنتهية'], ['returns', 'المُعادة']] as const).map(([mode, label]) => (
            <button key={mode} onClick={() => setWarehouseViewMode(mode)}
              className={`shrink-0 rounded-full border px-5 py-2 text-[13px] font-bold transition ${warehouseViewMode === mode ? 'border-[#2A6364] bg-[#2A6364] text-white' : 'border-[#DADBD9] bg-white text-[#5A5A5A] hover:border-[#2A6364]/30'}`}>
              {label}
            </button>
          ))}
        </section>
      ) : null}

      <div className="overflow-hidden rounded-[20px] border border-[#DADBD9] bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-[12px] bg-[#F0F0F0]" />
            ))}
          </div>
        ) : displayedRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12 text-[#DADBD9]" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="2"/>
            </svg>
            <p className="mt-3 text-[13px] text-[#B5BDBE]">لا توجد طلبات حتى الآن</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 sm:hidden">
              {displayedRequests.map((req) => {
                const statusMeta = STATUS_MAP[req.status] || {
                  label: req.status,
                  variant: 'neutral' as const,
                };
                const statusColor = req.status === 'ISSUED' ? '#1e6b4c' : req.status === 'RETURNED' ? '#4F8F7A' : req.status === 'REJECTED' ? '#73384B' : '#8a6a37';
                const statusBg = req.status === 'ISSUED' ? '#e8f5ef' : req.status === 'RETURNED' ? '#edf4f0' : req.status === 'REJECTED' ? '#f4e7eb' : '#f7f1e4';

                return (
                  <div
                    key={req.id}
                    className="rounded-[16px] border border-[#DADBD9] bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[12px] font-bold text-[#B5BDBE]">{req.code}</div>
                        <div className="mt-0.5 text-[14px] font-bold text-[#2A2A2A] leading-snug">{req.purpose}</div>
                      </div>
                      <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: statusBg, color: statusColor }}>
                        {statusMeta.label}
                      </span>
                    </div>

                    {!isEmployee ? (
                      <div className="mt-3 rounded-2xl bg-[#f8f9f9] px-3 py-2">
                        <div className="text-xs text-[#6f7b7a]">مقدم الطلب</div>
                        <div className="mt-1 text-sm font-semibold text-[#304342]">
                          {req.requester?.fullName || '—'}
                        </div>
                        {req.requester?.department ? (
                          <div className="mt-1 text-xs text-[#6f7b7a]">{req.requester.department}</div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3 space-y-3 rounded-2xl bg-[#fafcfc] p-3">
                      <div>
                        <div className="text-[11px] text-[#6f7b7a]">تاريخ الطلب</div>
                        <div className="mt-1 text-sm font-semibold text-[#304342]">
                          {formatDate(req.createdAt)}
                        </div>
                      </div>

                      {req.notes ? (
                        <div>
                          <div className="text-[11px] text-[#6f7b7a]">ملاحظات</div>
                          <div className="mt-1 text-sm leading-6 text-[#304342]">{req.notes}</div>
                        </div>
                      ) : null}

                      {req.rejectionReason ? (
                        <div>
                          <div className="text-[11px] text-[#7c1e3e]">سبب الإلغاء / الرفض</div>
                          <div className="mt-1 text-sm leading-6 text-[#7c1e3e]">
                            {req.rejectionReason}
                          </div>
                        </div>
                      ) : null}

                      <div>
                        <div className="text-[11px] text-[#6f7b7a]">المواد المطلوبة</div>
                        <div className="mt-2">
                          <RequestItemsPreview items={req.items || []} requestCode={req.code} language={language} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      {canIssue && req.status === 'PENDING' ? (
                        <>
                          <Button size="sm" onClick={() => handleIssueOrReject(req.id, 'issue')} className="w-full">
                            صرف المواد
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleIssueOrReject(req.id, 'reject', 'تم رفض الطلب')}
                            className="w-full"
                          >
                            رفض
                          </Button>
                        </>
                      ) : null}

                      {isEmployee && req.status === 'PENDING' ? (
                        <>
                          <Button size="sm" onClick={() => openEditModal(req)} className="w-full">
                            تعديل
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleEmployeeCancel(req.id)}
                            className="w-full"
                          >
                            إلغاء
                          </Button>
                        </>
                      ) : null}

                      {isEmployee && req.status === 'ISSUED' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openAdjustModal(req)}
                          className="w-full"
                        >
                          إرجاع فائض
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden sm:block mobile-scroll-x">
              <table className="w-full min-w-[980px] text-right">
                <thead>
                  <tr className="border-b border-[#DADBD9] bg-[#F9F9F9] text-[12px] text-[#2A6364]">
                    <th className="px-4 py-3 font-bold">رقم الطلب</th>
                    {!isEmployee ? <th className="px-4 py-3 font-bold">مقدم الطلب</th> : null}
                    <th className="px-4 py-3 font-bold">الغرض</th>
                    <th className="px-4 py-3 font-bold">المواد المطلوبة</th>
                    <th className="px-4 py-3 font-bold">الحالة</th>
                    <th className="px-4 py-3 font-bold">تاريخ الطلب</th>
                    <th className="px-4 py-3 font-bold">الإجراءات</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#DADBD9]">
                  {displayedRequests.map((req) => {
                    const statusMeta = STATUS_MAP[req.status] || {
                      label: req.status,
                      variant: 'neutral' as const,
                    };
                    const sColor = req.status === 'ISSUED' ? '#1e6b4c' : req.status === 'RETURNED' ? '#4F8F7A' : req.status === 'REJECTED' ? '#73384B' : '#8a6a37';
                    const sBg = req.status === 'ISSUED' ? '#e8f5ef' : req.status === 'RETURNED' ? '#edf4f0' : req.status === 'REJECTED' ? '#f4e7eb' : '#f7f1e4';

                    return (
                      <tr key={req.id} className="align-middle hover:bg-[#F9F9F9]">
                        <td className="px-4 py-3 font-mono text-[12px] font-bold text-[#2A6364]">{req.code}</td>

                        {!isEmployee ? (
                          <td className="px-4 py-3 text-[13px] text-[#2A2A2A]">
                            <div className="font-semibold">{req.requester?.fullName || '—'}</div>
                            <div className="mt-0.5 text-[11px] text-[#B5BDBE]">
                              {req.requester?.department || ''}
                            </div>
                          </td>
                        ) : null}

                        <td className="px-4 py-3">
                          <div className="max-w-[240px] text-[13px] font-semibold text-[#2A2A2A]">
                            {req.purpose}
                          </div>
                          {req.notes ? (
                            <div className="mt-0.5 text-[11px] text-[#B5BDBE]">{req.notes}</div>
                          ) : null}
                          {req.rejectionReason ? (
                            <div className="mt-0.5 text-[11px] text-[#73384B]">
                              {req.rejectionReason}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3">
                          <RequestItemsPreview items={req.items || []} requestCode={req.code} language={language} />
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: sBg, color: sColor }}>
                            {statusMeta.label}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-[12px] text-[#B5BDBE]">{formatDate(req.createdAt)}</td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {canIssue && req.status === 'PENDING' ? (
                              <>
                                <button onClick={() => handleIssueOrReject(req.id, 'issue')}
                                  className="rounded-[8px] bg-[#2A6364] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1e5152]">
                                  صرف المواد
                                </button>
                                <button onClick={() => handleIssueOrReject(req.id, 'reject', 'تم رفض الطلب')}
                                  className="rounded-[8px] bg-[#f4e7eb] px-3 py-1.5 text-[11px] font-bold text-[#73384B] hover:bg-[#ecd0d8]">
                                  رفض
                                </button>
                              </>
                            ) : null}
                            {isEmployee && req.status === 'PENDING' ? (
                              <>
                                <button onClick={() => openEditModal(req)}
                                  className="rounded-[8px] bg-[#eef5f4] px-3 py-1.5 text-[11px] font-bold text-[#2A6364] hover:bg-[#cce4e4]">
                                  تعديل
                                </button>
                                <button onClick={() => handleEmployeeCancel(req.id)}
                                  className="rounded-[8px] bg-[#f4e7eb] px-3 py-1.5 text-[11px] font-bold text-[#73384B] hover:bg-[#ecd0d8]">
                                  إلغاء
                                </button>
                              </>
                            ) : null}
                            {isEmployee && req.status === 'ISSUED' ? (
                              <button onClick={() => openAdjustModal(req)}
                                className="rounded-[8px] bg-[#e7eff5] px-3 py-1.5 text-[11px] font-bold text-[#1b4f68] hover:bg-[#b8d4e4]">
                                إرجاع فائض
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {!loading && pagination.totalPages > 1 ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-[24px] border border-[#d6d7d4] bg-white px-4 py-4 shadow-sm sm:flex-row sm:rounded-[28px] sm:px-5">
          <div className="text-sm font-bold text-[#016564]">
            الصفحة {pagination.page} من {pagination.totalPages}
          </div>
          <div className="text-xs text-[#61706f]">إجمالي الطلبات في هذا العرض: {pagination.total}</div>
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

      <FormShell
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalTitle}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="ghost" onClick={handleCloseModal} className="w-full sm:w-auto">
              إغلاق
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || selectedItems.length === 0}
              className="w-full sm:w-auto"
            >
              {submitting
                ? 'جاري الحفظ...'
                : formMode === 'create'
                ? 'حفظ الطلب'
                : formMode === 'edit'
                ? 'حفظ التعديل'
                : 'رفع طلب الإرجاع'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {formMode !== 'adjust' ? (
            <>
              <section className="rounded-2xl border border-[#e7ebea] bg-[#fcfdfd] p-4 sm:p-5">
                <div className="text-sm font-bold text-[#016564]">بيانات الطلب</div>
                <div className="mt-4">
                  <Input
                    label="الغرض من الطلب"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="الغرض من الطلب"
                  />
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-[#e7ebea] bg-white p-4 sm:p-5">
                  <div className="mb-4 text-sm font-bold text-[#016564]">استعراض المواد</div>

                  <div className="space-y-4">
                    <Input
                      label="ابحث عن المادة"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      placeholder="اسم المادة أو الكود"
                    />

                    <div className="overflow-hidden rounded-2xl border border-[#e7ebea]">
                      <div className="hidden grid-cols-[minmax(0,1.4fr)_110px_110px] gap-3 border-b bg-[#f8f9f9] px-4 py-3 text-xs font-bold text-[#016564] sm:grid">
                        <div>المادة</div>
                        <div>المتاح</div>
                        <div>النوع</div>
                      </div>

                      <div className="max-h-[320px] overflow-y-auto bg-white sm:max-h-[360px]">
                        {inventoryLoading ? (
                          <div className="px-4 py-4 text-sm text-[#61706f]">جاري تحميل المواد...</div>
                        ) : filteredInventory.length === 0 ? (
                          <div className="px-4 py-4 text-sm text-[#61706f]">لا توجد نتائج</div>
                        ) : (
                          filteredInventory.map((item) => {
                            const isSelected = selectedInventoryId === item.id;

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setSelectedInventoryId(item.id);
                                  setSelectedQuantity(1);
                                  setSelectedExpectedReturn('');
                                }}
                                className={`w-full border-b border-[#eef1f1] px-4 py-3 text-right transition last:border-b-0 ${
                                  isSelected ? 'bg-[#eef6f5]' : 'bg-white hover:bg-[#fafcfc]'
                                }`}
                              >
                                <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_110px_110px] sm:gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-[#152625]">
                                      {getInventoryDisplayName(item, language)}
                                    </div>
                                    <div className="mt-1 text-xs text-[#61706f]">
                                      {item.code ? item.code : '—'}
                                    </div>
                                  </div>

                                  <div className="text-sm text-[#304342] sm:self-center">
                                    {item.availableQty}
                                    {item.unit ? ` ${getInventoryDisplayUnit(item, language)}` : ''}
                                  </div>

                                  <div className="sm:self-center">
                                    <Badge variant={item.type === 'RETURNABLE' ? 'info' : 'neutral'}>
                                      {item.type === 'RETURNABLE' ? 'مسترجعة' : 'استهلاكية'}
                                    </Badge>
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e7ebea] bg-white p-4 sm:p-5">
                  <div className="mb-4 text-sm font-bold text-[#016564]">المواد المختارة</div>

                  <div className="space-y-4">
                    {selectedInventoryItem ? (
                      <div className="rounded-2xl border border-[#e7ebea] bg-[#f8f9f9] p-4">
                        <div className="mb-3 text-sm font-semibold text-[#152625]">
                          {getInventoryDisplayName(selectedInventoryItem, language)}
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <Input
                            label="الكمية"
                            type="number"
                            min={1}
                            max={selectedInventoryItem.availableQty || undefined}
                            value={selectedQuantity}
                            onChange={(e) => setSelectedQuantity(Number(e.target.value || 1))}
                          />

                          {selectedInventoryItem.type === 'RETURNABLE' ? (
                            <Input
                              label="تاريخ الإرجاع المتوقع"
                              type="date"
                              value={selectedExpectedReturn}
                              onChange={(e) => setSelectedExpectedReturn(e.target.value)}
                            />
                          ) : (
                            <div className="flex items-end">
                              <div className="w-full rounded-2xl border border-dashed border-[#d6d7d4] bg-white px-4 py-3 text-sm text-[#61706f]">
                                مادة استهلاكية
                              </div>
                            </div>
                          )}

                          <div className="flex items-end">
                            <Button type="button" onClick={addItemToForm} className="w-full">
                              إضافة
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#d6d7d4] bg-[#fcfcfc] px-4 py-5 text-sm text-[#61706f]">
                        اختر مادة من قائمة الاستعراض ليتم إضافتها هنا.
                      </div>
                    )}

                    {selectedItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#d6d7d4] px-4 py-8 text-center text-sm text-[#61706f]">
                        لا توجد مواد مضافة
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedItems.map((item) => {
                          const itemInfo = resolveItem(item.itemId) as
                            | InventoryItem
                            | RequestItemRow['item']
                            | undefined;
                          const isReturnable = itemInfo?.type === 'RETURNABLE';

                          return (
                            <div
                              key={item.itemId}
                              className="rounded-2xl border border-[#e7ebea] bg-white p-4"
                            >
                              <div className="mb-3">
                                <div className="text-sm font-semibold text-[#152625]">
                                  {getInventoryDisplayName(itemInfo, language)}
                                </div>
                                <div className="mt-1 text-xs text-[#61706f]">
                                  {getInventoryTypeLabel(itemInfo?.type, language)}
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-3">
                                <Input
                                  label="الكمية"
                                  type="number"
                                  min={1}
                                  max={(itemInfo as InventoryItem)?.availableQty || undefined}
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateSelectedItemQty(item.itemId, Number(e.target.value || 0))
                                  }
                                />

                                {isReturnable ? (
                                  <Input
                                    label="تاريخ الإرجاع"
                                    type="date"
                                    value={item.expectedReturnDate || ''}
                                    onChange={(e) =>
                                      updateSelectedItemExpectedReturn(item.itemId, e.target.value)
                                    }
                                  />
                                ) : (
                                  <div className="flex items-end">
                                    <div className="w-full rounded-2xl border border-dashed border-[#d6d7d4] bg-[#fcfcfc] px-3 py-3 text-center text-xs text-[#61706f]">
                                      لا ينطبق
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-end">
                                  <Button
                                    type="button"
                                    variant="danger"
                                    className="w-full"
                                    onClick={() => removeSelectedItem(item.itemId)}
                                  >
                                    حذف
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[#e7ebea] bg-white p-4 sm:p-5">
                <TextArea
                  label="ملاحظات عامة"
                  value={notes}
                  onChange={setNotes}
                  placeholder="ملاحظات إضافية"
                  rows={3}
                />
              </section>
            </>
          ) : (
            <>
              <section className="rounded-2xl border border-[#e7ebea] bg-[#fcfdfd] p-4 sm:p-5">
                <div className="mb-4 text-sm font-bold text-[#016564]">بيانات الإرجاع</div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#e7ebea] bg-white px-4 py-3 text-sm text-[#304342]">
                    <div>
                      <span className="font-semibold text-[#016564]">الطلب:</span>{' '}
                      {activeRequest?.code || '—'}
                    </div>
                    <div className="mt-1">
                      <span className="font-semibold text-[#016564]">الغرض:</span>{' '}
                      {activeRequest?.purpose || '—'}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selectedItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#d6d7d4] px-4 py-8 text-center text-sm text-[#61706f]">
                        لا توجد عناصر قابلة للإرجاع
                      </div>
                    ) : (
                      selectedItems.map((item) => {
                        const itemInfo = resolveItem(item.itemId) as
                          | InventoryItem
                          | RequestItemRow['item']
                          | undefined;
                        const activeIssued =
                          activeRequest?.items?.find((row) => row.itemId === item.itemId)
                            ?.activeIssuedQty || 0;

                        return (
                          <div
                            key={item.itemId}
                            className="rounded-2xl border border-[#e7ebea] bg-white p-4"
                          >
                            <div className="mb-3">
                              <div className="text-sm font-semibold text-[#152625]">
                                {getInventoryDisplayName(itemInfo, language)}
                              </div>
                              <div className="mt-1 text-xs text-[#61706f]">
                                المصروف غير المعاد: {activeIssued}
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <Input
                                label="كمية الإرجاع"
                                type="number"
                                min={0}
                                max={activeIssued}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateSelectedItemQty(item.itemId, Number(e.target.value || 0))
                                }
                              />

                              <div className="flex items-end">
                                <div className="w-full rounded-2xl border border-dashed border-[#d6d7d4] bg-[#fcfcfc] px-3 py-3 text-center text-xs text-[#61706f]">
                                  يُستلم لاحقًا
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <TextArea
                    label="ملاحظات الإرجاع"
                    value={notes}
                    onChange={setNotes}
                    placeholder="ملاحظات الإرجاع"
                    rows={3}
                  />
                </div>
              </section>
            </>
          )}
        </div>
      </FormShell>
    </div>
  );
}
