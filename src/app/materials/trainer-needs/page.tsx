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
  roomBooking?: {
    id: string;
    status: string;
    requestedLayout?: string | null;
    coordinatorNote?: string | null;
    requestedRoom?: RoomItem | null;
    approvedRoom?: RoomItem | null;
  } | null;
  items: NeedItem[];
  createdAt: string;
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
  const [addCatalogItemId, setAddCatalogItemId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [openedId, setOpenedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [bucket, setBucket] = useState<RequestBucket>('pending');
  const [viewer, setViewer] = useState<Viewer | null>(null);

  const selected = useMemo(() => needs.find((need) => need.id === selectedId) || needs[0], [needs, selectedId]);
  const opened = useMemo(() => needs.find((need) => need.id === openedId) || null, [needs, openedId]);
  const isLocked = opened?.status === 'CONVERTED_TO_REQUEST' || !!opened?.linkedRequest;
  const bucketCounts = useMemo(() => ({
    pending: needs.filter((need) => requestBucket(need.status, need.assignedToId) === 'pending').length,
    active: needs.filter((need) => requestBucket(need.status, need.assignedToId) === 'active').length,
    done: needs.filter((need) => requestBucket(need.status, need.assignedToId) === 'done').length,
  }), [needs]);
  const filteredNeeds = useMemo(
    () => needs.filter((need) => requestBucket(need.status, need.assignedToId) === bucket),
    [bucket, needs]
  );

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

  async function load() {
    setError('');
    setLoading(true);
    try {
      const [needsResponse, catalogResponse] = await Promise.all([
        fetch('/api/trainer-needs', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/training-store/catalog', { cache: 'no-store' }),
      ]);
      const needsJson = await needsResponse.json().catch(() => ({}));
      const catalogJson = await catalogResponse.json().catch(() => ({}));
      if (!needsResponse.ok) throw new Error(needsJson?.error || 'تعذر جلب طلبات المدربين');
      const nextNeeds = Array.isArray(needsJson.data) ? needsJson.data : [];
      setNeeds(nextNeeds);
      setAssignees(Array.isArray(needsJson.assignees) ? needsJson.assignees : []);
      setViewer(needsJson.viewer || null);
      setCatalog(Array.isArray(catalogJson.items) ? catalogJson.items : []);
      const roomsResponse = await fetch('/api/training-rooms/public', { cache: 'no-store' });
      const roomsJson = await roomsResponse.json().catch(() => ({}));
      setRooms(Array.isArray(roomsJson.rooms) ? roomsJson.rooms : []);

      const params = new URLSearchParams(window.location.search);
      const openId = params.get('open');
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
    load();
  }, []);

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
    setSelectedRoomId(opened.roomBooking?.approvedRoom?.id || opened.roomBooking?.requestedRoom?.id || '');
  }, [opened?.id]);

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
      if (actionName === 'update-order') setNotice('تم حفظ تعديل الطلب.');
      if (actionName === 'convert') setNotice('تم اعتماد الطلب وتحويل الكميات المتوفرة إلى طلب مواد للمخزن.');
      if (actionName === 'cancel') setNotice('تم إلغاء الطلب وفك أي حجز مؤقت مرتبط به.');
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
    <div className="space-y-5" dir="rtl">
      <section className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12px] font-bold text-[#2A6364]">طلبات تجهيز الدورات</div>
            <h1 className="mt-1 text-[24px] font-extrabold text-[#223738]">طلبات المدربين</h1>
            <p className="mt-2 text-[13px] text-[#71817f]">
              افتح الطلب، عدل البنود غير المناسبة، ثم اعتمد الكميات المتوفرة فقط ليتم تحويلها إلى طلب مواد للمخزن.
            </p>
          </div>
          <a href="/training-kit" target="_blank" className="rounded-[8px] bg-[#2A6364] px-4 py-2.5 text-[13px] font-extrabold text-white">
            فتح مساعد تجهيز الدورة
          </a>
        </div>
      </section>

      {error ? <div className="rounded-[8px] bg-[#fff1f3] px-4 py-3 text-[13px] font-bold text-[#7c1e3e]">{error}</div> : null}
      {notice ? <div className="rounded-[8px] bg-[#eef8f2] px-4 py-3 text-[13px] font-bold text-[#1e6b4c]">{notice}</div> : null}

      <div className={opened ? 'space-y-5' : 'grid gap-5 xl:grid-cols-[410px_1fr]'}>
        <section className={opened ? 'hidden' : 'rounded-[8px] border border-[#dce6e3] bg-white p-4'}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-extrabold">الطلبات الواردة</h2>
            <button onClick={load} className="rounded-[8px] border border-[#dce6e3] px-3 py-1.5 text-[12px] font-bold">تحديث</button>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {(['pending', 'active', 'done'] as RequestBucket[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setBucket(key)}
                className={`rounded-[8px] border px-2 py-2 text-[12px] transition ${
                  bucket === key ? 'border-[#2A6364] bg-[#2A6364] text-white' : 'border-[#dce6e3] bg-white text-[#536866]'
                }`}
              >
                <span className="block font-bold">{bucketLabel[key]}</span>
                <span className="mt-1 block text-[15px] font-extrabold">{bucketCounts[key]}</span>
              </button>
            ))}
          </div>
          {loading ? (
            <div className="py-12 text-center text-[#71817f]">جاري التحميل...</div>
          ) : filteredNeeds.length === 0 ? (
            <div className="py-12 text-center text-[#71817f]">لا توجد طلبات ضمن هذا التصنيف حالياً</div>
          ) : (
            <div className="max-h-[calc(100vh-280px)] space-y-2 overflow-y-auto">
              {filteredNeeds.map((need) => (
                <div
                  key={need.id}
                  className={`rounded-[8px] border p-4 transition ${
                    selected?.id === need.id ? 'border-[#2A6364] bg-[#eef6f5]' : 'border-[#dce6e3] bg-white'
                  }`}
                >
                  <button type="button" onClick={() => openNeed(need.id)} className="w-full text-right">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-extrabold">{need.courseName}</div>
                        <div className="mt-1 text-[12px] text-[#71817f]">{need.code} - {need.trainerName}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#2A6364]">{statusLabel[need.status] || need.status}</span>
                    </div>
                  </button>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[12px] text-[#536866]">
                    <MiniStat label="مواد" value={need.items.length} />
                    <MiniStat label="متدربين" value={need.traineeCount} />
                    <MiniStat label="تاريخ الدورة" value={formatDate(need.startDate)} />
                  </div>
                  <div className="mt-3 rounded-[8px] bg-[#f6f9f8] px-3 py-2 text-[12px] text-[#536866]">
                    مسند إلى: <span className="font-bold text-[#223738]">{need.assignedTo?.fullName || 'غير مسند'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openNeed(need.id)}
                    className="mt-3 h-10 w-full rounded-[8px] bg-[#2A6364] text-[13px] font-bold text-white"
                  >
                    فتح الطلب ومراجعته
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
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

              <div className="grid gap-3 md:grid-cols-4">
                <InfoCard label="إجمالي الكميات المطلوبة" value={draftStats.requested} />
                <InfoCard label="يمكن تحويله للمخزن الآن" value={draftStats.convertible} tone="green" />
                <InfoCard label="غير متوفر أو يحتاج توفير" value={draftStats.shortage} tone="amber" />
                <InfoCard label="بنود الطلب" value={draftRows.length} />
              </div>

              <div className="rounded-[8px] border border-[#dce6e3] bg-[#fbfcfc] p-4 text-[13px] leading-7 text-[#536866]">
                الكميات المتوفرة فقط تتحول إلى طلب مواد للمخزن. المواد غير المتوفرة لا يتم تحويلها للصرف؛ تبقى واضحة للمنسق كمطلوب يحتاج توفير أو حذف أو استبدال قبل الاعتماد. إذا كانت مادة غير منطقية احذفها من الجدول ثم احفظ تعديل الطلب.
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-bold text-[#536866]">إسناد الطلب</span>
                  <select
                    value={opened.assignedToId || ''}
                    onChange={(event) => action(opened.id, 'assign', { assignedToId: event.target.value || null })}
                    disabled={isLocked}
                    className="h-11 w-full rounded-[8px] border border-[#dce6e3] bg-white px-3 outline-none disabled:bg-[#f4f6f6]"
                  >
                    <option value="">بدون إسناد</option>
                    {assignees.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName} {user.department ? `- ${user.department}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => action(opened.id, 'cancel')}
                    disabled={isLocked || busy === `${opened.id}:cancel`}
                    className="h-11 w-full rounded-[8px] border border-[#7c1e3e] text-[13px] font-bold text-[#7c1e3e] disabled:opacity-50"
                  >
                    إلغاء الطلب
                  </button>
                </div>
              </div>

              <section className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
                <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[16px] font-extrabold text-[#223738]">القاعة التدريبية</div>
                    <div className="mt-1 text-[12px] text-[#71817f]">
                      المطلوبة: {opened.roomBooking?.requestedRoom?.name || 'لم يحدد المدرب قاعة'} - المعتمدة: {opened.roomBooking?.approvedRoom?.name || 'لم تعتمد بعد'}
                    </div>
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
                    <col className="w-[24%]" />
                    <col className="w-[11%]" />
                    <col className="w-[9%]" />
                    <col className="w-[11%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[25%]" />
                  </colgroup>
                  <thead className="bg-[#f6f9f8] text-[#536866]">
                    <tr>
                      <th className="px-4 py-3">المادة</th>
                      <th className="px-4 py-3">الكمية المطلوبة</th>
                      <th className="px-4 py-3">المتاح الآن</th>
                      <th className="px-4 py-3">محجوز لطلبات أخرى</th>
                      <th className="px-4 py-3">سيتحول للمخزن</th>
                      <th className="px-4 py-3">يحتاج توفير</th>
                      <th className="px-4 py-3">قرار المنسق</th>
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
                              <div className="max-w-[280px] text-[12px] leading-6 text-[#536866]">{row.coordinatorNote || '-'}</div>
                            ) : (
                              <div className="grid gap-2">
                                <input value={row.coordinatorNote || ''} onChange={(event) => updateDraftRow(row.catalogItemId, { coordinatorNote: event.target.value })} placeholder="مثال: حذف غير منطقي / توفير لاحق / تخفيض الكمية" className="h-10 w-full rounded-[8px] border border-[#dce6e3] px-2 text-[12px]" />
                                <button type="button" onClick={() => removeDraftRow(row.catalogItemId)} className="h-10 rounded-[8px] bg-[#7c1e3e] px-3 text-[12px] font-bold text-white">حذف البند</button>
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
                  <ActionButton label="حفظ تعديل الطلب" busy={busy === `${opened.id}:update-order`} disabled={isLocked || draftRows.length === 0} onClick={() => action(opened.id, 'update-order', { items: draftRows })} />
                  <ActionButton label="اعتماد الطلب وتحويل المتوفر للمخزن" busy={busy === `${opened.id}:convert`} disabled={isLocked || draftRows.length === 0 || draftStats.convertible === 0} onClick={() => action(opened.id, 'convert', { items: draftRows })} />
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
