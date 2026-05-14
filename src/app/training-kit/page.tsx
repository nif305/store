'use client';

import { useEffect, useMemo, useState } from 'react';

type StoreItem = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  imageUrl?: string | null;
  isOnDemand: boolean;
  onDemandNote?: string | null;
  stockQty: number;
  temporarilyReservedQty: number;
  freeAfterReservations: number;
  unit: string;
};

type Bundle = {
  id: string;
  title: string;
  description?: string | null;
  items: { catalogItemId: string; quantity: number; title: string }[];
};

type Cart = Record<string, number>;

export default function TrainingKitPage() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [category, setCategory] = useState('الكل');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Cart>({});
  const [form, setForm] = useState({ trainerName: '', courseName: '', startDate: '', traineeCount: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resultCode, setResultCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    fetch('/api/training-store/catalog', { cache: 'no-store' })
      .then((response) => response.json())
      .then((json) => {
        if (!mounted) return;
        setItems(Array.isArray(json.items) ? json.items : []);
        setBundles(Array.isArray(json.bundles) ? json.bundles : []);
      })
      .catch(() => setError('تعذر تحميل المواد'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(() => ['الكل', ...Array.from(new Set(items.map((item) => item.category)))], [items]);
  const cartRows = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => ({ item: items.find((row) => row.id === id), quantity }))
        .filter((row) => row.item && row.quantity > 0) as { item: StoreItem; quantity: number }[],
    [cart, items]
  );

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const categoryMatch = category === 'الكل' || item.category === category;
      const searchMatch = !needle || item.title.toLowerCase().includes(needle) || item.category.toLowerCase().includes(needle);
      return categoryMatch && searchMatch;
    });
  }, [items, category, query]);

  function setQty(id: string, qty: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  function addBundle(bundle: Bundle) {
    setCart((prev) => {
      const next = { ...prev };
      for (const row of bundle.items) {
        next[row.catalogItemId] = (next[row.catalogItemId] || 0) + row.quantity;
      }
      return next;
    });
  }

  async function submitNeed(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setResultCode('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/trainer-needs/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          traineeCount: Number(form.traineeCount),
          items: cartRows.map((row) => ({ catalogItemId: row.item.id, quantity: row.quantity })),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'تعذر إرسال الاحتياج');
      setResultCode(json?.data?.code || '');
      setCart({});
      setForm({ trainerName: '', courseName: '', startDate: '', traineeCount: '' });
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال الاحتياج');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f7f7] text-[#223738]">
      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 lg:grid-cols-[1fr_390px]">
        <section className="min-w-0 space-y-5">
          <header className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[13px] font-bold text-[#2A6364]">مساعد تجهيز الدورة</div>
                <h1 className="mt-1 text-[26px] font-extrabold">اختيار مستلزمات التدريب</h1>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="مواد المتجر" value={items.length} />
                <Stat label="محجوز مؤقتا" value={items.reduce((sum, item) => sum + item.temporarilyReservedQty, 0)} />
                <Stat label="في السلة" value={cartRows.length} />
              </div>
            </div>
          </header>

          {bundles.length ? (
            <section className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
              <div className="mb-3 text-[16px] font-extrabold">بكجات مقترحة</div>
              <div className="grid gap-3 md:grid-cols-3">
                {bundles.map((bundle) => (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => addBundle(bundle)}
                    className="rounded-[8px] border border-[#dce6e3] bg-[#fbfcfc] p-4 text-right transition hover:border-[#2A6364]"
                  >
                    <div className="font-extrabold">{bundle.title}</div>
                    <div className="mt-1 line-clamp-2 text-[12px] leading-6 text-[#71817f]">{bundle.description}</div>
                    <div className="mt-3 text-[12px] font-bold text-[#2A6364]">{bundle.items.length} مواد</div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="بحث عن مادة"
                className="h-11 rounded-[8px] border border-[#dce6e3] bg-white px-4 text-[14px] outline-none focus:border-[#2A6364] lg:w-[320px]"
              />
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`shrink-0 rounded-[8px] border px-4 py-2 text-[13px] font-bold ${
                      category === cat ? 'border-[#2A6364] bg-[#2A6364] text-white' : 'border-[#dce6e3] bg-white text-[#2d4545]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-[#71817f]">جاري تحميل المواد...</div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleItems.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-[8px] border border-[#dce6e3] bg-white">
                    <div className="flex aspect-[16/10] items-center justify-center bg-[#eef4f3]">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="px-5 text-center text-[18px] font-extrabold text-[#2A6364]">{item.title}</div>
                      )}
                    </div>
                    <div className="space-y-3 p-4">
                      <div>
                        <div className="text-[16px] font-extrabold">{item.title}</div>
                        <div className="mt-1 text-[12px] text-[#71817f]">{item.category}</div>
                      </div>
                      <StockLine item={item} />
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setQty(item.id, (cart[item.id] || 0) - 1)} className="h-10 w-10 rounded-[8px] border border-[#dce6e3] text-[20px] font-bold">
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={cart[item.id] || 0}
                          onChange={(event) => setQty(item.id, Number(event.target.value))}
                          className="h-10 min-w-0 flex-1 rounded-[8px] border border-[#dce6e3] text-center font-bold outline-none focus:border-[#2A6364]"
                        />
                        <button type="button" onClick={() => setQty(item.id, (cart[item.id] || 0) + 1)} className="h-10 w-10 rounded-[8px] bg-[#2A6364] text-[20px] font-bold text-white">
                          +
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        <aside className="lg:sticky lg:top-5 lg:self-start">
          <form onSubmit={submitNeed} className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
            <h2 className="text-[20px] font-extrabold">إرسال الاحتياج</h2>
            <div className="mt-4 space-y-3">
              <Input label="اسم المدرب" value={form.trainerName} onChange={(value) => setForm((prev) => ({ ...prev, trainerName: value }))} />
              <Input label="اسم الدورة" value={form.courseName} onChange={(value) => setForm((prev) => ({ ...prev, courseName: value }))} />
              <Input label="تاريخ بداية الدورة" type="date" value={form.startDate} onChange={(value) => setForm((prev) => ({ ...prev, startDate: value }))} />
              <Input label="عدد المتدربين" type="number" value={form.traineeCount} onChange={(value) => setForm((prev) => ({ ...prev, traineeCount: value }))} />
            </div>

            <div className="mt-5 border-t border-[#edf1f1] pt-4">
              <div className="mb-2 font-extrabold">السلة</div>
              {cartRows.length ? (
                <div className="max-h-[300px] space-y-2 overflow-y-auto">
                  {cartRows.map(({ item, quantity }) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-[#f8fbfb] px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-bold">{item.title}</div>
                        <div className="text-[11px] text-[#71817f]">{item.isOnDemand ? 'توفير عند الطلب' : `متاح ${item.stockQty}`}</div>
                      </div>
                      <div className="font-extrabold">{quantity}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[8px] bg-[#f8fbfb] px-4 py-8 text-center text-[13px] text-[#71817f]">لم يتم اختيار مواد</div>
              )}
            </div>

            {error ? <div className="mt-4 rounded-[8px] bg-[#fff1f3] px-4 py-3 text-[13px] font-bold text-[#7c1e3e]">{error}</div> : null}
            {resultCode ? <div className="mt-4 rounded-[8px] bg-[#eef8f2] px-4 py-3 text-[13px] font-bold text-[#1e6b4c]">تم إرسال الاحتياج برقم {resultCode}</div> : null}

            <button
              type="submit"
              disabled={submitting || cartRows.length === 0}
              className="mt-5 h-12 w-full rounded-[8px] bg-[#2A6364] text-[15px] font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#a9b8b6]"
            >
              {submitting ? 'جاري الإرسال...' : 'إرسال الاحتياج'}
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] bg-[#f3f7f6] px-4 py-2">
      <div className="text-[11px] text-[#71817f]">{label}</div>
      <div className="text-[18px] font-extrabold">{value}</div>
    </div>
  );
}

function StockLine({ item }: { item: StoreItem }) {
  if (item.isOnDemand) {
    return <div className="rounded-[8px] bg-[#fff8e7] px-3 py-2 text-[12px] font-bold text-[#8a6a37]">{item.onDemandNote}</div>;
  }
  return (
    <div className="space-y-1 rounded-[8px] bg-[#f8fbfb] px-3 py-2 text-[12px]">
      <div className="flex justify-between"><span>المتاح في المخزن</span><b>{item.stockQty}</b></div>
      <div className="flex justify-between"><span>محجوز مؤقتا</span><b>{item.temporarilyReservedQty}</b></div>
      <div className="text-[#71817f]">يمكن طلب المادة رغم وجود حجز مؤقت، والخصم الفعلي يتم عند الصرف.</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-[#536866]">{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-[8px] border border-[#dce6e3] px-3 outline-none focus:border-[#2A6364]"
      />
    </label>
  );
}
