'use client';

import { useEffect, useMemo, useState } from 'react';

type StoreItem = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  imageUrl?: string | null;
  isVisible: boolean;
  isOnDemand: boolean;
  onDemandNote?: string | null;
  stockQty: number;
  temporarilyReservedQty: number;
};

export default function StoreAdminPage() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [newItem, setNewItem] = useState({ title: '', category: 'مواد عند الطلب', imageUrl: '' });
  const [bundleTitle, setBundleTitle] = useState('');
  const [bundleItems, setBundleItems] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0], [items, selectedId]);

  async function load() {
    setError('');
    const response = await fetch('/api/store-admin', { cache: 'no-store', credentials: 'include' });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(json?.error || 'تعذر تحميل إدارة المتجر');
      return;
    }
    setItems(Array.isArray(json.items) ? json.items : []);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveItem(item: StoreItem) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/store-admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'تعذر تحديث المادة');
      await load();
      setSelectedId(item.id);
    } catch (err: any) {
      setError(err?.message || 'تعذر تحديث المادة');
    } finally {
      setBusy(false);
    }
  }

  async function createOnDemand(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/store-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'on-demand', ...newItem }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'تعذر إضافة المادة');
      setNewItem({ title: '', category: 'مواد عند الطلب', imageUrl: '' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'تعذر إضافة المادة');
    } finally {
      setBusy(false);
    }
  }

  async function createBundle(event: React.FormEvent) {
    event.preventDefault();
    const rows = Object.entries(bundleItems)
      .filter(([, checked]) => checked)
      .map(([catalogItemId]) => ({ catalogItemId, quantity: 1 }));
    if (!bundleTitle || rows.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/store-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'bundle', title: bundleTitle, items: rows }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'تعذر إنشاء البكج');
      setBundleTitle('');
      setBundleItems({});
    } catch (err: any) {
      setError(err?.message || 'تعذر إنشاء البكج');
    } finally {
      setBusy(false);
    }
  }

  function updateSelected(patch: Partial<StoreItem>) {
    if (!selected) return;
    const next = { ...selected, ...patch };
    setItems((prev) => prev.map((item) => (item.id === selected.id ? next : item)));
  }

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12px] font-bold text-[#2A6364]">إعدادات تشغيلية</div>
            <h1 className="mt-1 text-[24px] font-extrabold text-[#223738]">إدارة المتجر</h1>
          </div>
          <a href="/training-kit" target="_blank" className="rounded-[8px] bg-[#2A6364] px-4 py-2.5 text-[13px] font-extrabold text-white">
            معاينة المتجر
          </a>
        </div>
      </section>

      {error ? <div className="rounded-[8px] bg-[#fff1f3] px-4 py-3 text-[13px] font-bold text-[#7c1e3e]">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <section className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
          <div className="mb-3 font-extrabold">مواد المتجر</div>
          <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-[8px] border p-3 text-right ${selected?.id === item.id ? 'border-[#2A6364] bg-[#eef6f5]' : 'border-[#dce6e3] bg-white'}`}
              >
                <div className="font-bold">{item.title}</div>
                <div className="mt-1 flex items-center justify-between text-[12px] text-[#71817f]">
                  <span>{item.category}</span>
                  <span>{item.isOnDemand ? 'عند الطلب' : `متاح ${item.stockQty}`}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          {selected ? (
            <div className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
              <h2 className="text-[19px] font-extrabold">تعديل مادة</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
                <div className="overflow-hidden rounded-[8px] border border-[#dce6e3] bg-[#eef4f3]">
                  <div className="flex aspect-[4/3] items-center justify-center">
                    {selected.imageUrl ? <img src={selected.imageUrl} alt={selected.title} className="h-full w-full object-cover" /> : <div className="p-4 text-center font-extrabold text-[#2A6364]">{selected.title}</div>}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="اسم المادة" value={selected.title} onChange={(value) => updateSelected({ title: value })} />
                  <Field label="التصنيف" value={selected.category} onChange={(value) => updateSelected({ category: value })} />
                  <Field label="رابط الصورة" value={selected.imageUrl || ''} onChange={(value) => updateSelected({ imageUrl: value })} />
                  <Field label="ملاحظة عند الطلب" value={selected.onDemandNote || ''} onChange={(value) => updateSelected({ onDemandNote: value })} />
                  <label className="flex items-center gap-2 rounded-[8px] border border-[#dce6e3] px-3 py-3 text-[13px] font-bold">
                    <input type="checkbox" checked={selected.isVisible} onChange={(event) => updateSelected({ isVisible: event.target.checked })} />
                    ظاهر في المتجر
                  </label>
                  <div className="rounded-[8px] bg-[#f8fbfb] px-3 py-3 text-[12px] leading-6 text-[#71817f]">
                    الكميات من المخزون فقط. الحجز الذكي يظهر للطلبات التالية ولا يخصم فعليا إلا عند الصرف.
                  </div>
                </div>
              </div>
              <button onClick={() => saveItem(selected)} disabled={busy} className="mt-4 rounded-[8px] bg-[#2A6364] px-5 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-60">
                حفظ التعديل
              </button>
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <form onSubmit={createOnDemand} className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
              <h2 className="text-[18px] font-extrabold">إضافة مادة عند الطلب</h2>
              <div className="mt-4 space-y-3">
                <Field label="اسم المادة" value={newItem.title} onChange={(value) => setNewItem((prev) => ({ ...prev, title: value }))} />
                <Field label="التصنيف" value={newItem.category} onChange={(value) => setNewItem((prev) => ({ ...prev, category: value }))} />
                <Field label="رابط الصورة" value={newItem.imageUrl} onChange={(value) => setNewItem((prev) => ({ ...prev, imageUrl: value }))} />
              </div>
              <button disabled={busy} className="mt-4 rounded-[8px] bg-[#2A6364] px-5 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-60">إضافة</button>
            </form>

            <form onSubmit={createBundle} className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
              <h2 className="text-[18px] font-extrabold">إنشاء بكج</h2>
              <div className="mt-4">
                <Field label="اسم البكج" value={bundleTitle} onChange={setBundleTitle} />
                <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto rounded-[8px] border border-[#dce6e3] p-3">
                  {items.slice(0, 80).map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={!!bundleItems[item.id]}
                        onChange={(event) => setBundleItems((prev) => ({ ...prev, [item.id]: event.target.checked }))}
                      />
                      {item.title}
                    </label>
                  ))}
                </div>
              </div>
              <button disabled={busy} className="mt-4 rounded-[8px] bg-[#2A6364] px-5 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-60">إنشاء البكج</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-[#536866]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-[8px] border border-[#dce6e3] px-3 outline-none focus:border-[#2A6364]"
      />
    </label>
  );
}
