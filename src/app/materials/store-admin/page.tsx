'use client';

import { useEffect, useMemo, useState } from 'react';

type StoreItem = {
  id: string;
  inventoryItemId?: string | null;
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

type Bundle = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  isVisible?: boolean;
  items: { catalogItemId: string; quantity: number; quantityMode?: 'FIXED' | 'PER_TRAINEE'; title: string }[];
};

export default function StoreAdminPage() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedBundleId, setSelectedBundleId] = useState('');
  const [newItem, setNewItem] = useState({ title: '', category: 'مواد عند الطلب', imageUrl: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0], [items, selectedId]);
  const selectedBundle = useMemo(() => bundles.find((bundle) => bundle.id === selectedBundleId) || bundles[0], [bundles, selectedBundleId]);
  const selectedFromInventory = !!selected?.inventoryItemId && !selected?.isOnDemand;

  async function load() {
    setError('');
    const response = await fetch('/api/store-admin', { cache: 'no-store', credentials: 'include' });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(json?.error || 'تعذر تحميل إدارة المتجر');
      return;
    }
    setItems(Array.isArray(json.items) ? json.items : []);
    setBundles(Array.isArray(json.bundles) ? json.bundles : []);
  }

  useEffect(() => {
    load();
  }, []);

  async function fileToDataUrl(file: File): Promise<string> {
    const image = document.createElement('img');
    const reader = new FileReader();
    const loaded = new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
    });
    reader.readAsDataURL(file);
    image.src = await loaded;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    const canvas = document.createElement('canvas');
    const maxWidth = 900;
    const scale = Math.min(1, maxWidth / image.width);
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.76);
  }

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

  async function saveBundle(bundle: Bundle) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/store-admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...bundle, type: 'bundle' }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'تعذر تحديث البكج');
      await load();
      setSelectedBundleId(bundle.id);
    } catch (err: any) {
      setError(err?.message || 'تعذر تحديث البكج');
    } finally {
      setBusy(false);
    }
  }

  async function deleteBundle(id: string) {
    if (!confirm('حذف البكج؟')) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/store-admin?type=bundle&id=${id}`, { method: 'DELETE', credentials: 'include' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'تعذر حذف البكج');
      setSelectedBundleId('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'تعذر حذف البكج');
    } finally {
      setBusy(false);
    }
  }

  async function createOnDemand(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
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

  function updateSelected(patch: Partial<StoreItem>) {
    if (!selected) return;
    const next = { ...selected, ...patch };
    setItems((prev) => prev.map((item) => (item.id === selected.id ? next : item)));
  }

  function updateBundle(patch: Partial<Bundle>) {
    if (!selectedBundle) return;
    const next = { ...selectedBundle, ...patch };
    setBundles((prev) => prev.map((bundle) => (bundle.id === selectedBundle.id ? next : bundle)));
  }

  function setBundleItem(catalogItemId: string, checked: boolean) {
    if (!selectedBundle) return;
    const current = selectedBundle.items || [];
    const nextItems = checked
      ? current.some((item) => item.catalogItemId === catalogItemId)
        ? current
        : [...current, { catalogItemId, quantity: 1, quantityMode: 'FIXED' as const, title: items.find((item) => item.id === catalogItemId)?.title || '' }]
      : current.filter((item) => item.catalogItemId !== catalogItemId);
    updateBundle({ items: nextItems });
  }

  function updateBundleItem(catalogItemId: string, patch: Partial<Bundle['items'][number]>) {
    if (!selectedBundle) return;
    updateBundle({ items: selectedBundle.items.map((item) => (item.catalogItemId === catalogItemId ? { ...item, ...patch } : item)) });
  }

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12px] font-bold text-[#2A6364]">إعدادات تشغيلية</div>
            <h1 className="mt-1 text-[24px] font-extrabold text-[#223738]">إدارة المتجر</h1>
          </div>
          <a href="/training-kit" target="_blank" className="rounded-[8px] bg-[#2A6364] px-4 py-2.5 text-[13px] font-extrabold text-white">معاينة المتجر</a>
        </div>
      </section>

      {error ? <div className="rounded-[8px] bg-[#fff1f3] px-4 py-3 text-[13px] font-bold text-[#7c1e3e]">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <section className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
          <div className="mb-3 font-extrabold">مواد المتجر</div>
          <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-[8px] border p-3 text-right ${selected?.id === item.id ? 'border-[#2A6364] bg-[#eef6f5]' : 'border-[#dce6e3] bg-white'}`}>
                <div className="font-bold">{item.title}</div>
                <div className="mt-1 flex items-center justify-between text-[12px] text-[#71817f]"><span>{item.category}</span><span>{item.isOnDemand ? 'عند الطلب' : `متاح ${item.stockQty}`}</span></div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          {selected ? (
            <div className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
              <h2 className="text-[19px] font-extrabold">تعديل مادة</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
                <ImageBox title={selected.title} imageUrl={selected.imageUrl} />
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="اسم المادة" value={selected.title} onChange={(value) => updateSelected({ title: value })} disabled={selectedFromInventory} />
                  <Field label="الفئة" value={selected.category} onChange={(value) => updateSelected({ category: value })} disabled={selectedFromInventory} />
                  {selectedFromInventory ? (
                    <div className="rounded-[8px] border border-[#dce6e3] bg-[#f7faf9] px-3 py-2 text-[12px] leading-6 text-[#536866] md:col-span-2">
                      هذه المادة مرتبطة بمخزون المواد. الاسم والفئة والكمية تدار من صفحة مخزون المواد. عند رفع صورة هنا سيتم حفظها في مخزون المواد نفسه حتى تبقى مصدرا واحدا.
                    </div>
                  ) : null}
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-[12px] font-bold text-[#536866]">رفع صورة مباشرة</span>
                    <input type="file" accept="image/*" onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (file) updateSelected({ imageUrl: await fileToDataUrl(file) });
                    }} className="w-full rounded-[8px] border border-[#dce6e3] p-2 text-[13px]" />
                  </label>
                  <Field label="ملاحظة عند الطلب" value={selected.onDemandNote || ''} onChange={(value) => updateSelected({ onDemandNote: value })} />
                  <label className="flex items-center gap-2 rounded-[8px] border border-[#dce6e3] px-3 py-3 text-[13px] font-bold">
                    <input type="checkbox" checked={selected.isVisible} onChange={(event) => updateSelected({ isVisible: event.target.checked })} />
                    ظاهر في المتجر
                  </label>
                </div>
              </div>
              <button onClick={() => saveItem(selected)} disabled={busy} className="mt-4 rounded-[8px] bg-[#2A6364] px-5 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-60">حفظ التعديل</button>
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <form onSubmit={createOnDemand} className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
              <h2 className="text-[18px] font-extrabold">إضافة مادة عند الطلب</h2>
              <div className="mt-4 space-y-3">
                <Field label="اسم المادة" value={newItem.title} onChange={(value) => setNewItem((prev) => ({ ...prev, title: value }))} />
                <Field label="الفئة" value={newItem.category} onChange={(value) => setNewItem((prev) => ({ ...prev, category: value }))} />
                <label className="block">
                  <span className="mb-1 block text-[12px] font-bold text-[#536866]">رفع صورة</span>
                  <input type="file" accept="image/*" onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      const imageUrl = await fileToDataUrl(file);
                      setNewItem((prev) => ({ ...prev, imageUrl }));
                    }
                  }} className="w-full rounded-[8px] border border-[#dce6e3] p-2 text-[13px]" />
                </label>
              </div>
              <button disabled={busy} className="mt-4 rounded-[8px] bg-[#2A6364] px-5 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-60">إضافة</button>
            </form>

            <div className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
              <h2 className="text-[18px] font-extrabold">البكجات الحالية</h2>
              <div className="mt-4 max-h-[260px] space-y-2 overflow-y-auto">
                {bundles.map((bundle) => (
                  <button key={bundle.id} type="button" onClick={() => setSelectedBundleId(bundle.id)} className={`w-full rounded-[8px] border p-3 text-right ${selectedBundle?.id === bundle.id ? 'border-[#2A6364] bg-[#eef6f5]' : 'border-[#dce6e3] bg-white'}`}>
                    <div className="font-bold">{bundle.title}</div>
                    <div className="mt-1 text-[12px] text-[#71817f]">{bundle.items.length} مواد</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedBundle ? (
            <div className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="text-[19px] font-extrabold">تعديل بكج</h2>
                <button type="button" onClick={() => deleteBundle(selectedBundle.id)} className="rounded-[8px] bg-[#7c1e3e] px-4 py-2 text-[13px] font-bold text-white">حذف البكج</button>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
                <ImageBox title={selectedBundle.title} imageUrl={selectedBundle.imageUrl} />
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="اسم البكج" value={selectedBundle.title} onChange={(value) => updateBundle({ title: value })} />
                  <Field label="الوصف" value={selectedBundle.description || ''} onChange={(value) => updateBundle({ description: value })} />
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-[12px] font-bold text-[#536866]">رفع صورة البكج</span>
                    <input type="file" accept="image/*" onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (file) updateBundle({ imageUrl: await fileToDataUrl(file) });
                    }} className="w-full rounded-[8px] border border-[#dce6e3] p-2 text-[13px]" />
                  </label>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {items.map((item) => {
                  const current = selectedBundle.items.find((row) => row.catalogItemId === item.id);
                  return (
                    <div key={item.id} className="rounded-[8px] border border-[#edf1f1] p-3">
                      <label className="flex items-center gap-2 text-[13px] font-bold">
                        <input type="checkbox" checked={!!current} onChange={(event) => setBundleItem(item.id, event.target.checked)} />
                        {item.title}
                      </label>
                      {current ? (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <input type="number" min={1} value={current.quantity} onChange={(event) => updateBundleItem(item.id, { quantity: Number(event.target.value) })} className="h-10 rounded-[8px] border border-[#dce6e3] px-2" />
                          <select value={current.quantityMode || 'FIXED'} onChange={(event) => updateBundleItem(item.id, { quantityMode: event.target.value as 'FIXED' | 'PER_TRAINEE' })} className="h-10 rounded-[8px] border border-[#dce6e3] px-2 text-[12px]">
                            <option value="FIXED">كمية ثابتة</option>
                            <option value="PER_TRAINEE">حسب عدد المشاركين</option>
                          </select>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => saveBundle(selectedBundle)} disabled={busy} className="mt-4 rounded-[8px] bg-[#2A6364] px-5 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-60">حفظ البكج</button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function ImageBox({ title, imageUrl }: { title: string; imageUrl?: string | null }) {
  return <div className="overflow-hidden rounded-[8px] border border-[#dce6e3] bg-[#eef4f3]"><div className="flex aspect-[4/3] items-center justify-center">{imageUrl ? <img src={imageUrl} alt={title} className="h-full w-full object-cover" /> : <div className="p-4 text-center font-extrabold text-[#2A6364]">{title}</div>}</div></div>;
}

function Field({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-[#536866]">{label}</span>
      <input disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-[8px] border border-[#dce6e3] px-3 outline-none focus:border-[#2A6364] disabled:bg-[#f4f6f6] disabled:text-[#74817f]" />
    </label>
  );
}
