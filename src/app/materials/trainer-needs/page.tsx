'use client';

import { useEffect, useMemo, useState } from 'react';

type NeedItem = {
  id: string;
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

const statusLabel: Record<string, string> = {
  NEW: 'جديد',
  IN_REVIEW: 'قيد المراجعة',
  ASSIGNED: 'تم الإسناد',
  PLAN_PROPOSED: 'خطة مقترحة',
  RESERVED_AVAILABLE: 'تم الحجز',
  SHORTAGE_IN_PROGRESS: 'نقص قيد المعالجة',
  CONVERTED_TO_REQUEST: 'تحول لطلب مواد',
  CANCELLED: 'ملغي',
};

export default function TrainerNeedsPage() {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const selected = useMemo(() => needs.find((need) => need.id === selectedId) || needs[0], [needs, selectedId]);

  async function load() {
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/trainer-needs', { cache: 'no-store', credentials: 'include' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'تعذر جلب الاحتياجات');
      setNeeds(Array.isArray(json.data) ? json.data : []);
      setAssignees(Array.isArray(json.assignees) ? json.assignees : []);
    } catch (err: any) {
      setError(err?.message || 'تعذر جلب الاحتياجات');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12px] font-bold text-[#2A6364]">قسم داخلي</div>
            <h1 className="mt-1 text-[24px] font-extrabold text-[#223738]">احتياجات المدربين</h1>
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
                  <div className="text-[12px] text-[#71817f]">جاهزية الخطة</div>
                  <div className="text-[26px] font-extrabold text-[#2A6364]">{selected.readinessScore || 0}%</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <ActionButton label="اقتراح خطة تجهيز" busy={busy === `${selected.id}:plan`} onClick={() => action(selected.id, 'plan')} />
                <ActionButton label="اعتماد الخطة والتحويل لطلب مواد" busy={busy === `${selected.id}:convert`} onClick={() => action(selected.id, 'convert')} />
                <ActionButton label="إلغاء الاحتياج" tone="danger" busy={busy === `${selected.id}:cancel`} onClick={() => action(selected.id, 'cancel')} />
              </div>

              <div className="rounded-[8px] border border-[#dce6e3] bg-[#fbfcfc] p-4 text-[13px] leading-7 text-[#536866]">
                عند اعتماد الخطة يتم إنشاء الحجز الذكي تلقائيًا ثم تحويل المواد المتاحة إلى طلب مواد. تاريخ نهاية الدورة
                {selected.endDate ? ` (${new Date(selected.endDate).toLocaleDateString('ar-SA')})` : ''} يستخدم كتاريخ إرجاع متوقع للمواد المسترجعة.
              </div>

              <div className="rounded-[8px] border border-[#dce6e3] p-4">
                <label className="text-[12px] font-bold text-[#536866]">إسناد الاحتياج</label>
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
                  تم إنشاء طلب مواد: {selected.linkedRequest.code}
                </a>
              ) : null}

              <div className="overflow-hidden rounded-[8px] border border-[#dce6e3]">
                <table className="w-full min-w-[780px] text-right text-[13px]">
                  <thead className="bg-[#f6f9f8] text-[#536866]">
                    <tr>
                      <th className="px-4 py-3">المادة</th>
                      <th className="px-4 py-3">المطلوب</th>
                      <th className="px-4 py-3">متاح فعليا</th>
                      <th className="px-4 py-3">محجوز مؤقتا</th>
                      <th className="px-4 py-3">حجز لهذا الاحتياج</th>
                      <th className="px-4 py-3">النقص</th>
                      <th className="px-4 py-3">المعالجة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1f1]">
                    {selected.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-bold">{item.title}</td>
                        <td className="px-4 py-3">{item.requestedQty}</td>
                        <td className="px-4 py-3">{item.stockQty}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-[#8a6a37]">{item.temporarilyReservedQty}</div>
                          <div className="text-[11px] text-[#71817f]">لا يخصم من المخزون</div>
                        </td>
                        <td className="px-4 py-3">{item.reservedQty}</td>
                        <td className="px-4 py-3">{item.shortageQty}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold">{item.handlingMode || item.status}</div>
                          {item.coordinatorNote ? <div className="mt-1 max-w-[260px] text-[11px] leading-5 text-[#71817f]">{item.coordinatorNote}</div> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-[#71817f]">لا توجد احتياجات مدربين حتى الآن</div>
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
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`h-11 rounded-[8px] px-3 text-[13px] font-extrabold text-white disabled:opacity-60 ${tone === 'danger' ? 'bg-[#7c1e3e]' : 'bg-[#2A6364]'}`}
    >
      {busy ? 'جاري التنفيذ...' : label}
    </button>
  );
}
