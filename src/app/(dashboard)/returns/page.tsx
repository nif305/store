'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { getInventoryDisplayName } from '@/lib/inventoryLocalization';

type ReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ItemCondition = 'GOOD' | 'PARTIAL_DAMAGE' | 'TOTAL_DAMAGE';
type ReturnSourceType = 'CUSTODY' | 'REQUEST_ITEM';

type ReturnItem = {
  id: string;
  code: string;
  requesterId?: string;
  status: ReturnStatus;
  sourceType?: ReturnSourceType;
  quantity?: number;
  conditionNote?: string | null;
  returnType?: ItemCondition | null;
  damageDetails?: string | null;
  damageImages?: string | null;
  declarationAck?: boolean;
  rejectionReason?: string | null;
  receivedType?: ItemCondition | null;
  receivedNotes?: string | null;
  receivedImages?: string | null;
  createdAt?: string;
  processedAt?: string | null;
  custody?: {
    id: string;
    quantity?: number;
    user?: {
      fullName?: string;
    };
    item?: {
      name?: string;
      code?: string;
      type?: string;
    };
  } | null;
  requestItem?: {
    id: string;
    quantity?: number;
    item?: {
      name?: string;
      code?: string;
      type?: string;
    };
    request?: {
      code?: string;
      purpose?: string;
    };
  } | null;
};

type CustodyOption = {
  id: string;
  quantity: number;
  status: string;
  item?: {
    name?: string;
    code?: string;
  };
};

type RequestReturnOption = {
  id: string;
  quantity: number;
  item?: {
    name?: string;
    code?: string;
    type?: string;
  };
  request?: {
    code?: string;
    purpose?: string;
    status?: string;
  };
  returnRequests?: Array<{
    id: string;
    quantity?: number;
    status?: ReturnStatus;
  }>;
};

type ReturnStats = {
  total: number;
  pending: number;
  good: number;
  damaged: number;
};

type PaginationState = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
};

function conditionLabel(condition?: ItemCondition | null) {
  if (condition === 'GOOD') return 'سليمة';
  if (condition === 'PARTIAL_DAMAGE') return 'غير سليمة - تلف جزئي';
  if (condition === 'TOTAL_DAMAGE') return 'غير سليمة - تلف كلي';
  return '-';
}

function sourceTypeLabel(sourceType?: ReturnSourceType) {
  if (sourceType === 'REQUEST_ITEM') return 'فائض مواد مستهلكة';
  return 'عهدة مسترجعة';
}

function statusBadge(ret: ReturnItem) {
  if (ret.status === 'APPROVED') {
    if (ret.receivedType === 'GOOD') {
      return <Badge variant="success">تم الاستلام والتوثيق - سليمة</Badge>;
    }

    if (ret.receivedType === 'PARTIAL_DAMAGE') {
      return <Badge variant="warning">تم الاستلام والتوثيق - غير سليمة جزئيًا</Badge>;
    }

    if (ret.receivedType === 'TOTAL_DAMAGE') {
      return <Badge variant="danger">تم الاستلام والتوثيق - غير سليمة كليًا</Badge>;
    }

    return <Badge variant="success">تم الإغلاق</Badge>;
  }

  if (ret.status === 'REJECTED') {
    return <Badge variant="danger">مرفوض</Badge>;
  }

  return <Badge variant="warning">بانتظار الاستلام والتوثيق</Badge>;
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return '-';
  }
}

function getReturnItemName(ret?: ReturnItem | null, language: 'ar' | 'en' = 'ar') {
  const item = ret?.custody?.item || ret?.requestItem?.item;
  return item ? getInventoryDisplayName(item, language) : '-';
}

function getReturnItemCode(ret?: ReturnItem | null) {
  return ret?.custody?.item?.code || ret?.requestItem?.item?.code || '-';
}

function getReturnRequesterName(ret?: ReturnItem | null) {
  return ret?.custody?.user?.fullName || '-';
}

function getReturnQuantity(ret?: ReturnItem | null) {
  if (!ret) return 0;
  if (ret.sourceType === 'REQUEST_ITEM') return ret.quantity || 0;
  return ret?.custody?.quantity || ret.quantity || 0;
}

export default function ReturnsPage() {
  const { user } = useAuth();
  const { language } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const role = (user?.role || '').toLowerCase();

  const isEmployee = role === 'user';
  const canProcessReturns = role === 'warehouse';

  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [custodies, setCustodies] = useState<CustodyOption[]>([]);
  const [requestItems, setRequestItems] = useState<RequestReturnOption[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [stats, setStats] = useState<ReturnStats>({
    total: 0,
    pending: 0,
    good: 0,
    damaged: 0,
  });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 5,
  });

  const [receivedType, setReceivedType] = useState<ItemCondition>('GOOD');
  const [receivedNotes, setReceivedNotes] = useState('');
  const [receivedImages, setReceivedImages] = useState<File[]>([]);

  const [returnMode, setReturnMode] = useState<'CUSTODY' | 'REQUEST_ITEM'>('CUSTODY');
  const [custodyId, setCustodyId] = useState('');
  const [requestItemId, setRequestItemId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState<number>(1);
  const [reportedCondition, setReportedCondition] = useState<ItemCondition>('GOOD');
  const [conditionNote, setConditionNote] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [declarationAck, setDeclarationAck] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setPageError('');

      try {
        await Promise.all([
          isEmployee ? fetchCustodies() : Promise.resolve(),
          isEmployee ? fetchReturnableRequestItems() : Promise.resolve(),
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [isEmployee]);

  useEffect(() => {
    let mounted = true;

    const loadPage = async () => {
      setIsLoading(true);
      setPageError('');
      try {
        await fetchReturns();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadPage();

    return () => {
      mounted = false;
    };
  }, [pagination.page]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && isEmployee) {
      setIsCreateOpen(true);
    }
  }, [searchParams, isEmployee]);

  const fetchReturns = async () => {
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      const res = await fetch(`/api/returns?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setReturns([]);
        setStats({ total: 0, pending: 0, good: 0, damaged: 0 });
        setPageError(data?.error || 'تعذر جلب طلبات الإرجاع');
        return;
      }

      const safeData = Array.isArray(data?.data) ? data.data.filter(Boolean) : [];
      const nextPagination: PaginationState = {
        page: Number(data?.pagination?.page || pagination.page),
        totalPages: Number(data?.pagination?.totalPages || 1),
        total: Number(data?.pagination?.total || safeData.length),
        limit: Number(data?.pagination?.limit || pagination.limit),
      };

      if (pagination.page > nextPagination.totalPages && nextPagination.totalPages > 0) {
        setPagination((prev) => ({ ...prev, page: nextPagination.totalPages }));
        return;
      }

      setPageError('');
      setReturns(safeData);
      setStats({
        total: Number(data?.stats?.total || 0),
        pending: Number(data?.stats?.pending || 0),
        good: Number(data?.stats?.good || 0),
        damaged: Number(data?.stats?.damaged || 0),
      });
      setPagination(nextPagination);
    } catch {
      setReturns([]);
      setStats({ total: 0, pending: 0, good: 0, damaged: 0 });
      setPageError('تعذر جلب طلبات الإرجاع');
    }
  };

  const fetchCustodies = async () => {
    try {
      const res = await fetch('/api/custody', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setCustodies([]);
        return;
      }

      const activeCustodies = (data.data || []).filter(
        (item: CustodyOption) => item.status === 'ACTIVE' || item.status === 'OVERDUE'
      );
      setCustodies(activeCustodies);
    } catch {
      setCustodies([]);
    }
  };

  const fetchReturnableRequestItems = async () => {
    try {
      const res = await fetch('/api/requests?mine=1', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setRequestItems([]);
        return;
      }

      const requests = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

      const eligibleItems: RequestReturnOption[] = requests.flatMap((request: any) => {
        const items = Array.isArray(request?.items) ? request.items : [];

        return items
          .filter((item: any) => item?.item?.type === 'CONSUMABLE' && request?.status === 'ISSUED')
          .map((item: any) => ({
            id: item.id,
            quantity: Number(item.quantity || 0),
            item: item.item,
            request: {
              code: request.code,
              purpose: request.purpose,
              status: request.status,
            },
            returnRequests: Array.isArray(item.returnRequests) ? item.returnRequests : [],
          }))
          .filter((item: RequestReturnOption) => {
            const alreadyReturned = (item.returnRequests || [])
              .filter((ret) => ret.status === 'PENDING' || ret.status === 'APPROVED')
              .reduce((sum, ret) => sum + Number(ret.quantity || 0), 0);

            return item.quantity - alreadyReturned > 0;
          });
      });

      setRequestItems(eligibleItems);
    } catch {
      setRequestItems([]);
    }
  };

  const selectedRequestItem = useMemo(() => {
    return requestItems.find((item) => item.id === requestItemId) || null;
  }, [requestItems, requestItemId]);

  const availableRequestReturnQty = useMemo(() => {
    if (!selectedRequestItem) return 0;

    const alreadyReturned = (selectedRequestItem.returnRequests || [])
      .filter((ret) => ret.status === 'PENDING' || ret.status === 'APPROVED')
      .reduce((sum, ret) => sum + Number(ret.quantity || 0), 0);

    return Math.max(0, Number(selectedRequestItem.quantity || 0) - alreadyReturned);
  }, [selectedRequestItem]);

  const resetCreateForm = () => {
    setReturnMode('CUSTODY');
    setCustodyId('');
    setRequestItemId('');
    setReturnQuantity(1);
    setReportedCondition('GOOD');
    setConditionNote('');
    setAttachments([]);
    setDeclarationAck(false);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    resetCreateForm();

    if (searchParams.get('new') === '1') {
      router.replace('/materials/returns');
    }
  };

  const resetProcessForm = () => {
    setSelectedReturn(null);
    setReceivedType('GOOD');
    setReceivedNotes('');
    setReceivedImages([]);
  };

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (returnMode === 'CUSTODY' && !custodyId) {
      alert('اختر العهدة المطلوب إرجاعها');
      return;
    }

    if (returnMode === 'REQUEST_ITEM') {
      if (!requestItemId) {
        alert('اختر بند الطلب المطلوب إعادة فائضه');
        return;
      }

      if (!returnQuantity || returnQuantity <= 0) {
        alert('أدخل كمية صحيحة للإرجاع');
        return;
      }

      if (returnQuantity > availableRequestReturnQty) {
        alert('كمية الإرجاع تتجاوز الكمية المتاحة');
        return;
      }
    }

    const uploadedNames = attachments.map((file) => file.name).join(' | ');

    const payload =
      returnMode === 'CUSTODY'
        ? {
            custodyId,
            notes: conditionNote,
            returnType: reportedCondition,
            damageDetails: reportedCondition === 'GOOD' ? '' : conditionNote,
            damageImages: uploadedNames,
            declarationAck,
          }
        : {
            requestItemId,
            quantity: returnQuantity,
            notes: conditionNote,
            returnType: reportedCondition,
            damageDetails: reportedCondition === 'GOOD' ? '' : conditionNote,
            damageImages: uploadedNames,
            declarationAck,
          };

    const res = await fetch('/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || 'تعذر إنشاء طلب الإرجاع');
      return;
    }

    closeCreateModal();
    await Promise.all([fetchReturns(), fetchCustodies(), fetchReturnableRequestItems()]);
  };

  const handleApproveReturn = async () => {
    if (!selectedReturn) return;

    const uploadedNames = receivedImages.map((file) => file.name).join(' | ');

    const res = await fetch('/api/returns', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        returnId: selectedReturn.id,
        action: 'approve',
        receivedType,
        receivedNotes,
        receivedImages: uploadedNames,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || 'تعذر حفظ الاستلام والإغلاق');
      return;
    }

    resetProcessForm();
    await Promise.all([fetchReturns(), fetchCustodies(), fetchReturnableRequestItems()]);
  };

  const handleRejectReturn = async () => {
    if (!selectedReturn) return;

    const res = await fetch('/api/returns', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        returnId: selectedReturn.id,
        action: 'reject',
        reason: receivedNotes || 'تم رفض طلب الإرجاع',
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || 'تعذر رفض طلب الإرجاع');
      return;
    }

    resetProcessForm();
    await Promise.all([fetchReturns(), fetchCustodies(), fetchReturnableRequestItems()]);
  };

  function ReturnStatusPill({ ret }: { ret: ReturnItem }) {
    if (ret.status === 'APPROVED') {
      const c = ret.receivedType === 'GOOD' ? '#1e6b4c' : ret.receivedType ? '#73384B' : '#1e6b4c';
      const bg = ret.receivedType === 'GOOD' ? '#e8f5ef' : ret.receivedType ? '#f4e7eb' : '#e8f5ef';
      const label = ret.receivedType === 'GOOD' ? 'مُغلق - سليمة' : ret.receivedType === 'PARTIAL_DAMAGE' ? 'مُغلق - تلف جزئي' : ret.receivedType === 'TOTAL_DAMAGE' ? 'مُغلق - تلف كلي' : 'مُغلق';
      return <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: bg, color: c }}>{label}</span>;
    }
    if (ret.status === 'REJECTED') return <span className="rounded-full bg-[#f4e7eb] px-2.5 py-1 text-[11px] font-bold text-[#73384B]">مرفوض</span>;
    return <span className="rounded-full bg-[#f7f1e4] px-2.5 py-1 text-[11px] font-bold text-[#8a6a37]">بانتظار الاستلام</span>;
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <section className="overflow-hidden rounded-[20px] bg-gradient-to-l from-[#1b3d5c] to-[#2E6F8E] p-5 text-white shadow-[0_12px_32px_rgba(46,111,142,0.25)]">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[22px] font-extrabold">
            {isEmployee ? 'طلبات الإرجاع' : 'الاستلام والإغلاق'}
          </h1>
          {isEmployee && (
            <button onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-2.5 text-[13px] font-extrabold text-[#2E6F8E] shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition hover:bg-[#f0f8fc]">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              طلب إرجاع جديد
            </button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: 'إجمالي الطلبات', value: stats.total },
            { label: 'بانتظار الاستلام', value: stats.pending },
            { label: 'أُغلقت سليمة', value: stats.good },
            { label: 'أُغلقت غير سليمة', value: stats.damaged },
          ].map((s) => (
            <div key={s.label} className="rounded-[14px] border border-white/10 bg-white/10 px-3 py-3 backdrop-blur-sm">
              <div className="text-[11px] text-white/60">{s.label}</div>
              <div className="mt-1 text-[24px] font-extrabold">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      {pageError && (
        <div className="rounded-[12px] border border-[#ecd0d8] bg-[#fff7f8] px-4 py-3 text-[13px] text-[#73384B]">{pageError}</div>
      )}

      {/* Returns list */}
      <div className="space-y-3">
        {isLoading ? (
          [1,2,3].map((i) => <div key={i} className="h-28 animate-pulse rounded-[16px] bg-[#F0F0F0]" />)
        ) : returns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[20px] border border-[#DADBD9] bg-white py-16 text-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12 text-[#DADBD9]" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 9H5V5"/><path d="M5 9C6.8 6.6 9 5.5 12 5.5c4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4"/>
            </svg>
            <p className="mt-3 text-[13px] text-[#B5BDBE]">لا توجد طلبات إرجاع</p>
          </div>
        ) : (
          returns.map((ret) => {
            const requesterName = getReturnRequesterName(ret);
            const reqCode = ret.requestItem?.request?.code || null;
            const reqPurpose = ret.requestItem?.request?.purpose || null;
            const isApproved = ret.status === 'APPROVED';
            const isRejected = ret.status === 'REJECTED';
            const hasDamage = ret.returnType === 'PARTIAL_DAMAGE' || ret.returnType === 'TOTAL_DAMAGE';
            const receivedDiffersFromReported = isApproved && ret.receivedType && ret.receivedType !== ret.returnType;
            return (
              <div key={ret.id} className={`overflow-hidden rounded-[16px] border bg-white ${isRejected ? 'border-[#ecd0d8]' : hasDamage ? 'border-[#C7B08C]/30' : 'border-[#DADBD9]'}`}>
                {/* Card header */}
                <div className="flex items-center justify-between gap-3 border-b border-[#F0F0F0] px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${hasDamage ? 'bg-[#f7f1e4]' : 'bg-[#e7eff5]'}`}>
                      <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 ${hasDamage ? 'text-[#8a6a37]' : 'text-[#1b4f68]'}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 9H5V5"/><path d="M5 9C6.8 6.6 9 5.5 12 5.5c4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4"/>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-extrabold text-[#2A2A2A] truncate">{getReturnItemName(ret, language)}</div>
                      <div className="flex items-center gap-2 text-[10px] text-[#B5BDBE]">
                        <span className="font-mono">{ret.code}</span>
                        {requesterName !== '-' && <><span>·</span><span>{requesterName}</span></>}
                      </div>
                    </div>
                  </div>
                  <ReturnStatusPill ret={ret} />
                </div>

                {/* Info grid */}
                <div className="px-4 py-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-[8px] bg-[#F9F9F9] px-3 py-2">
                      <div className="text-[10px] text-[#B5BDBE]">الكمية</div>
                      <div className="text-[13px] font-bold text-[#2A2A2A]">{getReturnQuantity(ret)}</div>
                    </div>
                    <div className="rounded-[8px] bg-[#F9F9F9] px-3 py-2">
                      <div className="text-[10px] text-[#B5BDBE]">المسار</div>
                      <div className="text-[12px] font-bold text-[#2A2A2A]">{sourceTypeLabel(ret.sourceType)}</div>
                    </div>
                    <div className={`rounded-[8px] px-3 py-2 ${hasDamage ? 'bg-[#f7f1e4]' : 'bg-[#F9F9F9]'}`}>
                      <div className="text-[10px] text-[#B5BDBE]">حالة المادة (الموظف)</div>
                      <div className={`text-[12px] font-bold ${hasDamage ? 'text-[#8a6a37]' : 'text-[#2A2A2A]'}`}>{conditionLabel(ret.returnType)}</div>
                    </div>
                    <div className="rounded-[8px] bg-[#F9F9F9] px-3 py-2">
                      <div className="text-[10px] text-[#B5BDBE]">تاريخ الطلب</div>
                      <div className="text-[12px] font-bold text-[#2A2A2A]">{formatDate(ret.createdAt)}</div>
                    </div>
                  </div>

                  {/* Linked request */}
                  {(reqCode || reqPurpose) && (
                    <div className="mt-2 flex items-center gap-2 rounded-[8px] bg-[#eef5f4] px-3 py-2 text-[11px]">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0 text-[#2A6364]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/></svg>
                      <span className="text-[#B5BDBE]">طلب الصرف:</span>
                      {reqCode && <span className="font-mono font-bold text-[#2A6364]">{reqCode}</span>}
                      {reqPurpose && <span className="text-[#5A5A5A] truncate">{reqPurpose}</span>}
                    </div>
                  )}

                  {/* Damage details from employee */}
                  {(ret.damageDetails || ret.conditionNote) && (
                    <div className="mt-2 rounded-[8px] border border-[#C7B08C]/30 bg-[#fffdf5] px-3 py-2 text-[11px]">
                      <span className="font-semibold text-[#8a6a37]">ملاحظات الموظف: </span>
                      <span className="text-[#5A5A5A]">{ret.damageDetails || ret.conditionNote}</span>
                    </div>
                  )}

                  {/* Warehouse received assessment */}
                  {isApproved && ret.receivedType && (
                    <div className={`mt-2 rounded-[8px] px-3 py-2 text-[11px] ${receivedDiffersFromReported ? 'border border-[#ecd0d8] bg-[#fff7f8]' : 'bg-[#e8f5ef]'}`}>
                      <div className="flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" fill="none" className={`h-3.5 w-3.5 shrink-0 ${receivedDiffersFromReported ? 'text-[#73384B]' : 'text-[#1e6b4c]'}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
                        <span className={`font-semibold ${receivedDiffersFromReported ? 'text-[#73384B]' : 'text-[#1e6b4c]'}`}>
                          تقييم المخزن: {conditionLabel(ret.receivedType)}
                        </span>
                        {receivedDiffersFromReported && <span className="text-[#73384B]">— يختلف عن بلاغ الموظف</span>}
                      </div>
                      {ret.receivedNotes && <div className="mt-0.5 text-[#5A5A5A]">{ret.receivedNotes}</div>}
                      {ret.processedAt && <div className="mt-0.5 text-[#B5BDBE]">أُغلق: {formatDate(ret.processedAt)}</div>}
                    </div>
                  )}

                  {/* Rejection reason */}
                  {isRejected && ret.rejectionReason && (
                    <div className="mt-2 rounded-[8px] border border-[#ecd0d8] bg-[#fff7f8] px-3 py-2 text-[11px]">
                      <span className="font-semibold text-[#73384B]">سبب الرفض: </span>
                      <span className="text-[#73384B]">{ret.rejectionReason}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {canProcessReturns && ret.status === 'PENDING' && (
                  <div className="flex gap-2 border-t border-[#DADBD9] px-4 pb-3 pt-2.5">
                    <button
                      onClick={() => { setSelectedReturn(ret); setReceivedType(ret.returnType || 'GOOD'); setReceivedNotes(''); setReceivedImages([]); }}
                      className="flex-1 rounded-[10px] bg-[#2A6364] py-2 text-[12px] font-bold text-white hover:bg-[#1e5152]">
                      استلام وتوثيق الحالة
                    </button>
                    <button
                      onClick={() => { setSelectedReturn(ret); setReceivedType('GOOD'); setReceivedNotes(''); }}
                      className="rounded-[10px] bg-[#f4e7eb] px-3 py-2 text-[12px] font-bold text-[#73384B] hover:bg-[#ecd0d8]">
                      رفض
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {!isLoading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-[16px] border border-[#DADBD9] bg-white px-4 py-3">
          <button onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))} disabled={pagination.page <= 1}
            className="rounded-full border border-[#DADBD9] px-4 py-1.5 text-[12px] font-bold text-[#5A5A5A] disabled:opacity-40">السابق</button>
          <div className="text-[12px] font-bold text-[#2A6364]">{pagination.page} / {pagination.totalPages}</div>
          <button onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))} disabled={pagination.page >= pagination.totalPages}
            className="rounded-full border border-[#DADBD9] px-4 py-1.5 text-[12px] font-bold text-[#5A5A5A] disabled:opacity-40">التالي</button>
        </div>
      )}

      <Modal isOpen={isCreateOpen} onClose={closeCreateModal} title="طلب إرجاع جديد" size="lg">
        <form onSubmit={handleCreateReturn} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-primary">نوع طلب الإرجاع</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setReturnMode('CUSTODY');
                  setRequestItemId('');
                  setReturnQuantity(1);
                }}
                className={`rounded-xl border p-3 text-right text-sm transition ${
                  returnMode === 'CUSTODY'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-surface-border bg-white text-slate-700'
                }`}
              >
                <div className="font-semibold">إرجاع عهدة</div>
                <div className="mt-1 text-[12px] leading-6 text-slate-500">
                  خاص بالمواد الموجودة في عهدتي
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setReturnMode('REQUEST_ITEM');
                  setCustodyId('');
                }}
                className={`rounded-xl border p-3 text-right text-sm transition ${
                  returnMode === 'REQUEST_ITEM'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-surface-border bg-white text-slate-700'
                }`}
              >
                <div className="font-semibold">إرجاع فائض مواد مستهلكة</div>
                <div className="mt-1 text-[12px] leading-6 text-slate-500">
                  خاص بفائض المواد المصروفة مثل الأقلام الزائدة
                </div>
              </button>
            </div>
          </div>

          {returnMode === 'CUSTODY' ? (
            <div>
              <label className="mb-2 block text-sm text-primary">العهدة المطلوب إرجاعها</label>
              <select
                className="w-full rounded-xl border border-surface-border bg-white p-3"
                value={custodyId}
                onChange={(e) => setCustodyId(e.target.value)}
                required={returnMode === 'CUSTODY'}
              >
                <option value="">اختر المادة</option>
                {custodies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getInventoryDisplayName(item.item, language)} {item.item?.code ? `- ${item.item.code}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-sm text-primary">بند الطلب المطلوب إعادة فائضه</label>
                <select
                  className="w-full rounded-xl border border-surface-border bg-white p-3"
                  value={requestItemId}
                  onChange={(e) => {
                    setRequestItemId(e.target.value);
                    setReturnQuantity(1);
                  }}
                  required={returnMode === 'REQUEST_ITEM'}
                >
                  <option value="">اختر بند الطلب</option>
                  {requestItems.map((item) => {
                    const alreadyReturned = (item.returnRequests || [])
                      .filter((ret) => ret.status === 'PENDING' || ret.status === 'APPROVED')
                      .reduce((sum, ret) => sum + Number(ret.quantity || 0), 0);

                    const remaining = Math.max(0, Number(item.quantity || 0) - alreadyReturned);

                    return (
                      <option key={item.id} value={item.id}>
                        {getInventoryDisplayName(item.item, language)}
                        {item.item?.code ? ` - ${item.item.code}` : ''}
                        {item.request?.code ? ` - طلب ${item.request.code}` : ''}
                        {` - المتبقي للإرجاع ${remaining}`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-primary">كمية الفائض المراد إرجاعها</label>
                <input
                  type="number"
                  min={1}
                  max={availableRequestReturnQty || 1}
                  value={returnQuantity}
                  onChange={(e) => setReturnQuantity(Number(e.target.value || 1))}
                  className="w-full rounded-xl border border-surface-border bg-white p-3"
                  required={returnMode === 'REQUEST_ITEM'}
                />
                <div className="mt-2 text-[12px] leading-6 text-slate-500">
                  الكمية المتاحة للإرجاع: {availableRequestReturnQty}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="mb-2 block text-sm text-primary">حالة المادة عند الإرجاع</label>
            <select
              className="w-full rounded-xl border border-surface-border bg-white p-3"
              value={reportedCondition}
              onChange={(e) => setReportedCondition(e.target.value as ItemCondition)}
              required
            >
              <option value="GOOD">سليمة</option>
              <option value="PARTIAL_DAMAGE">غير سليمة - تلف جزئي</option>
              <option value="TOTAL_DAMAGE">غير سليمة - تلف كلي</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">وصف الحالة / ملاحظات</label>
            <textarea
              rows={4}
              className="w-full rounded-xl border border-surface-border p-3"
              value={conditionNote}
              onChange={(e) => setConditionNote(e.target.value)}
              placeholder="ملاحظة الحالة"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">إرفاق صور الحالة</label>
            <input
              type="file"
              multiple
              accept="image/*"
              capture="environment"
              onChange={(e) => setAttachments(Array.from(e.target.files || []))}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
            />
            {attachments.length > 0 ? (
              <div className="mt-2 break-words text-[12px] leading-6 text-slate-500">
                الملفات المختارة: {attachments.map((file) => file.name).join(' ، ')}
              </div>
            ) : null}
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-surface-border p-3 text-sm leading-7 text-slate-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0"
              checked={declarationAck}
              onChange={(e) => setDeclarationAck(e.target.checked)}
              required
            />
            <span>
              أقر بصحة المعلومات، وأن المواد ستُسلّم للاستلام والتوثيق حسب حالتها الفعلية.
            </span>
          </label>

          <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={closeCreateModal}
              className="w-full sm:w-auto"
            >
              إلغاء
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              إرسال طلب الإرجاع
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!selectedReturn}
        onClose={resetProcessForm}
        title="استلام وتوثيق حالة المادة"
        size="lg"
      >
        <div className="space-y-4" dir="rtl">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 rounded-[14px] bg-[#F9F9F9] p-3 text-[12px]">
            {[
              ['المادة', getReturnItemName(selectedReturn, language)],
              ['الكمية', String(getReturnQuantity(selectedReturn))],
              ['المسار', sourceTypeLabel(selectedReturn?.sourceType)],
              ['حالة الموظف', conditionLabel(selectedReturn?.returnType)],
              ['مقدم الطلب', getReturnRequesterName(selectedReturn)],
              ['رقم الطلب', selectedReturn?.requestItem?.request?.code || selectedReturn?.code || '—'],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-[8px] bg-white px-2.5 py-2">
                <div className="text-[10px] text-[#B5BDBE]">{k as string}</div>
                <div className="font-semibold text-[#2A2A2A]">{v as string || '—'}</div>
              </div>
            ))}
          </div>

          {/* Employee notes */}
          {(selectedReturn?.damageDetails || selectedReturn?.conditionNote) && (
            <div className="rounded-[10px] border border-[#C7B08C]/30 bg-[#fffdf5] px-3 py-2.5 text-[12px]">
              <div className="text-[10px] font-bold text-[#8a6a37]">ملاحظات الموظف</div>
              <div className="mt-0.5 text-[#5A5A5A]">{selectedReturn.damageDetails || selectedReturn.conditionNote}</div>
            </div>
          )}
          {selectedReturn?.damageImages && (
            <div className="text-[11px] text-[#B5BDBE]">
              📎 صور الموظف: {selectedReturn.damageImages}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm text-primary">الحالة الموثقة عند الاستلام</label>
            <select
              className="w-full rounded-xl border border-surface-border bg-white p-3"
              value={receivedType}
              onChange={(e) => setReceivedType(e.target.value as ItemCondition)}
            >
              <option value="GOOD">سليمة</option>
              <option value="PARTIAL_DAMAGE">غير سليمة - تلف جزئي</option>
              <option value="TOTAL_DAMAGE">غير سليمة - تلف كلي</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">ملاحظات الاستلام والتوثيق</label>
            <textarea
              rows={5}
              className="w-full rounded-xl border border-surface-border p-3"
              value={receivedNotes}
              onChange={(e) => setReceivedNotes(e.target.value)}
              placeholder="حالة المادة عند الاستلام"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">إرفاق صور عند الاستلام</label>
            <input
              type="file"
              multiple
              accept="image/*"
              capture="environment"
              onChange={(e) => setReceivedImages(Array.from(e.target.files || []))}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
            />
            {receivedImages.length > 0 ? (
              <div className="mt-2 break-words text-[12px] leading-6 text-slate-500">
                الملفات المختارة: {receivedImages.map((file) => file.name).join(' ، ')}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={resetProcessForm}
              className="w-full sm:w-auto"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleRejectReturn}
              className="w-full sm:w-auto"
            >
              رفض الطلب
            </Button>
            <Button type="button" onClick={handleApproveReturn} className="w-full sm:w-auto">
              حفظ الاستلام والإغلاق
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
