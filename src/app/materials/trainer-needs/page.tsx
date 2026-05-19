'use client';

import { useEffect, useMemo, useState } from 'react';

type NeedItem = {
  id: string;
  catalogItemId?: string | null;
  title: string;
  requestedQty: number;
  reservedQty: number;
  shortageQty: number;
  stockQty: number;
  temporarilyReservedQty: number;
  status: string;
  handlingMode?: string | null;
  coordinatorNote?: string | null;
  inventoryItemId?: string | null;
};

type Need = {
  id: string;
  code: string;
  trainerName: string;
  courseName: string;
  traineeCount: number;
  startDate: string;
  endDate?: string | null;
  status: string;
  readinessScore: number;
  assignedToId?: string | null;
  assignedTo?: { id: string; fullName: string } | null;
  linkedRequest?: { id: string; code: string; status: string } | null;
  decisionNote?: string | null;
  roomBooking?: {
    id: string;
    status: string;
    requestedLayout?: string | null;
    requestedPlan?: { roomId: string; layout?: string; startDate?: string; endDate?: string }[] | null;
    coordinatorNote?: string | null;
    requestedRoom?: RoomItem | null;
    approvedRoom?: RoomItem | null;
  } | null;
  items: NeedItem[];
  createdAt: string;
  updatedAt?: string;
};

type RoomItem = { id: string; name: string; type: string; capacity: number; isAvailable?: boolean };
type Assignee = { id: string; fullName: string; department?: string | null };
type Viewer = { id: string; role: string };
type CatalogItem = {
  id: string;
  title: string;
  category: string;
  isOnDemand: boolean;
  stockQty: number;
  temporarilyReservedQty: number;
};
type DraftRow = { catalogItemId: string; title: string; requestedQty: number; coordinatorNote?: string };
type RequestBucket = 'pending' | 'active' | 'done';
type BucketCounts = Record<RequestBucket, number>;
type PaginationState = { page: number; limit: 5 | 10; total: number; totalPages: number };

const statusLabel: Record<string, string> = {
  NEW: 'جديد',
  IN_REVIEW: 'قيد المراجعة',
  ASSIGNED: 'تم الإسناد',
  PLAN_PROPOSED: 'تمت مراجعة التوفر',
  RESERVED_AVAILABLE: 'المتوفر محجوز',
  SHORTAGE_IN_PROGRESS: 'يوجد نقص',
  CONVERTED_TO_REQUEST: 'تحول إلى طلب مواد',
  CANCELLED: 'ملغي',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ar-SA');
}

function requestBucket(status: string, assignedToId?: string | null): RequestBucket {
  if (status === 'CONVERTED_TO_REQUEST' || status === 'CANCELLED') return 'done';
  if (!assignedToId || status === 'NEW' || status === 'IN_REVIEW') return 'pending';
  return 'active';
}

const bucketLabel: Record<RequestBucket, string> = {
  pending: 'الطلبات المعلقة',
  active: 'الطلبات النشطة',
  done: 'الطلبات المنتهية',
};

export default function TrainerNeedsPage() {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [draftTraineeCount, setDraftTraineeCount] = useState(0);
  const [externalRow, setExternalRow] = useState<string | null>(null);
  const [externalSource, setExternalSource] = useState('');
  const [externalDate, setExternalDate] = useState('');
  const [addCatalogItemId, setAddCatalogItemId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [openedId, setOpenedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [bucket, setBucket] = useState<RequestBucket>('pending');
  const [bucketCounts, setBucketCounts] = useState<BucketCounts>({ pending: 0, active: 0, done: 0 });
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: 5, total: 0, totalPages: 1 });
  const [viewer, setViewer] = useState<Viewer | null>(null);

  const selected = useMemo(() => needs.find((need) => need.id === selectedId) || needs[0], [needs, selectedId]);
  const opened = useMemo(() => needs.find((need) => need.id === openedId) || null, [needs, openedId]);
  const isLocked = opened?.status === 'CONVERTED_TO_REQUEST' || !!opened?.linkedRequest;
  const filteredNeeds = needs;

  const draftStats = useMemo(() => {
    let requested = 0;
    let convertible = 0;
    let shortage = 0;
    for (const row of draftRows) {
      const original = opened?.items.find((item) => item.catalogItemId === row.catalogItemId);
      const catalogItem = catalog.find((item) => item.id === row.catalogItemId);
      const stock = original?.stockQty ?? catalogItem?.stockQty ?? 0;
      const allTemporaryReservations = original?.temporarilyReservedQty ?? catalogItem?.temporarilyReservedQty ?? 0;
      const alreadyReservedForThisRequest = original?.reservedQty ?? 0;
      const reservedByOthers = Math.max(allTemporaryReservations - alreadyReservedForThisRequest, 0);
      const free = Math.max(stock - reservedByOthers, 0);
      const rowConvertible = Math.min(row.requestedQty, Math.max(alreadyReservedForThisRequest, free));
      requested += row.requestedQty;
      convertible += rowConvertible;
      shortage += Math.max(row.requestedQty - rowConvertible, 0);
    }
    return { requested, convertible, shortage };
  }, [catalog, draftRows, opened]);

  const decisionSummary = useMemo(() => {
    const hasRoomRequest = !!opened?.roomBooking;
    const roomApproved = opened?.roomBooking?.status === 'APPROVED' && !!opened.roomBooking?.approvedRoom;
    const needsTraineeCount = draftTraineeCount <= 0;
    const noItems = draftRows.length === 0;
    const noConvertibleItems = draftRows.length > 0 && draftStats.convertible === 0;
    const hasShortage = draftStats.shortage > 0;
    const externallySourcedCount = draftRows.filter((r) => r.coordinatorNote?.startsWith('[تأمين خارجي]')).length;
    const unhandledShortageRows = draftRows.filter((row) => {
      const original = opened?.items.find((i) => i.catalogItemId === row.catalogItemId);
      const stock = original?.stockQty ?? 0;
      const reserved = original?.reservedQty ?? 0;
      const free = Math.max(stock - Math.max((original?.temporarilyReservedQty ?? 0) - reserved, 0), 0);
      const toWarehouse = Math.min(row.requestedQty, Math.max(reserved, free));
      const shortage = Math.max(row.requestedQty - toWarehouse, 0);
      return shortage > 0 && !row.coordinatorNote?.startsWith('[تأمين خارجي]');
    });
    const allShortagesHandled = externallySourcedCount > 0 && unhandledShortageRows.length === 0;
    const readyForWarehouse = !noItems && draftStats.convertible > 0 && !needsTraineeCount && (!hasRoomRequest || roomApproved);

    return {
      readyForWarehouse,
      status: readyForWarehouse ? 'جاهز للتحويل للمخزن' : 'يحتاج استكمال قبل التحويل',
      materialDecision: noItems
        ? 'لا توجد مواد في الطلب'
        : noConvertibleItems && !allShortagesHandled
          ? 'لا توجد كميات متوفرة قابلة للتحويل'
          : hasShortage && allShortagesHandled
            ? `يحول المتوفر (${draftStats.convertible}) — النقص (${draftStats.shortage}) مُعالَج بالتأمين الخارجي`
            : hasShortage
              ? `يحول المتوفر (${draftStats.convertible}) ويبقى النقص (${draftStats.shortage}) يحتاج قرار`
              : `كل الكميات متوفرة للتحويل (${draftStats.convertible})`,
      externalCount: externallySourcedCount,
      unhandledShortage: unhandledShortageRows.length,
      roomDecision: !hasRoomRequest
        ? 'لم يطلب المدرب قاعة'
        : roomApproved
          ? `القاعة المعتمدة: ${opened?.roomBooking?.approvedRoom?.name}`
          : 'طلب القاعة يحتاج اعتماد أو اختيار بديل',
      traineeDecision: needsTraineeCount
        ? 'عدد المتدربين غير محدد؛ حدده لإضافة الأقلام والنوت والملفات تلقائيا'
        : `عدد المتدربين المعتمد: ${draftTraineeCount}`,
      returnDecision: opened?.endDate
        ? `تاريخ إرجاع المواد المسترجعة سيكون ${formatDate(opened.endDate)} عند التحويل للمخزن`
        : 'لا يوجد تاريخ نهاية دورة؛ المواد المسترجعة ستحتاج تاريخ إرجاع قبل الصرف',
    };
  }, [draftRows.length, draftStats.convertible, draftStats.shortage, draftTraineeCount, opened]);

  async function load(page = pagination.page, selectedBucket = bucket, limit = pagination.limit) {
    setError('');
    setLoading(true);
    try {
      const query = new URLSearchParams({
        bucket: selectedBucket,
        page: String(page),
        limit: String(limit),
      });
      const [needsResponse, catalogResponse] = await Promise.all([
        fetch(`/api/trainer-needs?${query.toString()}`, { cache: 'no-store', credentials: 'include' }),
        fetch('/api/training-store/catalog', { cache: 'no-store' }),
      ]);
      const needsJson = await needsResponse.json().catch(() => ({}));
      const catalogJson = await catalogResponse.json().catch(() => ({}));
      if (!needsResponse.ok) throw new Error(needsJson?.error || 'تعذر جلب طلبات المدربين');
      let nextNeeds = Array.isArray(needsJson.data) ? needsJson.data : [];
      const paginationJson = needsJson.pagination || {};
      setBucketCounts({
        pending: Number(needsJson.counts?.pending || 0),
        active: Number(needsJson.counts?.active || 0),
        done: Number(needsJson.counts?.done || 0),
      });
      setPagination({
        page: Number(paginationJson.page || page),
        limit: Number(paginationJson.limit || limit) === 10 ? 10 : 5,
        total: Number(paginationJson.total || nextNeeds.length),
        totalPages: Math.max(1, Number(paginationJson.totalPages || 1)),
      });
      setNeeds(nextNeeds);
      setAssignees(Array.isArray(needsJson.assignees) ? needsJson.assignees : []);
      setViewer(needsJson.viewer || null);
      setCatalog(Array.isArray(catalogJson.items) ? catalogJson.items : []);
      const roomsResponse = await fetch('/api/training-rooms/public', { cache: 'no-store' });
      const roomsJson = await roomsResponse.json().catch(() => ({}));
      setRooms(Array.isArray(roomsJson.rooms) ? roomsJson.rooms : []);

      const params = new URLSearchParams(window.location.search);
      const openId = params.get('open');
      if (openId && !nextNeeds.some((need: Need) => need.id === openId)) {
        const openResponse = await fetch(`/api/trainer-needs/${openId}`, { cache: 'no-store', credentials: 'include' });
        const openJson = await openResponse.json().catch(() => ({}));
        if (openResponse.ok && openJson.data) {
          nextNeeds = [openJson.data, ...nextNeeds.filter((need: Need) => need.id !== openId)];
          setNeeds(nextNeeds);
        }
      }
      if (openId && nextNeeds.some((need: Need) => need.id === openId)) {
        const openedNeed = nextNeeds.find((need: Need) => need.id === openId);
        setSelectedId(openId);
        setOpenedId(openId);
        if (openedNeed) setBucket(requestBucket(openedNeed.status, openedNeed.assignedToId));
      } else if (!selectedId && nextNeeds[0]) {
        setSelectedId(nextNeeds[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'تعذر جلب طلبات المدربين');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(pagination.page, bucket, pagination.limit);
  }, [bucket, pagination.page, pagination.limit]);

  useEffect(() => {
    if (!opened) {
      setDraftRows([]);
      return;
    }
    setDraftRows(
      opened.items
        .filter((item) => item.catalogItemId)
        .map((item) => ({
          catalogItemId: item.catalogItemId!,
          title: item.title,
          requestedQty: item.requestedQty,
          coordinatorNote: item.coordinatorNote || '',
        }))
    );
    setDraftTraineeCount(opened.traineeCount || 0);
    setSelectedRoomId(opened.roomBooking?.approvedRoom?.id || opened.roomBooking?.requestedRoom?.id || '');
  }, [opened?.id, opened?.updatedAt]);

  function openNeed(id: string) {
    setSelectedId(id);
    setOpenedId(id);
    setNotice('');
    window.history.replaceState(null, '', `/materials/trainer-needs?open=${id}`);
  }

  async function action(needId: string, actionName: string, body: Record<string, unknown> = {}) {
    setBusy(`${needId}:${actionName}`);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/trainer-needs/${needId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: actionName, ...body }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'تعذر تنفيذ الإجراء');

      if (json.data?.deleted) {
        setNeeds((prev) => prev.filter((need) => need.id !== needId));
        setOpenedId('');
        setSelectedId('');
        window.history.replaceState(null, '', '/materials/trainer-needs');
        setNotice('تم حذف الطلب.');
        return;
      }

      if (actionName === 'approve-room' || actionName === 'cancel-room') {
        await load();
        setSelectedId(needId);
        setOpenedId(needId);
        setNotice(actionName === 'approve-room' ? 'تم اعتماد القاعة لهذا الطلب.' : 'تم إلغاء حجز القاعة.');
        return;
      }

      setNeeds((prev) => prev.map((need) => (need.id === needId ? json.data : need)));
      setSelectedId(needId);
      setOpenedId(needId);
      if (
        actionName === 'assign' &&
        body.assignedToId &&
        body.assignedToId !== viewer?.id &&
        viewer?.role !== 'MANAGER' &&
        viewer?.role !== 'WAREHOUSE'
      ) {
        setNeeds((prev) => prev.filter((need) => need.id !== needId));
        setOpenedId('');
        setSelectedId('');
        window.history.replaceState(null, '', '/materials/trainer-needs');
        setNotice('تم إسناد الطلب، ولن يظهر في قائمتك لأنه أصبح موجهاً لموظف آخر.');
        return;
      }
      if (actionName === 'update-order') setNotice('تم حفظ تعديلات البنود.');
      if (actionName === 'convert') setNotice('تم اعتماد الطلب وتحويل الكميات المتوفرة إلى طلب مواد للمخزن.');
      if (actionName === 'cancel') setNotice('تم إلغاء الطلب وفك أي حجز مؤقت مرتبط به.');
      if (['assign', 'convert', 'cancel'].includes(actionName)) {
        await load(pagination.page, bucket, pagination.limit);
      }
    } catch (err: any) {
      setError(err?.message || 'تعذر تنفيذ الإجراء');
    } finally {
      setBusy('');
    }
  }

  function updateDraftRow(catalogItemId: string, patch: Partial<DraftRow>) {
    setDraftRows((prev) => prev.map((row) => (row.catalogItemId === catalogItemId ? { ...row, ...patch } : row)));
  }

  function removeDraftRow(catalogItemId: string) {
    setDraftRows((prev) => prev.filter((row) => row.catalogItemId !== catalogItemId));
  }

  function addDraftRow() {
    const item = catalog.find((row) => row.id === addCatalogItemId);
    if (!item) return;
    setDraftRows((prev) => {
      if (prev.some((row) => row.catalogItemId === item.id)) return prev;
      return [...prev, { catalogItemId: item.id, title: item.title, requestedQty: 1, coordinatorNote: '' }];
    });
    setAddCatalogItemId('');
  }

  function isExternallySourced(note?: string) {
    return !!(note && note.startsWith('[تأمين خارجي]'));
  }

  function applyExternalSourcing(catalogItemId: string, qty: number) {
    const note = `[تأمين خارجي] المصدر: ${externalSource || 'غير محدد'} | الكمية: ${qty} | تسليم متوقع: ${externalDate || 'غير محدد'}`;
    updateDraftRow(catalogItemId, { coordinatorNote: note });
    setExternalRow(null);
    setExternalSource('');
    setExternalDate('');
  }

  function removeExternalSourcing(catalogItemId: string) {
    updateDraftRow(catalogItemId, { coordinatorNote: '' });
  }

  function confirmDelete() {
    if (!opened) return;
    if (confirm('سيتم حذف طلب المدرب بالكامل قبل تحويله للمخزن. هل تريد المتابعة؟')) {
      action(opened.id, 'delete');
    }
  }

  function closeOpened() {
    setOpenedId('');
    setNotice('');
    window.history.replaceState(null, '', '/materials/trainer-needs');
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <section className="overflow-hidden rounded-[20px] bg-gradient-to-l from-[#3a1c2c] to-[#73384B] p-5 text-white shadow-[0_12px_32px_rgba(115,56,75,0.22)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/15">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3.5 3 8.5 3 12 0v-5"/>
              </svg>
            </div>
            <div>
              <h1 className="text-[20px] font-extrabold">احتياجات المدربين</h1>
              <div className="text-[11px] text-white/50">{bucketCounts.pending + bucketCounts.active} طلب نشط</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid grid-cols-3 gap-2">
              {(['pending', 'active', 'done'] as RequestBucket[]).map((key) => {
                const colors = { pending: 'border-[#C7B08C]/40 bg-[#C7B08C]/15', active: 'border-green-400/30 bg-green-400/10', done: 'border-white/10 bg-white/8' };
                return (
                  <button key={key} type="button" onClick={() => { setBucket(key); setPagination((p) => ({ ...p, page: 1 })); }}
                    className={`rounded-[12px] border px-3 py-2 text-center transition hover:scale-[1.04] ${bucket === key ? 'border-white/40 bg-white/20' : colors[key]}`}>
                    <div className="text-[18px] font-extrabold text-white">{bucketCounts[key]}</div>
                    <div className="text-[10px] text-white/60">{bucketLabel[key]}</div>
                  </button>
                );
              })}
            </div>
            <a href="/training-kit" target="_blank"
              className="shrink-0 rounded-[12px] bg-white px-4 py-2.5 text-[12px] font-extrabold text-[#73384B] shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:bg-[#fff0f3]">
              مساعد تجهيز الدورة ↗
            </a>
          </div>
        </div>
      </section>

      {error && <div className="rounded-[12px] border border-[#ecd0d8] bg-[#fff7f8] px-4 py-3 text-[13px] text-[#73384B]">{error}</div>}
      {notice && <div className="rounded-[12px] border border-[#cce6d7] bg-[#e8f5ef] px-4 py-3 text-[13px] text-[#1e6b4c]">{notice}</div>}

      <div className="space-y-4">
        <section className={opened ? 'hidden' : 'rounded-[20px] border border-[#DADBD9] bg-white p-4'}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[14px] font-extrabold text-[#2A2A2A]">الطلبات الواردة</div>
            <button onClick={() => load(pagination.page, bucket, pagination.limit)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#DADBD9] text-[#5A5A5A] hover:bg-[#F9F9F9]">
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>
          </div>
          {loading ? (
            <div className="py-12 text-center text-[#71817f]">جاري التحميل...</div>
          ) : filteredNeeds.length === 0 ? (
            <div className="py-12 text-center text-[#71817f]">لا توجد طلبات ضمن هذا التصنيف حالياً</div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredNeeds.map((need) => (
                <div key={need.id}
                  className={`overflow-hidden rounded-[16px] border transition ${selected?.id === need.id ? 'border-[#73384B]/30 bg-[#fff7f8]' : 'border-[#DADBD9] bg-white'}`}>
                  <button type="button" onClick={() => openNeed(need.id)} className="w-full p-4 text-right">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-extrabold text-[#2A2A2A]">{need.courseName}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-[#B5BDBE]">{need.code} · {need.trainerName}</div>
                      </div>
                      <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
                        style={{
                          backgroundColor: need.status === 'NEW' ? '#f7f1e4' : need.status === 'CONVERTED_TO_REQUEST' ? '#e8f5ef' : need.status === 'CANCELLED' ? '#f4e7eb' : '#eef5f4',
                          color: need.status === 'NEW' ? '#8a6a37' : need.status === 'CONVERTED_TO_REQUEST' ? '#1e6b4c' : need.status === 'CANCELLED' ? '#73384B' : '#2A6364',
                        }}>
                        {statusLabel[need.status] || need.status}
                      </span>
                    </div>
                  </button>
                  <div className="grid grid-cols-3 gap-2 border-t border-[#F0F0F0] px-4 pb-3 pt-3 text-center text-[12px]">
                    <div className="rounded-[8px] bg-[#F9F9F9] py-1.5">
                      <div className="text-[13px] font-extrabold text-[#2A6364]">{need.items.length}</div>
                      <div className="text-[10px] text-[#B5BDBE]">مادة</div>
                    </div>
                    <div className="rounded-[8px] bg-[#F9F9F9] py-1.5">
                      <div className="text-[13px] font-extrabold text-[#2A6364]">{need.traineeCount}</div>
                      <div className="text-[10px] text-[#B5BDBE]">متدرب</div>
                    </div>
                    <div className="rounded-[8px] bg-[#F9F9F9] py-1.5">
                      <div className="text-[11px] font-bold text-[#2A6364]">{formatDate(need.startDate)}</div>
                      <div className="text-[10px] text-[#B5BDBE]">تاريخ البدء</div>
                    </div>
                  </div>
                  <div className="border-t border-[#F0F0F0] px-4 pb-4 pt-3">
                    <label className="mb-1.5 block text-[10px] font-bold text-[#B5BDBE]">إسناد الطلب</label>
                    <select value={need.assignedToId || ''}
                      onChange={(e) => action(need.id, 'assign', { assignedToId: e.target.value || null })}
                      className="mb-2.5 h-9 w-full rounded-[10px] border border-[#DADBD9] bg-[#F9F9F9] px-2 text-[12px] outline-none focus:border-[#73384B]/40">
                      <option value="">غير مسند</option>
                      {assignees.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                    </select>
                    <button type="button" onClick={() => openNeed(need.id)}
                      className="h-9 w-full rounded-[10px] bg-[#73384B] text-[12px] font-bold text-white hover:bg-[#5c2a3a]">
                      فتح الطلب ومراجعته
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && pagination.total > 0 ? (
            <div className="mt-4 flex flex-col gap-3 rounded-[8px] border border-[#dce6e3] bg-[#fbfcfc] px-3 py-3 text-[12px] text-[#536866] sm:flex-row sm:items-center sm:justify-between">
              <div>
                عرض {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} - {Math.min(pagination.page * pagination.limit, pagination.total)} من {pagination.total}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={pagination.limit}
                  onChange={(event) => setPagination({ page: 1, limit: Number(event.target.value) === 10 ? 10 : 5, total: pagination.total, totalPages: pagination.totalPages })}
                  className="h-9 rounded-[8px] border border-[#dce6e3] bg-white px-2 outline-none"
                  aria-label="عدد الطلبات في الصفحة"
                >
                  <option value={5}>5 طلبات</option>
                  <option value={10}>10 طلبات</option>
                </select>
                <button
                  type="button"
                  onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page <= 1}
                  className="h-9 rounded-[8px] border border-[#dce6e3] bg-white px-3 disabled:opacity-40"
                >
                  السابق
                </button>
                <span className="px-2">صفحة {pagination.page} من {pagination.totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="h-9 rounded-[8px] border border-[#dce6e3] bg-white px-3 disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className={opened ? 'rounded-[8px] border border-[#dce6e3] bg-white p-5' : 'hidden'}>
          {opened ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 border-b border-[#edf1f1] pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[12px] font-bold text-[#2A6364]">نموذج طلب مواد تدريبية</div>
                  <div className="mt-1 text-[18px] font-extrabold text-[#223738]">مراجعة الطلب وتعديل بنوده قبل التحويل للمخزن</div>
                </div>
                <button
                  type="button"
                  onClick={closeOpened}
                  className="h-10 rounded-[8px] border border-[#dce6e3] px-4 text-[13px] font-bold text-[#2A6364]"
                >
                  العودة إلى قائمة الطلبات
                </button>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-[13px] font-bold text-[#2A6364]">{opened.code}</div>
                  <h2 className="mt-1 text-[24px] font-extrabold">{opened.courseName}</h2>
                  <div className="mt-2 text-[13px] text-[#71817f]">
                    المدرب: {opened.trainerName} - المتدربون: {opened.traineeCount} - بداية الدورة: {formatDate(opened.startDate)} - نهاية الدورة: {formatDate(opened.endDate)}
                  </div>
                </div>
                <div className="rounded-[8px] bg-[#f3f7f6] px-4 py-3 text-center">
                  <div className="text-[12px] text-[#71817f]">حالة الطلب</div>
                  <div className="mt-1 text-[15px] font-extrabold text-[#2A6364]">{statusLabel[opened.status] || opened.status}</div>
                </div>
              </div>

              {opened.linkedRequest ? (
                <a href={`/materials/requests?open=${opened.linkedRequest.id}`} className="block rounded-[8px] bg-[#eef8f2] px-4 py-3 text-[13px] font-bold text-[#1e6b4c]">
                  تم تحويل المتوفر إلى طلب مواد للمخزن: {opened.linkedRequest.code}
                </a>
              ) : null}

              {/* Suggested items from trainer (stored in decisionNote) */}
              {opened.decisionNote && opened.decisionNote.includes('مواد مقترحة') ? (
                <div className="rounded-[8px] border border-[#e8ddbf] bg-[#fffbf0] px-4 py-3">
                  <div className="mb-1 text-[12px] font-extrabold text-[#8a6a37]">
                    مواد مقترحة من المدرب (غير متوفرة في المتجر)
                  </div>
                  <pre className="whitespace-pre-wrap text-[12px] leading-6 text-[#7f6b43]">{opened.decisionNote}</pre>
                  <p className="mt-2 text-[11px] text-[#b8a278]">هذه المواد تحتاج إجراء من المنسق: إما التأمين الخارجي أو إخبار المدرب بعدم التوفر.</p>
                </div>
              ) : null}

              {!isLocked ? (
                <div className="rounded-[8px] border border-[#dce6e3] bg-[#fbfcfc] p-4">
                  <label className="block max-w-sm text-[13px] text-[#536866]">
                    عدد المتدربين المعتمد من المنسق
                    <input
                      type="number"
                      min={0}
                      value={draftTraineeCount}
                      onChange={(event) => setDraftTraineeCount(Math.max(0, Number(event.target.value || 0)))}
                      className="mt-2 h-11 w-full rounded-[8px] border border-[#dce6e3] bg-white px-3 text-[14px] outline-none"
                    />
                  </label>
                  <div className="mt-2 text-[12px] leading-6 text-[#71817f]">
                    عند حفظ الطلب سيتم إضافة الأقلام والنوت والملفات تلقائيا بنفس عدد المتدربين إذا لم تكن موجودة في البنود.
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-4">
                <InfoCard label="إجمالي الكميات المطلوبة" value={draftStats.requested} />
                <InfoCard label="يمكن تحويله للمخزن الآن" value={draftStats.convertible} tone="green" />
                <InfoCard label="غير متوفر أو يحتاج توفير" value={draftStats.shortage} tone="amber" />
                <InfoCard label="بنود الطلب" value={draftRows.length} />
              </div>

              <section className={`rounded-[8px] border p-4 ${decisionSummary.readyForWarehouse ? 'border-[#cfe3d7] bg-[#f3fbf6]' : 'border-[#eadfbd] bg-[#fffaf0]'}`}>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[12px] font-bold text-[#2A6364]">ملخص قرار المنسق</div>
                    <h3 className="mt-1 text-[18px] font-extrabold text-[#223738]">{decisionSummary.status}</h3>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${decisionSummary.readyForWarehouse ? 'bg-white text-[#1e6b4c]' : 'bg-white text-[#8a6a37]'}`}>
                    {decisionSummary.readyForWarehouse ? 'جاهز' : 'يحتاج إجراء'}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <DecisionLine label="قرار المواد" value={decisionSummary.materialDecision} />
                  <DecisionLine label="قرار القاعة" value={decisionSummary.roomDecision} />
                  <DecisionLine label="عدد المتدربين" value={decisionSummary.traineeDecision} />
                  <DecisionLine label="إرجاع المواد المسترجعة" value={decisionSummary.returnDecision} />
                  {decisionSummary.externalCount > 0 && (
                    <div className="rounded-[8px] border border-[#d9c99f] bg-[#fffbf0] px-3 py-3 md:col-span-2">
                      <div className="text-[11px] font-bold text-[#8a6a37]">التأمين الخارجي</div>
                      <div className="mt-1 text-[13px] leading-6 text-[#7f6b43]">
                        {decisionSummary.externalCount} مادة مُحددة للتأمين الخارجي
                        {decisionSummary.unhandledShortage > 0
                          ? ` — لا يزال ${decisionSummary.unhandledShortage} بند يحتاج قرار`
                          : ' — كل المواد الناقصة لها قرار ✓'}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <div className="rounded-[8px] border border-[#dce6e3] bg-[#fbfcfc] p-4 text-[13px] leading-7 text-[#536866]">
                الكميات المتوفرة فقط تتحول إلى طلب مواد للمخزن. المواد غير المتوفرة لا يتم تحويلها للصرف؛ تبقى واضحة للمنسق كمطلوب يحتاج توفير أو حذف أو استبدال قبل الاعتماد. إذا كانت مادة غير منطقية احذفها من الجدول ثم احفظ تعديل الطلب.
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => action(opened.id, 'cancel')}
                  disabled={isLocked || busy === `${opened.id}:cancel`}
                  className="h-11 rounded-[8px] border border-[#7c1e3e] px-5 text-[13px] font-bold text-[#7c1e3e] disabled:opacity-50"
                >
                  إلغاء الطلب
                </button>
              </div>

              <section className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
                <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[16px] font-extrabold text-[#223738]">القاعة التدريبية</div>
                  <div className="mt-1 text-[12px] text-[#71817f]">
                    المطلوبة: {opened.roomBooking?.requestedRoom?.name || 'لم يحدد المدرب قاعة'} - المعتمدة: {opened.roomBooking?.approvedRoom?.name || 'لم تعتمد بعد'}
                  </div>
                  {opened.roomBooking?.requestedPlan?.length ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {opened.roomBooking.requestedPlan.map((plan, index) => {
                        const room = rooms.find((item) => item.id === plan.roomId);
                        return (
                          <div key={`${plan.roomId}-${index}`} className="rounded-[8px] border border-[#edf1f1] bg-[#fbfcfc] px-3 py-2 text-[12px] text-[#536866]">
                            <div className="font-bold text-[#223738]">{room?.name || 'قاعة محددة'}</div>
                            <div className="mt-1">من {formatDate(plan.startDate)} إلى {formatDate(plan.endDate)}</div>
                            <div className="mt-1">الترتيب: {plan.layout || 'بدون تفضيل محدد'}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                  <span className="rounded-full bg-[#f3f7f6] px-3 py-1 text-[12px] text-[#2A6364]">{opened.roomBooking?.status || 'بدون طلب قاعة'}</span>
                </div>
                <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                  <select value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)} className="h-11 rounded-[8px] border border-[#dce6e3] bg-white px-3 text-[13px] outline-none">
                    <option value="">اختر قاعة للاعتماد أو البديل</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>{room.name} - {room.type} - سعة {room.capacity}</option>
                    ))}
                  </select>
                  <button type="button" disabled={!selectedRoomId || busy === `${opened.id}:approve-room`} onClick={() => action(opened.id, 'approve-room', { roomId: selectedRoomId })} className="h-11 rounded-[8px] bg-[#2A6364] px-4 text-[13px] font-bold text-white disabled:opacity-50">اعتماد القاعة</button>
                  <button type="button" disabled={!opened.roomBooking || busy === `${opened.id}:cancel-room`} onClick={() => action(opened.id, 'cancel-room')} className="h-11 rounded-[8px] border border-[#7c1e3e] px-4 text-[13px] font-bold text-[#7c1e3e] disabled:opacity-50">إلغاء حجز القاعة</button>
                </div>
              </section>

              {!isLocked ? (
                <div className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
                  <div className="mb-3 text-[14px] font-extrabold text-[#223738]">إضافة مادة للطلب</div>
                  <div className="flex flex-col gap-2 md:flex-row">
                    <select value={addCatalogItemId} onChange={(event) => setAddCatalogItemId(event.target.value)} className="h-11 flex-1 rounded-[8px] border border-[#dce6e3] bg-white px-3 text-[13px] outline-none">
                      <option value="">اختر مادة من المتجر</option>
                      {catalog.map((item) => (
                        <option key={item.id} value={item.id}>{item.title} - {item.category}</option>
                      ))}
                    </select>
                    <button type="button" onClick={addDraftRow} className="h-11 rounded-[8px] bg-[#2A6364] px-4 text-[13px] font-bold text-white">إضافة</button>
                  </div>
                </div>
              ) : null}

              <div className="overflow-visible rounded-[8px] border border-[#dce6e3]">
                <table className="w-full table-fixed text-right text-[13px]">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[10%]" />
                    <col className="w-[8%]" />
                    <col className="w-[10%]" />
                    <col className="w-[9%]" />
                    <col className="w-[9%]" />
                    <col className="w-[32%]" />
                  </colgroup>
                  <thead className="bg-[#f6f9f8] text-[#536866]">
                    <tr>
                      <th className="px-4 py-3">المادة</th>
                      <th className="px-4 py-3">المطلوب</th>
                      <th className="px-4 py-3">المتاح</th>
                      <th className="px-4 py-3">محجوز لغيره</th>
                      <th className="px-4 py-3">للمخزن</th>
                      <th className="px-4 py-3">نقص</th>
                      <th className="px-4 py-3">قرار المنسق / التأمين الخارجي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1f1]">
                    {draftRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-[#71817f]">لا توجد مواد في الطلب. أضف مادة واحدة على الأقل قبل الحفظ.</td>
                      </tr>
                    ) : draftRows.map((row) => {
                      const original = opened.items.find((item) => item.catalogItemId === row.catalogItemId);
                      const catalogItem = catalog.find((item) => item.id === row.catalogItemId);
                      const stockQty = original?.stockQty ?? catalogItem?.stockQty ?? 0;
                      const allTemporaryReservations = original?.temporarilyReservedQty ?? catalogItem?.temporarilyReservedQty ?? 0;
                      const alreadyReservedForThisRequest = original?.reservedQty ?? 0;
                      const reservedByOthers = Math.max(allTemporaryReservations - alreadyReservedForThisRequest, 0);
                      const freeQty = Math.max(stockQty - reservedByOthers, 0);
                      const toWarehouse = Math.min(row.requestedQty, Math.max(alreadyReservedForThisRequest, freeQty));
                      const shortage = Math.max(row.requestedQty - toWarehouse, 0);
                      return (
                        <tr key={row.catalogItemId}>
                          <td className="px-4 py-3">
                            <div className="font-bold">{row.title}</div>
                            {shortage > 0 ? <div className="mt-1 text-[11px] text-[#8a6a37]">هذا البند يحتاج قرار توفير أو تخفيض كمية أو حذف</div> : null}
                          </td>
                          <td className="px-4 py-3">
                            {isLocked ? row.requestedQty : (
                              <input type="number" min={1} value={row.requestedQty} onChange={(event) => updateDraftRow(row.catalogItemId, { requestedQty: Math.max(1, Number(event.target.value || 1)) })} className="h-10 w-full rounded-[8px] border border-[#dce6e3] px-2" />
                            )}
                          </td>
                          <td className="px-4 py-3">{stockQty}</td>
                          <td className="px-4 py-3">{reservedByOthers}</td>
                          <td className="px-4 py-3 text-[#1e6b4c]">{toWarehouse}</td>
                          <td className="px-4 py-3 text-[#8a6a37]">{shortage}</td>
                          <td className="px-4 py-3">
                            {isLocked ? (
                              <div className="space-y-1">
                                {isExternallySourced(row.coordinatorNote) ? (
                                  <div className="rounded-[6px] border border-[#d9c99f] bg-[#fffbf0] px-2 py-1.5 text-[11px] leading-5 text-[#7f6b43]">
                                    <span className="font-bold">تأمين خارجي</span><br />{row.coordinatorNote?.replace('[تأمين خارجي]', '').trim()}
                                  </div>
                                ) : (
                                  <div className="text-[12px] leading-6 text-[#536866]">{row.coordinatorNote || '-'}</div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {/* Normal note input */}
                                {!isExternallySourced(row.coordinatorNote) && externalRow !== row.catalogItemId && (
                                  <input
                                    value={row.coordinatorNote || ''}
                                    onChange={(e) => updateDraftRow(row.catalogItemId, { coordinatorNote: e.target.value })}
                                    placeholder="ملاحظة المنسق..."
                                    className="h-9 w-full rounded-[6px] border border-[#dce6e3] px-2 text-[12px]"
                                  />
                                )}

                                {/* External sourcing tag */}
                                {isExternallySourced(row.coordinatorNote) && externalRow !== row.catalogItemId && (
                                  <div className="rounded-[6px] border border-[#d9c99f] bg-[#fffbf0] px-2 py-1.5 text-[11px] leading-5 text-[#7f6b43]">
                                    <span className="font-bold">تأمين خارجي ✓</span>
                                    <br />{row.coordinatorNote?.replace('[تأمين خارجي]', '').trim()}
                                    <button onClick={() => removeExternalSourcing(row.catalogItemId)} className="mr-2 text-[#7c1e3e] underline">إلغاء</button>
                                  </div>
                                )}

                                {/* Inline external sourcing form */}
                                {externalRow === row.catalogItemId && (
                                  <div className="space-y-1.5 rounded-[8px] border border-[#d9c99f] bg-[#fffbf0] p-2">
                                    <div className="text-[11px] font-bold text-[#8a6a37]">تفاصيل التأمين الخارجي</div>
                                    <input
                                      value={externalSource}
                                      onChange={(e) => setExternalSource(e.target.value)}
                                      placeholder="المصدر / المورد"
                                      className="h-8 w-full rounded-[6px] border border-[#e8ddbf] bg-white px-2 text-[11px]"
                                    />
                                    <input
                                      type="date"
                                      value={externalDate}
                                      onChange={(e) => setExternalDate(e.target.value)}
                                      className="h-8 w-full rounded-[6px] border border-[#e8ddbf] bg-white px-2 text-[11px]"
                                    />
                                    <div className="flex gap-1.5">
                                      <button onClick={() => applyExternalSourcing(row.catalogItemId, shortage)} className="flex-1 h-8 rounded-[6px] bg-[#8a6a37] text-[11px] font-bold text-white">تأكيد</button>
                                      <button onClick={() => setExternalRow(null)} className="h-8 rounded-[6px] border border-[#dce6e3] px-3 text-[11px] text-[#536866]">إلغاء</button>
                                    </div>
                                  </div>
                                )}

                                {/* Buttons row */}
                                <div className="flex flex-wrap gap-1.5">
                                  {shortage > 0 && !isExternallySourced(row.coordinatorNote) && externalRow !== row.catalogItemId && (
                                    <button
                                      type="button"
                                      onClick={() => { setExternalRow(row.catalogItemId); setExternalSource(''); setExternalDate(''); }}
                                      className="h-8 rounded-[6px] border border-[#d9c99f] bg-white px-2 text-[11px] font-bold text-[#8a6a37] hover:bg-[#fffbf0]"
                                    >
                                      تأمين خارجي
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeDraftRow(row.catalogItemId)}
                                    className="h-8 rounded-[6px] bg-[#7c1e3e] px-2 text-[11px] font-bold text-white"
                                  >
                                    حذف
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <ActionButton label="حفظ تعديلات الطلب" busy={busy === `${opened.id}:update-order`} disabled={isLocked || draftRows.length === 0} onClick={() => action(opened.id, 'update-order', { traineeCount: draftTraineeCount, items: draftRows })} />
                  <ActionButton label="اعتماد الطلب وتحويل المتوفر للمخزن" busy={busy === `${opened.id}:convert`} disabled={isLocked || draftRows.length === 0 || draftStats.convertible === 0} onClick={() => action(opened.id, 'convert', { traineeCount: draftTraineeCount, items: draftRows })} />
                </div>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isLocked || busy === `${opened.id}:delete`}
                  className="h-11 rounded-[8px] bg-[#7c1e3e] px-5 text-[13px] font-bold text-white disabled:opacity-50"
                >
                  حذف الطلب بالكامل
                </button>
              </div>

              {draftStats.convertible === 0 && !isLocked ? (
                <div className="rounded-[8px] bg-[#fff8e8] px-4 py-3 text-[13px] leading-7 text-[#7d5c22]">
                  لا توجد كمية متوفرة قابلة للتحويل للمخزن حالياً. يمكنك حذف البنود غير المناسبة، تخفيض الكميات، إضافة بدائل متوفرة، أو حفظ الطلب كمراجعة داخلية لحين توفير المواد.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="py-24 text-center text-[#71817f]">
              اختر طلباً من القائمة ثم اضغط “فتح الطلب ومراجعته” للاطلاع على تفاصيله وتعديله.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[8px] bg-[#f6f9f8] px-2 py-2">
      <div className="text-[11px] text-[#71817f]">{label}</div>
      <div className="mt-1 font-bold text-[#223738]">{value}</div>
    </div>
  );
}

function InfoCard({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'green' | 'amber' }) {
  const color = tone === 'green' ? 'text-[#1e6b4c]' : tone === 'amber' ? 'text-[#8a6a37]' : 'text-[#223738]';
  return (
    <div className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
      <div className="text-[12px] text-[#71817f]">{label}</div>
      <div className={`mt-2 text-[26px] font-extrabold ${color}`}>{value}</div>
    </div>
  );
}

function DecisionLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-white/80 bg-white px-3 py-3">
      <div className="text-[11px] font-bold text-[#71817f]">{label}</div>
      <div className="mt-1 text-[13px] leading-6 text-[#223738]">{value}</div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  busy,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="h-11 rounded-[8px] bg-[#2A6364] px-5 text-[13px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? 'جاري التنفيذ...' : label}
    </button>
  );
}
