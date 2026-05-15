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

type TrainingRoom = {
  id: string;
  name: string;
  type: string;
  capacity: number;
  location?: string | null;
  description?: string | null;
  equipment: string[];
  layoutOptions: string[];
  imageUrl?: string | null;
  isAvailable: boolean;
  capacityFit: boolean;
};

type Cart = Record<string, number>;
type View = 'home' | 'bundles' | 'rooms' | 'orders';
type RoomSelection = { roomId: string; layout: string; startDate: string; endDate: string };

const colors = {
  ink: '#243736',
  muted: '#6d7b78',
  line: '#dbe4e1',
  surface: '#f4f7f6',
  card: '#ffffff',
  primary: '#315f5d',
  primarySoft: '#edf5f4',
  goldSoft: '#f7f1e4',
  danger: '#7a3147',
};

export default function TrainingKitPage() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [rooms, setRooms] = useState<TrainingRoom[]>([]);
  const [view, setView] = useState<View>('home');
  const [category, setCategory] = useState('الكل');
  const [query, setQuery] = useState('');
  const [roomType, setRoomType] = useState('الكل');
  const [cart, setCart] = useState<Cart>({});
  const [roomSelections, setRoomSelections] = useState<RoomSelection[]>([]);
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

  async function loadRooms() {
    const params = new URLSearchParams();
    if (form.startDate) params.set('startDate', form.startDate);
    if (form.endDate) params.set('endDate', form.endDate);
    if (form.traineeCount) params.set('traineeCount', form.traineeCount);
    const response = await fetch(`/api/training-rooms/public?${params.toString()}`, { cache: 'no-store' });
    const json = await response.json().catch(() => ({}));
    setRooms(Array.isArray(json.rooms) ? json.rooms : []);
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

  useEffect(() => {
    loadRooms().catch(() => undefined);
  }, [form.startDate, form.endDate, form.traineeCount]);

  const traineeCount = Math.max(0, Number(form.traineeCount || 0));
  const cartRows = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => ({ item: items.find((row) => row.id === id), quantity }))
        .filter((row) => row.item && row.quantity > 0) as { item: StoreItem; quantity: number }[],
    [cart, items]
  );
  const categories = useMemo(() => ['الكل', ...Array.from(new Set(items.map((item) => item.category)))], [items]);
  const roomTypes = useMemo(() => ['الكل', ...Array.from(new Set(rooms.map((room) => room.type)))], [rooms]);
  const selectedRooms = useMemo(
    () =>
      roomSelections
        .map((selection) => ({ selection, room: rooms.find((room) => room.id === selection.roomId) || null }))
        .filter((row) => row.room) as { selection: RoomSelection; room: TrainingRoom }[],
    [rooms, roomSelections]
  );
  const visibleRooms = useMemo(() => rooms.filter((room) => roomType === 'الكل' || room.type === roomType), [rooms, roomType]);
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
          roomId: roomSelections[0]?.roomId || null,
          requestedLayout: roomSelections[0]?.layout || '',
          roomSelections: roomSelections.map((selection) => ({
            ...selection,
            startDate: selection.startDate || form.startDate,
            endDate: selection.endDate || form.endDate || form.startDate,
          })),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'تعذر إرسال الطلبات');
      setResultCode(json?.data?.code || '');
      setCart({});
      setRoomSelections([]);
      await loadCatalog();
      await loadRooms();
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال الطلبات');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[linear-gradient(180deg,#eef4f2_0%,#fafcfb_42%,#eef3f1_100%)] text-[#243736]">
      <header className="sticky top-0 z-30 border-b border-[#cfded9] bg-white/90 shadow-[0_8px_28px_rgba(36,55,54,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <img src="/nauss-gold-logo.png" alt="جامعة نايف العربية للعلوم الأمنية" className="h-12 w-auto object-contain" />
            <div>
              <div className="text-[14px] text-[#243736]">جامعة نايف العربية للعلوم الأمنية</div>
              <div className="text-[12px] text-[#6d7b78]">وكالة التدريب - منصة مواد التدريب</div>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
            <NavButton active={view === 'home'} onClick={() => setView('home')}>الرئيسية</NavButton>
            <NavButton active={view === 'bundles'} onClick={() => setView('bundles')}>البكجات المقترحة</NavButton>
            <NavButton active={view === 'rooms'} onClick={() => setView('rooms')}>القاعات</NavButton>
            <NavButton active={view === 'orders'} onClick={() => setView('orders')}>الطلبات ({stats.cart})</NavButton>
            <Link href="/login" className="rounded-[8px] border border-[#cfded9] bg-[#fbfdfc] px-4 py-2 text-[13px] text-[#315f5d] transition hover:border-[#b8cbc6] hover:bg-white">تسجيل الدخول</Link>
          </nav>
        </div>
      </header>

      <div className={`mx-auto max-w-[1480px] px-4 py-6 ${view !== 'orders' && stats.cart > 0 ? 'pb-28' : ''}`}>
        <section className="mb-5 overflow-hidden rounded-[14px] border border-[#cedbd7] border-t-[#c4a86b] bg-[#fffdf8] shadow-[0_18px_50px_rgba(36,55,54,0.08)]">
          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="inline-flex rounded-full border border-[#d9c99f] bg-[#fbf6ea] px-3 py-1 text-[13px] text-[#6f5a2f]">مساعد تجهيز الدورة</div>
              <h1 className="mt-3 text-[30px] leading-tight text-[#203634]">اختيار مستلزمات التدريب</h1>
              <p className="mt-2 max-w-[760px] text-[14px] leading-7 text-[#6d7b78]">
                اختر المواد المطلوبة للدورة، راجع الطلبات، ثم أرسل الاحتياج ليتم التعامل معه من المنسق والمخزن.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="مواد المتجر" value={stats.total} />
              <Stat label="محجوز مؤقتا" value={stats.reserved} />
              <Stat label="في الطلبات" value={stats.cart} />
            </div>
          </div>
        </section>

        {error ? <div className="mb-4 rounded-[8px] border border-[#eed9df] bg-[#fff7f8] px-4 py-3 text-[13px] text-[#7a3147]">{error}</div> : null}
        {resultCode ? <div className="mb-4 rounded-[8px] border border-[#d6e7df] bg-[#f2faf6] px-4 py-3 text-[13px] text-[#315f5d]">تم إرسال الطلبات برقم {resultCode}</div> : null}

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

        {view === 'bundles' ? <BundlesView bundles={bundles} traineeCount={traineeCount} onAdd={addBundle} /> : null}

        {view === 'rooms' ? (
          <RoomsView
            rooms={visibleRooms}
            roomTypes={roomTypes}
            roomType={roomType}
            roomSelections={roomSelections}
            form={form}
            setRoomType={setRoomType}
            setRoomSelections={setRoomSelections}
            goOrders={() => setView('orders')}
          />
        ) : null}

        {view === 'orders' ? (
          <OrdersView
            form={form}
            setForm={setForm}
            cartRows={cartRows}
            selectedRooms={selectedRooms}
            setQty={setQty}
            submitting={submitting}
            onSubmit={submitNeed}
            goHome={() => setView('home')}
            goRooms={() => setView('rooms')}
          />
        ) : null}
      </div>

      <footer className="border-t border-[#cfded9] bg-[#fbfdfc] px-4 py-5 text-center text-[13px] text-[#6d7b78]">
        حقوق النشر - إدارة عمليات التدريب وكالة التدريب 2026
      </footer>

      {view !== 'orders' && stats.cart > 0 ? (
        <CheckoutBar count={stats.cart} uniqueCount={cartRows.length} onCheckout={() => setView('rooms')} />
      ) : null}
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
    <section className="rounded-[14px] border border-[#d5e0dc] bg-[#fbfdfc] p-4 shadow-[0_14px_40px_rgba(36,55,54,0.06)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="بحث عن مادة"
          className="h-11 rounded-[8px] border border-[#cfded9] bg-white px-4 text-[14px] outline-none transition placeholder:text-[#9aa7a4] focus:border-[#8aa6a1] focus:shadow-[0_0_0_3px_rgba(138,166,161,0.14)] lg:w-[320px]"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-[999px] border px-4 py-2 text-[13px] transition ${
                category === cat ? 'border-[#9bb4af] bg-[#e8f1ef] text-[#203634] shadow-[0_6px_18px_rgba(49,95,93,0.10)]' : 'border-[#d4dfdc] bg-white text-[#53635f] hover:border-[#b8cbc6] hover:bg-[#f7faf9]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="py-16 text-center text-[#6d7b78]">جاري تحميل المواد...</div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <article key={bundle.id} className="rounded-[14px] border border-[#d5e0dc] bg-white p-4 shadow-[0_14px_36px_rgba(36,55,54,0.06)] transition hover:-translate-y-0.5 hover:border-[#b8cbc6]">
          <ProductImage title={bundle.title} imageUrl={bundle.imageUrl} ratio="aspect-[16/9]" />
          <h2 className="mt-4 text-[20px] text-[#243736]">{bundle.title}</h2>
          <p className="mt-1 min-h-12 text-[13px] leading-6 text-[#6d7b78]">{bundle.description}</p>
          <div className="mt-4 space-y-2">
            {bundle.items.map((item) => (
              <div key={item.catalogItemId} className="flex items-center justify-between rounded-[8px] border border-[#edf2f1] bg-[#f8fbfa] px-3 py-2 text-[13px]">
                <span>{item.title}</span>
                <span className="text-[#315f5d]">{item.quantityMode === 'PER_TRAINEE' ? `${traineeCount || 'عدد المتدربين'} × ${item.quantity}` : item.quantity}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onAdd(bundle)} className="mt-4 h-11 w-full rounded-[8px] bg-[#315f5d] text-[14px] text-white shadow-[0_10px_24px_rgba(49,95,93,0.18)] transition hover:bg-[#274f4d]">
            إضافة البكج للطلبات
          </button>
        </article>
      ))}
    </section>
  );
}

function RoomsView({
  rooms,
  roomTypes,
  roomType,
  roomSelections,
  form,
  setRoomType,
  setRoomSelections,
  goOrders,
}: {
  rooms: TrainingRoom[];
  roomTypes: string[];
  roomType: string;
  roomSelections: RoomSelection[];
  form: { startDate: string; endDate: string; traineeCount: string };
  setRoomType: (value: string) => void;
  setRoomSelections: React.Dispatch<React.SetStateAction<RoomSelection[]>>;
  goOrders: () => void;
}) {
  const selectedRoomIds = new Set(roomSelections.map((selection) => selection.roomId));
  const selectionRows = roomSelections
    .map((selection) => ({ selection, room: rooms.find((room) => room.id === selection.roomId) }))
    .filter((row) => row.room) as { selection: RoomSelection; room: TrainingRoom }[];
  const dateReady = !!form.startDate && !!form.endDate;

  function selectRoom(room: TrainingRoom) {
    if (!room.isAvailable) return;
    setRoomSelections((prev) => {
      const exists = prev.some((selection) => selection.roomId === room.id);
      if (exists) return prev.filter((selection) => selection.roomId !== room.id);
      return [
        ...prev,
        {
          roomId: room.id,
          layout: room.layoutOptions[0] || '',
          startDate: form.startDate,
          endDate: form.endDate || form.startDate,
        },
      ];
    });
  }

  function updateSelection(roomId: string, patch: Partial<RoomSelection>) {
    setRoomSelections((prev) => prev.map((selection) => (selection.roomId === roomId ? { ...selection, ...patch } : selection)));
  }

  const selectedRoomId = '';
  const requestedLayout = '';
  const setSelectedRoomId = (_value: string) => undefined;
  const setRequestedLayout = (_value: string) => undefined;

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
      <div className="rounded-[14px] border border-[#d5e0dc] bg-[#fbfdfc] p-4 shadow-[0_14px_40px_rgba(36,55,54,0.06)]">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[24px] text-[#243736]">حجز القاعات التدريبية</h2>
            <p className="mt-1 text-[13px] text-[#6d7b78]">اختر قاعة واحدة لكل فترة الدورة، أو أكثر من قاعة إذا كانت الدورة تحتاج أماكن مختلفة في أيام مختلفة.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {roomTypes.map((type) => (
              <button key={type} type="button" onClick={() => setRoomType(type)} className={`shrink-0 rounded-[999px] border px-4 py-2 text-[13px] ${roomType === type ? 'border-[#9bb4af] bg-[#e8f1ef] text-[#203634]' : 'border-[#d4dfdc] bg-white text-[#53635f]'}`}>
                {type}
              </button>
            ))}
          </div>
        </div>
        {!dateReady ? (
          <div className="mb-4 rounded-[10px] border border-[#e8ddbf] bg-[#fff9ec] px-4 py-3 text-[13px] leading-6 text-[#7f6b43]">
            أدخل تاريخ بداية ونهاية الدورة في صفحة الطلبات حتى تظهر الإتاحة حسب أيام الدورة بدقة.
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const selected = selectedRoomIds.has(room.id);
            return (
              <article key={room.id} className={`overflow-hidden rounded-[14px] border bg-white transition ${selected ? 'border-[#315f5d] ring-2 ring-[#d9e7e3]' : 'border-[#d5e0dc]'}`}>
                <ProductImage title={room.name} imageUrl={room.imageUrl} ratio="aspect-[16/9]" />
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[18px] text-[#243736]">{room.name}</div>
                      <div className="mt-1 text-[12px] text-[#6d7b78]">{room.type} - سعة {room.capacity}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] ${room.isAvailable ? 'bg-[#eef8f2] text-[#1e6b4c]' : 'bg-[#fff1f3] text-[#7a3147]'}`}>
                      {room.isAvailable ? 'متاحة للفترة' : 'محجوزة للفترة'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {room.layoutOptions.slice(0, 3).map((layout) => <span key={layout} className="rounded-full bg-[#f4f7f6] px-2 py-1 text-[11px] text-[#53635f]">{layout}</span>)}
                  </div>
                  <button type="button" onClick={() => selectRoom(room)} disabled={!room.isAvailable} className={`h-10 w-full rounded-[8px] text-[13px] transition disabled:bg-[#aab7b4] ${selected ? 'border border-[#315f5d] bg-white text-[#315f5d]' : 'bg-[#315f5d] text-white'}`}>
                    {selected ? 'إلغاء اختيار القاعة' : 'اختيار القاعة'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <aside className="rounded-[14px] border border-[#d5e0dc] bg-[#fffdf8] p-4 shadow-[0_14px_40px_rgba(36,55,54,0.07)] lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:self-start lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[20px] text-[#243736]">ملخص حجز القاعات</h3>
            <div className="mt-1 text-[12px] text-[#6d7b78]">{selectionRows.length} قاعة محددة</div>
          </div>
          {selectionRows.length ? (
            <button type="button" onClick={() => setRoomSelections([])} className="rounded-[8px] border border-[#e3c8d1] px-3 py-2 text-[12px] text-[#7a3147]">مسح الكل</button>
          ) : null}
        </div>
        <div className="mt-4 space-y-3">
          {selectionRows.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-[#cfded9] bg-white px-4 py-8 text-center text-[13px] leading-6 text-[#6d7b78]">
              اختر قاعة من البطاقات، وسيظهر الحجز هنا مباشرة بدون النزول إلى آخر الصفحة.
            </div>
          ) : selectionRows.map(({ selection, room }) => (
            <div key={room.id} className="rounded-[10px] border border-[#d5e0dc] bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[15px] text-[#243736]">{room.name}</div>
                  <div className="mt-1 text-[12px] text-[#6d7b78]">{room.type} - سعة {room.capacity}</div>
                </div>
                <button type="button" onClick={() => setRoomSelections((prev) => prev.filter((row) => row.roomId !== room.id))} className="text-[12px] text-[#7a3147]">حذف</button>
              </div>
              <div className="mt-3 grid gap-2">
                <label className="text-[12px] text-[#53635f]">
                  من
                  <input type="date" value={selection.startDate} min={form.startDate || undefined} max={form.endDate || undefined} onChange={(event) => updateSelection(room.id, { startDate: event.target.value })} className="mt-1 h-10 w-full rounded-[8px] border border-[#cfded9] px-3" />
                </label>
                <label className="text-[12px] text-[#53635f]">
                  إلى
                  <input type="date" value={selection.endDate} min={selection.startDate || form.startDate || undefined} max={form.endDate || undefined} onChange={(event) => updateSelection(room.id, { endDate: event.target.value })} className="mt-1 h-10 w-full rounded-[8px] border border-[#cfded9] px-3" />
                </label>
                <label className="text-[12px] text-[#53635f]">
                  ترتيب القاعة
                  <select value={selection.layout} onChange={(event) => updateSelection(room.id, { layout: event.target.value })} className="mt-1 h-10 w-full rounded-[8px] border border-[#cfded9] bg-white px-3">
                    <option value="">بدون تفضيل محدد</option>
                    {room.layoutOptions.map((layout) => <option key={layout} value={layout}>{layout}</option>)}
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={goOrders} className="mt-4 h-12 w-full rounded-[8px] bg-[#315f5d] text-[14px] text-white shadow-[0_12px_28px_rgba(49,95,93,0.20)]">
          متابعة ومراجعة طلب التجهيز
        </button>
      </aside>
    </section>
  );

  const selected = rooms.find((room) => room.id === selectedRoomId);
  return (
    <section className="rounded-[14px] border border-[#d5e0dc] bg-[#fbfdfc] p-4 shadow-[0_14px_40px_rgba(36,55,54,0.06)]">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[24px] text-[#243736]">اختيار القاعة التدريبية</h2>
          <p className="mt-1 text-[13px] text-[#6d7b78]">اختر القاعة المناسبة للدورة. الاعتماد النهائي يتم من المنسق لمنع التعارض.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {roomTypes.map((type) => (
            <button key={type} type="button" onClick={() => setRoomType(type)} className={`shrink-0 rounded-[999px] border px-4 py-2 text-[13px] ${roomType === type ? 'border-[#9bb4af] bg-[#e8f1ef] text-[#203634]' : 'border-[#d4dfdc] bg-white text-[#53635f]'}`}>
              {type}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room) => (
          <article key={room.id} className={`overflow-hidden rounded-[14px] border bg-white transition ${selectedRoomId === room.id ? 'border-[#315f5d] ring-2 ring-[#d9e7e3]' : 'border-[#d5e0dc]'}`}>
            <ProductImage title={room.name} imageUrl={room.imageUrl} ratio="aspect-[16/9]" />
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[18px] text-[#243736]">{room.name}</div>
                  <div className="mt-1 text-[12px] text-[#6d7b78]">{room.type} - سعة {room.capacity}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] ${room.isAvailable ? 'bg-[#eef8f2] text-[#1e6b4c]' : 'bg-[#fff1f3] text-[#7a3147]'}`}>
                  {room.isAvailable ? 'متاحة' : 'محجوزة'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {room.layoutOptions.slice(0, 3).map((layout) => <span key={layout} className="rounded-full bg-[#f4f7f6] px-2 py-1 text-[11px] text-[#53635f]">{layout}</span>)}
              </div>
              <button type="button" onClick={() => setSelectedRoomId(room.id)} disabled={!room.isAvailable} className="h-10 w-full rounded-[8px] bg-[#315f5d] text-[13px] text-white disabled:bg-[#aab7b4]">
                {selectedRoomId === room.id ? 'تم اختيار القاعة' : 'اختيار القاعة'}
              </button>
            </div>
          </article>
        ))}
      </div>
      {selected ? (
        <div className="mt-4 rounded-[12px] border border-[#d5e0dc] bg-white p-4">
          <label className="block">
            <span className="mb-1 block text-[12px] text-[#53635f]">نمط ترتيب القاعة المطلوب</span>
            <select value={requestedLayout} onChange={(event) => setRequestedLayout(event.target.value)} className="h-11 w-full rounded-[8px] border border-[#cfded9] bg-white px-3">
              <option value="">بدون تفضيل محدد</option>
              {selected.layoutOptions.map((layout) => <option key={layout} value={layout}>{layout}</option>)}
            </select>
          </label>
        </div>
      ) : null}
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={goOrders} className="h-11 rounded-[8px] bg-[#315f5d] px-6 text-[14px] text-white">
          متابعة ومراجعة طلب تجهيز الدورة
        </button>
      </div>
    </section>
  );
}

function OrdersView({
  form,
  setForm,
  cartRows,
  selectedRooms,
  setQty,
  submitting,
  onSubmit,
  goHome,
  goRooms,
}: {
  form: { trainerName: string; courseName: string; startDate: string; endDate: string; traineeCount: string };
  setForm: React.Dispatch<React.SetStateAction<{ trainerName: string; courseName: string; startDate: string; endDate: string; traineeCount: string }>>;
  cartRows: { item: StoreItem; quantity: number }[];
  selectedRooms: { selection: RoomSelection; room: TrainingRoom }[];
  setQty: (id: string, qty: number) => void;
  submitting: boolean;
  onSubmit: (event: React.FormEvent) => void;
  goHome: () => void;
  goRooms: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <section className="rounded-[14px] border border-[#d5e0dc] bg-white p-5 shadow-[0_14px_40px_rgba(36,55,54,0.06)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[24px] text-[#243736]">الطلبات</h2>
          <button type="button" onClick={goHome} className="rounded-[8px] border border-[#cfded9] bg-[#fbfdfc] px-4 py-2 text-[13px] text-[#315f5d] hover:border-[#b8cbc6] hover:bg-white">إضافة مواد</button>
        </div>
        {cartRows.length ? (
          <div className="divide-y divide-[#edf2f1]">
            {cartRows.map(({ item, quantity }) => (
              <div key={item.id} className="grid gap-4 py-4 md:grid-cols-[140px_1fr_auto] md:items-center">
                <ProductImage title={item.title} imageUrl={item.imageUrl} ratio="aspect-[4/3]" />
                <div>
                  <div className="text-[18px] text-[#243736]">{item.title}</div>
                  <div className="mt-1 text-[13px] text-[#6d7b78]">{item.category}</div>
                  <StockLine item={item} />
                  <button type="button" onClick={() => setQty(item.id, 0)} className="mt-3 text-[13px] text-[#7a3147]">حذف</button>
                </div>
                <QuantityControl value={quantity} onMinus={() => setQty(item.id, quantity - 1)} onPlus={() => setQty(item.id, quantity + 1)} onChange={(value) => setQty(item.id, value)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[10px] border border-dashed border-[#cfded9] bg-[#f8fbfa] px-4 py-16 text-center text-[#6d7b78]">لا توجد طلبات حتى الآن</div>
        )}
      </section>

      <aside className="rounded-[14px] border border-[#d5e0dc] bg-[#fffdf8] p-5 shadow-[0_14px_40px_rgba(36,55,54,0.07)] xl:sticky xl:top-24 xl:self-start">
        <h3 className="text-[20px] text-[#243736]">مراجعة قبل الإرسال</h3>
        <div className="mt-4 space-y-3">
          <Input label="اسم المدرب" value={form.trainerName} onChange={(value) => setForm((prev) => ({ ...prev, trainerName: value }))} />
          <Input label="اسم الدورة" value={form.courseName} onChange={(value) => setForm((prev) => ({ ...prev, courseName: value }))} />
          <Input label="تاريخ بداية الدورة" type="date" value={form.startDate} onChange={(value) => setForm((prev) => ({ ...prev, startDate: value }))} />
          <Input label="تاريخ نهاية الدورة" type="date" value={form.endDate} onChange={(value) => setForm((prev) => ({ ...prev, endDate: value }))} />
          <Input label="عدد المتدربين" type="number" value={form.traineeCount} onChange={(value) => setForm((prev) => ({ ...prev, traineeCount: value }))} />
        </div>
        <div className="mt-4 rounded-[10px] border border-[#e8ddbf] bg-[#fbf6ea] px-4 py-3 text-[13px] leading-6 text-[#6f5a2f]">
          تاريخ نهاية الدورة يستخدم كتاريخ إرجاع متوقع للمواد المسترجعة عند تحويل الاحتياج إلى طلب مواد.
        </div>
        <div className="mt-4 rounded-[10px] border border-[#d5e0dc] bg-white px-4 py-3 text-[13px] leading-6 text-[#53635f]">
          <div className="text-[#243736]">القاعات المطلوبة</div>
          <div className="mt-1 space-y-1">
            {selectedRooms.length ? selectedRooms.map(({ selection, room }) => (
              <div key={room.id}>{room.name} - {selection.startDate || 'بدون تاريخ'} إلى {selection.endDate || 'بدون تاريخ'}</div>
            )) : 'لم يتم اختيار قاعة بعد'}
          </div>
          <button type="button" onClick={goRooms} className="mt-3 rounded-[8px] border border-[#cfded9] px-3 py-2 text-[12px] text-[#315f5d]">اختيار أو تعديل القاعة</button>
        </div>
        <button type="submit" disabled={submitting || cartRows.length === 0} className="mt-5 h-12 w-full rounded-[8px] bg-[#315f5d] text-[15px] text-white shadow-[0_12px_28px_rgba(49,95,93,0.20)] transition hover:bg-[#274f4d] disabled:cursor-not-allowed disabled:bg-[#aab7b4] disabled:shadow-none">
          {submitting ? 'جاري الإرسال...' : 'إرسال الطلبات'}
        </button>
      </aside>
    </form>
  );
}

function MaterialCard({ item, qty, setQty }: { item: StoreItem; qty: number; setQty: (id: string, qty: number) => void }) {
  return (
    <article className={`overflow-hidden rounded-[14px] border bg-white shadow-[0_10px_28px_rgba(36,55,54,0.055)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(36,55,54,0.10)] ${qty > 0 ? 'border-[#9bb4af] ring-1 ring-[#d9e7e3]' : 'border-[#d5e0dc] hover:border-[#b8cbc6]'}`}>
      <ProductImage title={item.title} imageUrl={item.imageUrl} ratio="aspect-[16/10]" />
      <div className="space-y-3 p-4">
        <div>
          <div className="text-[16px] text-[#243736]">{item.title}</div>
          <div className="mt-1 text-[12px] text-[#6d7b78]">{item.category}</div>
        </div>
        <StockLine item={item} />
        {qty > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <QuantityControl value={qty} onMinus={() => setQty(item.id, qty - 1)} onPlus={() => setQty(item.id, qty + 1)} onChange={(value) => setQty(item.id, value)} />
            <span className="rounded-full bg-[#e8f1ef] px-3 py-1 text-[12px] text-[#315f5d]">ضمن الطلبات</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setQty(item.id, 1)}
            className="h-10 w-full rounded-[8px] border border-[#c6d7d3] bg-[#f8fbfa] text-[14px] text-[#315f5d] transition hover:border-[#8aa6a1] hover:bg-[#eaf3f1]"
          >
            إضافة للطلبات
          </button>
        )}
      </div>
    </article>
  );
}

function CheckoutBar({ count, uniqueCount, onCheckout }: { count: number; uniqueCount: number; onCheckout: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#cfded9] bg-white/92 px-4 py-3 shadow-[0_-18px_42px_rgba(36,55,54,0.12)] backdrop-blur">
      <div className="mx-auto flex max-w-[880px] items-center justify-between gap-3 rounded-[14px] border border-[#c8d8d4] bg-[#fffdf8] p-2 shadow-[0_10px_28px_rgba(36,55,54,0.08)]">
        <div className="min-w-0 px-2">
          <div className="text-[14px] text-[#243736]">تم اختيار {count} مادة</div>
          <div className="text-[12px] text-[#6d7b78]">{uniqueCount} صنف في الطلبات</div>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          className="h-11 shrink-0 rounded-[10px] bg-[#315f5d] px-6 text-[14px] text-white shadow-[0_10px_24px_rgba(49,95,93,0.20)] transition hover:bg-[#274f4d]"
        >
          إتمام الطلب
        </button>
      </div>
    </div>
  );
}

function ProductImage({ title, imageUrl, ratio }: { title: string; imageUrl?: string | null; ratio: string }) {
  return (
    <div className={`${ratio} overflow-hidden bg-[#eef4f2]`}>
      {imageUrl ? (
        <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center border-b border-[#dfe8e5] bg-[linear-gradient(135deg,#f8fbfa_0%,#eef4f2_55%,#f7f1e4_100%)] px-4 text-center text-[13px] leading-7 text-[#7b8885]">
          <span className="rounded-full border border-[#d4dfdc] bg-white/80 px-4 py-2">صورة المادة</span>
        </div>
      )}
    </div>
  );
}

function QuantityControl({ value, onMinus, onPlus, onChange }: { value: number; onMinus: () => void; onPlus: () => void; onChange: (value: number) => void }) {
  return (
    <div className="inline-flex h-10 items-center overflow-hidden rounded-[999px] border border-[#cfded9] bg-white shadow-[0_4px_12px_rgba(36,55,54,0.05)]">
      <button type="button" onClick={onPlus} className="h-full w-11 text-[22px] text-[#315f5d]">+</button>
      <input type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-full w-14 border-x border-[#e7eeee] text-center text-[15px] outline-none" />
      <button type="button" onClick={onMinus} className="h-full w-11 text-[22px] text-[#315f5d]">−</button>
    </div>
  );
}

function StockLine({ item }: { item: StoreItem }) {
  if (item.isOnDemand) return <div className="rounded-[8px] border border-[#e8ddbf] bg-[#fbf6ea] px-3 py-2 text-[12px] leading-6 text-[#7f6b43]">{item.onDemandNote}</div>;
  return (
    <div className="mt-2 rounded-[8px] border border-[#edf2f1] bg-[#f8fbfa] px-3 py-2 text-[12px] leading-6 text-[#53635f]">
      <div className="flex justify-between"><span>المتاح في المخزن</span><span>{item.stockQty}</span></div>
      <div className="flex justify-between"><span>محجوز مؤقتا</span><span>{item.temporarilyReservedQty}</span></div>
      <div className="text-[#7b8885]">الحجز المؤقت لا يخصم فعليا إلا عند الصرف.</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] border border-[#e3ece9] bg-white px-4 py-2 shadow-[0_8px_20px_rgba(36,55,54,0.05)]">
      <div className="text-[11px] text-[#6d7b78]">{label}</div>
      <div className="text-[18px] text-[#243736]">{value}</div>
    </div>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[8px] border px-4 py-2 text-[13px] transition ${
        active ? 'border-[#9bb4af] bg-[#e8f1ef] text-[#203634]' : 'border-[#cfded9] bg-white text-[#315f5d] hover:border-[#b8cbc6] hover:bg-[#f7faf9]'
      }`}
    >
      {children}
    </button>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-[#53635f]">{label}</span>
      <input required type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-[8px] border border-[#cfded9] bg-white px-3 outline-none transition focus:border-[#8aa6a1] focus:shadow-[0_0_0_3px_rgba(138,166,161,0.14)]" />
    </label>
  );
}
