'use client';

import Link from 'next/link';
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
  unit: string;
};

type Bundle = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  items: { catalogItemId: string; quantity: number; quantityMode?: 'FIXED' | 'PER_TRAINEE'; title: string; imageUrl?: string | null }[];
};

type Cart = Record<string, number>;
type View = 'home' | 'bundles' | 'orders';

export default function TrainingKitPage() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [view, setView] = useState<View>('home');
  const [category, setCategory] = useState('الكل');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Cart>({});
  const [form, setForm] = useState({ trainerName: '', courseName: '', startDate: '', endDate: '', traineeCount: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resultCode, setResultCode] = useState('');
  const [error, setError] = useState('');

  async function loadCatalog() {
    const response = await fetch('/api/training-store/catalog', { cache: 'no-store' });
    const json = await response.json().catch(() => ({}));
    setItems(Array.isArray(json.items) ? json.items : []);
    setBundles(Array.isArray(json.bundles) ? json.bundles : []);
  }

  useEffect(() => {
    let mounted = true;
    loadCatalog()
      .catch(() => mounted && setError('تعذر تحميل المواد'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const traineeCount = Math.max(0, Number(form.traineeCount || 0));
  const cartRows = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => ({ item: items.find((row) => row.id === id), quantity }))
        .filter((row) => row.item && row.quantity > 0) as { item: StoreItem; quantity: number }[],
    [cart, items]
  );
  const categories = useMemo(() => ['الكل', ...Array.from(new Set(items.map((item) => item.category)))], [items]);
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const categoryMatch = category === 'الكل' || item.category === category;
      const searchMatch = !needle || item.title.toLowerCase().includes(needle) || item.category.toLowerCase().includes(needle);
      return categoryMatch && searchMatch;
    });
  }, [items, category, query]);
  const stats = useMemo(
    () => ({
      total: items.length,
      reserved: items.reduce((sum, item) => sum + item.temporarilyReservedQty, 0),
      cart: cartRows.reduce((sum, row) => sum + row.quantity, 0),
    }),
    [items, cartRows]
  );

  function setQty(id: string, qty: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = Math.floor(qty);
      return next;
    });
  }

  function addBundle(bundle: Bundle) {
    const missingTrainees = bundle.items.some((item) => item.quantityMode === 'PER_TRAINEE') && traineeCount <= 0;
    if (missingTrainees) {
      setError('أدخل عدد المتدربين قبل إضافة بكج يعتمد على عدد المشاركين.');
      setView('orders');
      return;
    }
    setError('');
    setCart((prev) => {
      const next = { ...prev };
      for (const row of bundle.items) {
        const qty = row.quantityMode === 'PER_TRAINEE' ? row.quantity * traineeCount : row.quantity;
        next[row.catalogItemId] = (next[row.catalogItemId] || 0) + qty;
      }
      return next;
    });
    setView('orders');
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
          traineeCount,
          items: cartRows.map((row) => ({ catalogItemId: row.item.id, quantity: row.quantity })),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'تعذر إرسال الطلبات');
      setResultCode(json?.data?.code || '');
      setCart({});
      await loadCatalog();
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال الطلبات');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f7f7] text-[#223738]">
      <header className="sticky top-0 z-30 border-b border-[#dce6e3] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <img src="/nauss-gold-logo.png" alt="جامعة نايف العربية للعلوم الأمنية" className="h-12 w-auto object-contain" />
            <div>
              <div className="text-[13px] font-extrabold text-[#2A6364]">جامعة نايف العربية للعلوم الأمنية</div>
              <div className="text-[12px] font-bold text-[#687b79]">وكالة التدريب - منصة مواد التدريب</div>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
            <NavButton active={view === 'home'} onClick={() => setView('home')}>الرئيسية</NavButton>
            <NavButton active={view === 'bundles'} onClick={() => setView('bundles')}>البكجات المقترحة</NavButton>
            <NavButton active={view === 'orders'} onClick={() => setView('orders')}>الطلبات ({stats.cart})</NavButton>
            <Link href="/login" className="rounded-[8px] border border-[#dce6e3] bg-white px-4 py-2 text-[13px] font-extrabold text-[#2A6364]">تسجيل الدخول</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-5">
        <section className="mb-5 rounded-[8px] border border-[#dce6e3] bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[13px] font-bold text-[#2A6364]">مساعد تجهيز الدورة</div>
              <h1 className="mt-1 text-[28px] font-extrabold">اختيار مستلزمات التدريب</h1>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="مواد المتجر" value={stats.total} />
              <Stat label="محجوز مؤقتا بعد الاعتماد" value={stats.reserved} />
              <Stat label="في الطلبات" value={stats.cart} />
            </div>
          </div>
        </section>

        {error ? <div className="mb-4 rounded-[8px] bg-[#fff1f3] px-4 py-3 text-[13px] font-bold text-[#7c1e3e]">{error}</div> : null}
        {resultCode ? <div className="mb-4 rounded-[8px] bg-[#eef8f2] px-4 py-3 text-[13px] font-bold text-[#1e6b4c]">تم إرسال الطلبات برقم {resultCode}</div> : null}

        {view === 'home' ? (
          <HomeView
            loading={loading}
            items={visibleItems}
            categories={categories}
            category={category}
            query={query}
            cart={cart}
            setCategory={setCategory}
            setQuery={setQuery}
            setQty={setQty}
          />
        ) : null}

        {view === 'bundles' ? (
          <BundlesView bundles={bundles} traineeCount={traineeCount} onAdd={addBundle} />
        ) : null}

        {view === 'orders' ? (
          <OrdersView
            form={form}
            setForm={setForm}
            cartRows={cartRows}
            setQty={setQty}
            submitting={submitting}
            onSubmit={submitNeed}
            goHome={() => setView('home')}
          />
        ) : null}
      </div>

      <footer className="border-t border-[#dce6e3] bg-white px-4 py-5 text-center text-[13px] font-bold text-[#607371]">
        حقوق النشر - إدارة عمليات التدريب وكالة التدريب 2026
      </footer>
    </main>
  );
}

function HomeView({
  loading,
  items,
  categories,
  category,
  query,
  cart,
  setCategory,
  setQuery,
  setQty,
}: {
  loading: boolean;
  items: StoreItem[];
  categories: string[];
  category: string;
  query: string;
  cart: Cart;
  setCategory: (value: string) => void;
  setQuery: (value: string) => void;
  setQty: (id: string, qty: number) => void;
}) {
  return (
    <section className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث عن مادة" className="h-11 rounded-[8px] border border-[#dce6e3] bg-white px-4 text-[14px] outline-none focus:border-[#2A6364] lg:w-[320px]" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button key={cat} type="button" onClick={() => setCategory(cat)} className={`shrink-0 rounded-[8px] border px-4 py-2 text-[13px] font-bold ${category === cat ? 'border-[#2A6364] bg-[#2A6364] text-white' : 'border-[#dce6e3] bg-white text-[#2d4545]'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="py-16 text-center text-[#71817f]">جاري تحميل المواد...</div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <MaterialCard key={item.id} item={item} qty={cart[item.id] || 0} setQty={setQty} />
          ))}
        </div>
      )}
    </section>
  );
}

function BundlesView({ bundles, traineeCount, onAdd }: { bundles: Bundle[]; traineeCount: number; onAdd: (bundle: Bundle) => void }) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {bundles.map((bundle) => (
        <article key={bundle.id} className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
          <div className="flex aspect-[16/9] items-center justify-center overflow-hidden rounded-[8px] bg-[#eef4f3]">
            {bundle.imageUrl ? <img src={bundle.imageUrl} alt={bundle.title} className="h-full w-full object-cover" /> : <div className="text-[20px] font-extrabold text-[#2A6364]">{bundle.title}</div>}
          </div>
          <h2 className="mt-4 text-[20px] font-extrabold">{bundle.title}</h2>
          <p className="mt-1 min-h-12 text-[13px] leading-6 text-[#71817f]">{bundle.description}</p>
          <div className="mt-4 space-y-2">
            {bundle.items.map((item) => (
              <div key={item.catalogItemId} className="flex items-center justify-between rounded-[8px] bg-[#f8fbfb] px-3 py-2 text-[13px]">
                <span className="font-bold">{item.title}</span>
                <span className="text-[#2A6364]">{item.quantityMode === 'PER_TRAINEE' ? `${traineeCount || 'عدد المتدربين'} × ${item.quantity}` : item.quantity}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onAdd(bundle)} className="mt-4 h-11 w-full rounded-[8px] bg-[#2A6364] text-[14px] font-extrabold text-white">إضافة البكج للطلبات</button>
        </article>
      ))}
    </section>
  );
}

function OrdersView({
  form,
  setForm,
  cartRows,
  setQty,
  submitting,
  onSubmit,
  goHome,
}: {
  form: { trainerName: string; courseName: string; startDate: string; endDate: string; traineeCount: string };
  setForm: React.Dispatch<React.SetStateAction<{ trainerName: string; courseName: string; startDate: string; endDate: string; traineeCount: string }>>;
  cartRows: { item: StoreItem; quantity: number }[];
  setQty: (id: string, qty: number) => void;
  submitting: boolean;
  onSubmit: (event: React.FormEvent) => void;
  goHome: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <section className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[24px] font-extrabold">الطلبات</h2>
          <button type="button" onClick={goHome} className="rounded-[8px] border border-[#dce6e3] px-4 py-2 text-[13px] font-bold text-[#2A6364]">إضافة مواد</button>
        </div>
        {cartRows.length ? (
          <div className="divide-y divide-[#edf1f1]">
            {cartRows.map(({ item, quantity }) => (
              <div key={item.id} className="grid gap-4 py-4 md:grid-cols-[150px_1fr_auto] md:items-center">
                <div className="aspect-[4/3] overflow-hidden rounded-[8px] bg-[#eef4f3]">
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" /> : null}
                </div>
                <div>
                  <div className="text-[18px] font-extrabold">{item.title}</div>
                  <div className="mt-1 text-[13px] text-[#71817f]">{item.category}</div>
                  <StockLine item={item} />
                  <button type="button" onClick={() => setQty(item.id, 0)} className="mt-3 text-[13px] font-bold text-[#7c1e3e]">حذف</button>
                </div>
                <QuantityControl value={quantity} onMinus={() => setQty(item.id, quantity - 1)} onPlus={() => setQty(item.id, quantity + 1)} onChange={(value) => setQty(item.id, value)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[8px] bg-[#f8fbfb] px-4 py-16 text-center text-[#71817f]">لا توجد طلبات حتى الآن</div>
        )}
      </section>

      <aside className="rounded-[8px] border border-[#dce6e3] bg-white p-5 xl:sticky xl:top-24 xl:self-start">
        <h3 className="text-[20px] font-extrabold">مراجعة قبل الإرسال</h3>
        <div className="mt-4 space-y-3">
          <Input label="اسم المدرب" value={form.trainerName} onChange={(value) => setForm((prev) => ({ ...prev, trainerName: value }))} />
          <Input label="اسم الدورة" value={form.courseName} onChange={(value) => setForm((prev) => ({ ...prev, courseName: value }))} />
          <Input label="تاريخ بداية الدورة" type="date" value={form.startDate} onChange={(value) => setForm((prev) => ({ ...prev, startDate: value }))} />
          <Input label="تاريخ نهاية الدورة" type="date" value={form.endDate} onChange={(value) => setForm((prev) => ({ ...prev, endDate: value }))} />
          <Input label="عدد المتدربين" type="number" value={form.traineeCount} onChange={(value) => setForm((prev) => ({ ...prev, traineeCount: value }))} />
        </div>
        <div className="mt-4 rounded-[8px] bg-[#f8fbfb] px-4 py-3 text-[13px] leading-6 text-[#607371]">
          تاريخ نهاية الدورة يستخدم كتاريخ إرجاع متوقع للمواد المسترجعة عند تحويل الاحتياج إلى طلب مواد.
        </div>
        <button type="submit" disabled={submitting || cartRows.length === 0} className="mt-5 h-12 w-full rounded-[8px] bg-[#2A6364] text-[15px] font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#a9b8b6]">
          {submitting ? 'جاري الإرسال...' : 'إرسال الطلبات'}
        </button>
      </aside>
    </form>
  );
}

function MaterialCard({ item, qty, setQty }: { item: StoreItem; qty: number; setQty: (id: string, qty: number) => void }) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-[#dce6e3] bg-white">
      <div className="flex aspect-[16/10] items-center justify-center bg-[#eef4f3]">
        {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" /> : <div className="px-5 text-center text-[18px] font-extrabold text-[#2A6364]">{item.title}</div>}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <div className="text-[16px] font-extrabold">{item.title}</div>
          <div className="mt-1 text-[12px] text-[#71817f]">{item.category}</div>
        </div>
        <StockLine item={item} />
        <QuantityControl value={qty} onMinus={() => setQty(item.id, qty - 1)} onPlus={() => setQty(item.id, qty + 1)} onChange={(value) => setQty(item.id, value)} />
      </div>
    </article>
  );
}

function QuantityControl({ value, onMinus, onPlus, onChange }: { value: number; onMinus: () => void; onPlus: () => void; onChange: (value: number) => void }) {
  return (
    <div className="inline-flex h-11 items-center overflow-hidden rounded-[999px] border-4 border-[#f1d657] bg-white">
      <button type="button" onClick={onPlus} className="h-full w-12 text-[24px] font-extrabold">+</button>
      <input type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-full w-14 border-x border-[#e7e7d9] text-center text-[16px] font-extrabold outline-none" />
      <button type="button" onClick={onMinus} className="h-full w-12 text-[24px] font-extrabold">−</button>
    </div>
  );
}

function StockLine({ item }: { item: StoreItem }) {
  if (item.isOnDemand) return <div className="rounded-[8px] bg-[#fff8e7] px-3 py-2 text-[12px] font-bold text-[#8a6a37]">{item.onDemandNote}</div>;
  return (
    <div className="mt-2 rounded-[8px] bg-[#f8fbfb] px-3 py-2 text-[12px] leading-6">
      <div className="flex justify-between"><span>المتاح في المخزن</span><b>{item.stockQty}</b></div>
      <div className="flex justify-between"><span>محجوز مؤقتا</span><b>{item.temporarilyReservedQty}</b></div>
      <div className="text-[#71817f]">الحجز المؤقت لا يخصم فعليا إلا عند الصرف.</div>
    </div>
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

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-[8px] border px-4 py-2 text-[13px] font-extrabold ${active ? 'border-[#2A6364] bg-[#2A6364] text-white' : 'border-[#dce6e3] bg-white text-[#2A6364]'}`}>{children}</button>;
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-[#536866]">{label}</span>
      <input required type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-[8px] border border-[#dce6e3] px-3 outline-none focus:border-[#2A6364]" />
    </label>
  );
}
