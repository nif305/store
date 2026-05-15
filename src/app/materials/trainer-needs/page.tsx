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
  items: NeedItem[];
  createdAt: string;
};

type Assignee = { id: string; fullName: string; department?: string | null };
type CatalogItem = { id: string; title: string; category: string; isOnDemand: boolean; stockQty: number; temporarilyReservedQty: number };
type DraftRow = { catalogItemId: string; title: string; requestedQty: number; coordinatorNote?: string };

const statusLabel: Record<string, string> = {
  NEW: 'جديد',
  IN_REVIEW: 'قيد المراجعة',
  ASSIGNED: 'تم الإسناد',
  PLAN_PROPOSED: 'تم تحليل الطلب',
  RESERVED_AVAILABLE: 'تم الحجز',
  SHORTAGE_IN_PROGRESS: 'نقص قيد المعالجة',
  CONVERTED_TO_REQUEST: 'تحول لطلب مواد',
  CANCELLED: 'ملغي',
};

export default function TrainerNeedsPage() {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [addCatalogItemId, setAddCatalogItemId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const selected = useMemo(() => needs.find((need) => need.id === selectedId) || needs[0], [needs, selectedId]);
  const isLocked = selected?.status === 'CONVERTED_TO_REQUEST' || !!selected?.linkedRequest;

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
      if (!needsResponse.ok) throw new Error(needsJson?.error || 'تعذر جلب الطلبات');
      setNeeds(Array.isArray(needsJson.data) ? needsJson.data : []);
      setAssignees(Array.isArray(needsJson.assignees) ? needsJson.assignees : []);
      setCatalog(Array.isArray(catalogJson.items) ? catalogJson.items : []);
    } catch (err: any) {
      setError(err?.message || 'تعذر جلب الطلبات');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected) {
      setDraftRows([]);
      return;
    }
    setDraftRows(
      selected.items
        .filter((item) => item.catalogItemId)
        .map((item) => ({
          catalogItemId: item.catalogItemId!,
          title: item.title,
          requestedQty: item.requestedQty,
          coordinatorNote: item.coordinatorNote || '',
        }))
    );
  }, [selected?.id]);

  async function action(needId: string, actionName: string, body: Record<string, unknown> = {}) {
    setBusy(`${needId}:${actionName}`);
    setError('');
    try {
      const response = await fetch(`/api/trainer-needs/${needId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: actionName, ...body }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'تعذر تنفيذ الإجراء');
      setNeeds((prev) => prev.map((need) => (need.id === needId ? json.data : need)));
      setSelectedId(needId);
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

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12px] font-bold text-[#2A6364]">قسم داخلي</div>
            <h1 className="mt-1 text-[24px] font-extrabold text-[#223738]">طلبات المدربين</h1>
          </div>
          <a href="/training-kit" target="_blank" className="rounded-[8px] bg-[#2A6364] px-4 py-2.5 text-[13px] font-extrabold text-white">
            فتح مساعد تجهيز الدورة
          </a>
        </div>
      </section>

      {error ? <div className="rounded-[8px] bg-[#fff1f3] px-4 py-3 text-[13px] font-bold text-[#7c1e3e]">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
        <section className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-extrabold">الطلبات الواردة</h2>
            <button onClick={load} className="rounded-[8px] border border-[#dce6e3] px-3 py-1.5 text-[12px] font-bold">تحديث</button>
          </div>
          {loading ? (
            <div className="py-12 text-center text-[#71817f]">جاري التحميل...</div>
          ) : (
            <div className="max-h-[calc(100vh-270px)] space-y-2 overflow-y-auto">
              {needs.map((need) => (
                <button
                  key={need.id}
                  type="button"
                  onClick={() => setSelectedId(need.id)}
                  className={`w-full rounded-[8px] border p-4 text-right transition ${
                    selected?.id === need.id ? 'border-[#2A6364] bg-[#eef6f5]' : 'border-[#dce6e3] bg-white hover:bg-[#fbfcfc]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-extrabold">{need.courseName}</div>
                      <div className="mt-1 text-[12px] text-[#71817f]">{need.code} - {need.trainerName}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#2A6364]">{statusLabel[need.status] || need.status}</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[#e8efee]">
                    <div className="h-2 rounded-full bg-[#2A6364]" style={{ width: `${need.readinessScore || 0}%` }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
          {selected ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-[13px] font-bold text-[#2A6364]">{selected.code}</div>
                  <h2 className="mt-1 text-[24px] font-extrabold">{selected.courseName}</h2>
                  <div className="mt-2 text-[13px] text-[#71817f]">
                    المدرب: {selected.trainerName} - المتدربون: {selected.traineeCount} - بداية الدورة: {new Date(selected.startDate).toLocaleDateString('ar-SA')}
                  </div>
                </div>
                <div className="rounded-[8px] bg-[#f3f7f6] px-4 py-3 text-center">
                  <div className="text-[12px] text-[#71817f]">جاهزية الطلب</div>
                  <div className="text-[26px] font-extrabold text-[#2A6364]">{selected.readinessScore || 0}%</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <ActionButton label="حفظ تعديل الطلب" busy={busy === `${selected.id}:update-order`} disabled={isLocked} onClick={() => action(selected.id, 'update-order', { items: draftRows })} />
                <ActionButton label="تحليل الطلب" busy={busy === `${selected.id}:plan`} disabled={isLocked} onClick={() => action(selected.id, 'plan')} />
                <ActionButton label="اعتماد الطلب وتحويله للمخزن" busy={busy === `${selected.id}:convert`} disabled={isLocked} onClick={() => action(selected.id, 'convert', { items: draftRows })} />
                <ActionButton label="إلغاء الطلب" tone="danger" busy={busy === `${selected.id}:cancel`} disabled={isLocked} onClick={() => action(selected.id, 'cancel')} />
              </div>

              <div className="rounded-[8px] border border-[#dce6e3] bg-[#fbfcfc] p-4 text-[13px] leading-7 text-[#536866]">
                يستطيع المنسق تعديل الطلب قبل تحويله: زيادة الكميات أو تخفيضها أو حذف مادة أو إضافة مادة جديدة. عند اعتماد الطلب يتم إنشاء الحجز الذكي للمتاح ثم تحويل المواد المحجوزة إلى طلب مواد حقيقي يظهر لمسؤول المخزن للصرف. تاريخ نهاية الدورة
                {selected.endDate ? ` (${new Date(selected.endDate).toLocaleDateString('ar-SA')})` : ''} يستخدم كتاريخ إرجاع متوقع للمواد المسترجعة.
              </div>

              <div className="rounded-[8px] border border-[#dce6e3] p-4">
                <label className="text-[12px] font-bold text-[#536866]">إسناد الطلب</label>
                <select
                  value={selected.assignedToId || ''}
                  onChange={(event) => action(selected.id, 'assign', { assignedToId: event.target.value || null })}
                  className="mt-2 h-11 w-full rounded-[8px] border border-[#dce6e3] bg-white px-3 outline-none"
                >
                  <option value="">بدون إسناد</option>
                  {assignees.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} {user.department ? `- ${user.department}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selected.linkedRequest ? (
                <a href={`/materials/requests?open=${selected.linkedRequest.id}`} className="block rounded-[8px] bg-[#eef8f2] px-4 py-3 text-[13px] font-bold text-[#1e6b4c]">
                  تم إنشاء طلب مواد حقيقي: {selected.linkedRequest.code}
                </a>
              ) : null}

              {!isLocked ? (
                <div className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
                  <div className="mb-3 text-[14px] font-extrabold text-[#223738]">تعديل الطلب قبل التحويل</div>
                  <div className="flex flex-col gap-2 md:flex-row">
                    <select value={addCatalogItemId} onChange={(event) => setAddCatalogItemId(event.target.value)} className="h-11 flex-1 rounded-[8px] border border-[#dce6e3] bg-white px-3 text-[13px] outline-none">
                      <option value="">إضافة مادة من المتجر</option>
                      {catalog.map((item) => (
                        <option key={item.id} value={item.id}>{item.title} - {item.category}</option>
                      ))}
                    </select>
                    <button type="button" onClick={addDraftRow} className="h-11 rounded-[8px] bg-[#2A6364] px-4 text-[13px] font-bold text-white">إضافة</button>
                  </div>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-[8px] border border-[#dce6e3]">
                <table className="w-full min-w-[880px] text-right text-[13px]">
                  <thead className="bg-[#f6f9f8] text-[#536866]">
                    <tr>
                      <th className="px-4 py-3">المادة</th>
                      <th className="px-4 py-3">الكمية</th>
                      <th className="px-4 py-3">متاح فعليا</th>
                      <th className="px-4 py-3">محجوز مؤقتا</th>
                      <th className="px-4 py-3">حجز لهذا الطلب</th>
                      <th className="px-4 py-3">النقص</th>
                      <th className="px-4 py-3">إجراء المنسق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1f1]">
                    {draftRows.map((row) => {
                      const item = selected.items.find((needItem) => needItem.catalogItemId === row.catalogItemId);
                      const catalogItem = catalog.find((catalogRow) => catalogRow.id === row.catalogItemId);
                      const stockQty = item?.stockQty ?? catalogItem?.stockQty ?? 0;
                      const reservedQty = item?.temporarilyReservedQty ?? catalogItem?.temporarilyReservedQty ?? 0;
                      return (
                        <tr key={row.catalogItemId}>
                          <td className="px-4 py-3 font-bold">{row.title}</td>
                          <td className="px-4 py-3">
                            {isLocked ? row.requestedQty : (
                              <input type="number" min={1} value={row.requestedQty} onChange={(event) => updateDraftRow(row.catalogItemId, { requestedQty: Math.max(1, Number(event.target.value || 1)) })} className="h-10 w-24 rounded-[8px] border border-[#dce6e3] px-2" />
                            )}
                          </td>
                          <td className="px-4 py-3">{stockQty}</td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-[#8a6a37]">{reservedQty}</div>
                            <div className="text-[11px] text-[#71817f]">لا يخصم من المخزون</div>
                          </td>
                          <td className="px-4 py-3">{item?.reservedQty ?? 0}</td>
                          <td className="px-4 py-3">{item?.shortageQty ?? Math.max(row.requestedQty - stockQty, 0)}</td>
                          <td className="px-4 py-3">
                            {isLocked ? (
                              <>
                                <div className="font-bold">{item?.handlingMode || item?.status || '-'}</div>
                                {row.coordinatorNote ? <div className="mt-1 max-w-[260px] text-[11px] leading-5 text-[#71817f]">{row.coordinatorNote}</div> : null}
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input value={row.coordinatorNote || ''} onChange={(event) => updateDraftRow(row.catalogItemId, { coordinatorNote: event.target.value })} placeholder="ملاحظة المنسق" className="h-10 min-w-[180px] rounded-[8px] border border-[#dce6e3] px-2 text-[12px]" />
                                <button type="button" onClick={() => removeDraftRow(row.catalogItemId)} className="h-10 rounded-[8px] bg-[#7c1e3e] px-3 text-[12px] font-bold text-white">حذف</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-[#71817f]">لا توجد طلبات مدربين حتى الآن</div>
          )}
        </section>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  busy,
  disabled = false,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`h-11 rounded-[8px] px-3 text-[13px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60 ${tone === 'danger' ? 'bg-[#7c1e3e]' : 'bg-[#2A6364]'}`}
    >
      {busy ? 'جاري التنفيذ...' : label}
    </button>
  );
}
