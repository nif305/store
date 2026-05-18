'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

/* ══════════════════════════════════════════
   COLOR PALETTE
   Primary  : #2A6364
   Gold     : #C7B08C
   Bg       : #F9F9F9
   Burgundy : #73384B
   Blue     : #2E6F8E
   Green    : #4F8F7A
   Brown    : #6B5A4A
   LightGray: #DADBD9
   MidGray  : #B5BDBE
   DarkGray : #5A5A5A
══════════════════════════════════════════ */

/* ─── Types ─── */
type StoreItem = {
  id: string; title: string; description?: string | null;
  category: string; imageUrl?: string | null;
  isOnDemand: boolean; onDemandNote?: string | null;
  stockQty: number; temporarilyReservedQty: number; unit: string;
};
type Bundle = {
  id: string; title: string; description?: string | null; imageUrl?: string | null;
  items: { catalogItemId: string; quantity: number; quantityMode?: 'FIXED' | 'PER_TRAINEE'; title: string; imageUrl?: string | null }[];
};
type TrainingRoom = {
  id: string; name: string; type: string; capacity: number;
  location?: string | null; description?: string | null;
  equipment: string[]; layoutOptions: string[];
  imageUrl?: string | null; isAvailable: boolean; capacityFit: boolean;
};
type Cart = Record<string, number>;
type View = 'home' | 'bundles' | 'rooms' | 'orders' | 'success';
type RoomSelection = { roomId: string; layout: string; startDate: string; endDate: string };
type SuggestedItem = { title: string; quantity: string; note: string };
type SubmittedOrder = {
  code: string; trainerName: string; courseName: string;
  startDate: string; endDate: string; traineeCount: number;
  items: { title: string; quantity: number; unit: string; category: string }[];
  suggestedItems: SuggestedItem[];
  rooms: { name: string; type: string; startDate: string; endDate: string }[];
  submittedAt: string;
};

/* ─── Category SVG fallback illustrations ─── */
function CategoryIllustration({ category, size = 48 }: { category: string; size?: number }) {
  const c = category || '';
  const color = /قلم|قرطاسية/.test(c) ? '#4F8F7A' :
    /نوت|دفتر/.test(c) ? '#2A6364' :
    /ملف|فولدر/.test(c) ? '#C7B08C' :
    /شهادة/.test(c) ? '#6B5A4A' :
    /لابتوب|حاسب|جهاز|تقني/.test(c) ? '#2E6F8E' :
    /ميكروفون|مكبر/.test(c) ? '#4F8F7A' :
    /سبورة|لوح/.test(c) ? '#73384B' : '#2A6364';

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="10" fill={color} fillOpacity=".1" />
      {/قلم|قرطاسية/.test(c) ? (
        <path d="M32 12l4 4L18 34H14v-4L32 12z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      ) : /نوت|دفتر/.test(c) ? (
        <>
          <rect x="13" y="8" width="22" height="32" rx="2" stroke={color} strokeWidth="1.5" />
          <path d="M18 16h12M18 22h12M18 28h8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : /ملف|فولدر/.test(c) ? (
        <path d="M8 18a2 2 0 0 1 2-2h10l4 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V18z" stroke={color} strokeWidth="1.5" />
      ) : /لابتوب|حاسب|تقني/.test(c) ? (
        <>
          <rect x="8" y="10" width="32" height="22" rx="2" stroke={color} strokeWidth="1.5" />
          <path d="M4 32h40l-2 6H6l-2-6z" stroke={color} strokeWidth="1.5" />
        </>
      ) : /سبورة|لوح/.test(c) ? (
        <>
          <rect x="6" y="8" width="36" height="26" rx="2" stroke={color} strokeWidth="1.5" />
          <path d="M14 24l5-8 5 5 4-4 6 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M14 16a2 2 0 0 1 2-2h16l8 8v18a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V16z" stroke={color} strokeWidth="1.5" />
          <path d="M32 14v10h10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 26h12M18 32h8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/* ─── Room illustration ─── */
function RoomIllustration({ type }: { type: string }) {
  const color = /معمل/.test(type) ? '#2E6F8E' : /مسرح|كبرى/.test(type) ? '#73384B' : /ورشة/.test(type) ? '#C7B08C' : '#2A6364';
  return (
    <svg viewBox="0 0 320 180" className="h-full w-full" fill="none" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill={color} fillOpacity=".08" />
      <rect x="20" y="20" width="280" height="140" rx="8" fill="white" opacity=".4" />
      {[0,1,2,3].map((r) => [0,1,2,3,4,5,6].map((c) => (
        <rect key={`${r}${c}`} x={28+c*40} y={28+r*34} width="28" height="20" rx="3" fill={color} opacity=".12" />
      )))}
      <rect x="110" y="152" width="100" height="12" rx="4" fill={color} opacity=".25" />
    </svg>
  );
}

/* ─── Step bar ─── */
const STEPS = [
  { key: 'home', label: 'المواد' },
  { key: 'rooms', label: 'القاعة' },
  { key: 'orders', label: 'المراجعة' },
];
function stepIdx(v: View) { if (v === 'home' || v === 'bundles') return 0; if (v === 'rooms') return 1; if (v === 'orders') return 2; return 3; }

function StepBar({ view }: { view: View }) {
  if (view === 'success') return null;
  const cur = stepIdx(view);
  return (
    <div className="flex items-center justify-center gap-0 border-t border-[#DADBD9] bg-white px-4 py-2.5">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[12px] font-semibold transition-all ${
            i === cur ? 'bg-[#2A6364] text-white' : i < cur ? 'text-[#4F8F7A]' : 'text-[#B5BDBE]'
          }`}>
            {i < cur && <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4L6 11l-3-3" /></svg>}
            {step.label}
          </div>
          {i < STEPS.length - 1 && <div className={`mx-1 h-px w-6 ${i < cur ? 'bg-[#2A6364]' : 'bg-[#DADBD9]'}`} />}
        </div>
      ))}
    </div>
  );
}

/* ─── Suggested Items Modal ─── */
function SuggestedModal({ items, onClose, onSave }: {
  items: SuggestedItem[];
  onClose: () => void;
  onSave: (items: SuggestedItem[]) => void;
}) {
  const [local, setLocal] = useState<SuggestedItem[]>(items.length ? items : [{ title: '', quantity: '1', note: '' }]);
  function add() { setLocal((p) => [...p, { title: '', quantity: '1', note: '' }]); }
  function update(i: number, patch: Partial<SuggestedItem>) { setLocal((p) => p.map((s, idx) => idx === i ? { ...s, ...patch } : s)); }
  function remove(i: number) { setLocal((p) => p.filter((_, idx) => idx !== i)); }
  function save() { onSave(local.filter((s) => s.title.trim())); }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" dir="rtl">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-[24px] bg-white p-5 shadow-2xl sm:rounded-[20px]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-extrabold text-[#2A6364]">مواد مقترحة</h3>
            <p className="mt-0.5 text-[11px] text-[#B5BDBE]">مواد غير متوفرة في المتجر — سيراجعها المنسق</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F9F9F9] text-[#5A5A5A] hover:bg-[#DADBD9]">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
          {local.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_auto] gap-2">
              <input value={s.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="اسم المادة"
                className="h-9 rounded-[8px] border border-[#DADBD9] bg-[#F9F9F9] px-3 text-[13px] outline-none placeholder:text-[#B5BDBE] focus:border-[#2A6364]/40 focus:bg-white" />
              <input type="number" min="1" value={s.quantity} onChange={(e) => update(i, { quantity: e.target.value })} placeholder="الكمية"
                className="h-9 rounded-[8px] border border-[#DADBD9] bg-[#F9F9F9] px-2 text-center text-[13px] outline-none focus:border-[#2A6364]/40 focus:bg-white" />
              <button onClick={() => remove(i)} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#DADBD9] text-[#73384B] hover:bg-[#fff0f3]">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
        <button onClick={add} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[#DADBD9] py-2 text-[12px] text-[#B5BDBE] hover:border-[#C7B08C] hover:text-[#6B5A4A]">
          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          إضافة مادة
        </button>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-[10px] border border-[#DADBD9] py-2.5 text-[13px] font-semibold text-[#5A5A5A] hover:bg-[#F9F9F9]">إلغاء</button>
          <button onClick={save} className="flex-1 rounded-[10px] bg-[#2A6364] py-2.5 text-[13px] font-bold text-white hover:bg-[#1e5152]">حفظ المقترحات</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════ */
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
  const [suggestedItems, setSuggestedItems] = useState<SuggestedItem[]>([]);
  const [form, setForm] = useState({ trainerName: '', courseName: '', startDate: '', endDate: '', traineeCount: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrder | null>(null);
  const [error, setError] = useState('');
  const [showSuggestedModal, setShowSuggestedModal] = useState(false);

  async function loadCatalog() {
    const res = await fetch(`/api/training-store/catalog?t=${Date.now()}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'تعذر تحميل مواد التدريب');
    setItems(Array.isArray(json.items) ? json.items : []);
    setBundles(Array.isArray(json.bundles) ? json.bundles : []);
  }

  async function loadRooms() {
    const params = new URLSearchParams();
    if (form.startDate) params.set('startDate', form.startDate);
    if (form.endDate) params.set('endDate', form.endDate);
    if (form.traineeCount) params.set('traineeCount', form.traineeCount);
    const res = await fetch(`/api/training-rooms/public?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    setRooms(Array.isArray(json.rooms) ? json.rooms : []);
  }

  useEffect(() => {
    let mounted = true;
    loadCatalog().catch(() => mounted && setError('تعذر تحميل المواد')).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => { loadRooms().catch(() => undefined); }, [form.startDate, form.endDate, form.traineeCount]);

  useEffect(() => {
    const starts = roomSelections.map((s) => s.startDate).filter(Boolean).sort();
    const ends = roomSelections.map((s) => s.endDate).filter(Boolean).sort();
    if (!starts.length && !ends.length) return;
    setForm((prev) => {
      const ns = starts[0]; const ne = ends[ends.length - 1] || '';
      if (prev.startDate === ns && prev.endDate === ne) return prev;
      return { ...prev, startDate: ns, endDate: ne };
    });
  }, [roomSelections]);

  const traineeCount = Math.max(0, Number(form.traineeCount || 0));
  const cartRows = useMemo(() => Object.entries(cart)
    .map(([id, qty]) => ({ item: items.find((r) => r.id === id), quantity: qty }))
    .filter((r) => r.item && r.quantity > 0) as { item: StoreItem; quantity: number }[], [cart, items]);

  const categories = useMemo(() => ['الكل', ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const roomTypes = useMemo(() => ['الكل', ...Array.from(new Set(rooms.map((r) => r.type)))], [rooms]);
  const selectedRooms = useMemo(() =>
    roomSelections.map((s) => ({ selection: s, room: rooms.find((r) => r.id === s.roomId) || null }))
      .filter((r) => r.room) as { selection: RoomSelection; room: TrainingRoom }[], [rooms, roomSelections]);
  const visibleRooms = useMemo(() => rooms.filter((r) => roomType === 'الكل' || r.type === roomType), [rooms, roomType]);
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const catOk = category === 'الكل' || item.category === category;
      const searchOk = !needle || item.title.toLowerCase().includes(needle) || item.category.toLowerCase().includes(needle);
      return catOk && searchOk;
    });
  }, [items, category, query]);
  const cartCount = cartRows.reduce((s, r) => s + r.quantity, 0);
  const validSuggested = suggestedItems.filter((s) => s.title.trim() && Number(s.quantity) > 0);

  function setQty(id: string, qty: number) {
    setCart((prev) => { const next = { ...prev }; if (qty <= 0) delete next[id]; else next[id] = Math.floor(qty); return next; });
  }

  function addBundle(bundle: Bundle) {
    setError('');
    setCart((prev) => {
      const next = { ...prev };
      for (const row of bundle.items) {
        if (row.quantityMode === 'PER_TRAINEE' && traineeCount <= 0) continue;
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
    setSubmitting(true);
    try {
      const res = await fetch('/api/trainer-needs/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, traineeCount,
          items: cartRows.map((r) => ({ catalogItemId: r.item.id, quantity: r.quantity })),
          suggestedItems: validSuggested.map((s) => ({ title: s.title.trim(), quantity: Number(s.quantity), note: s.note.trim() || undefined })),
          roomId: roomSelections[0]?.roomId || null,
          requestedLayout: roomSelections[0]?.layout || '',
          roomSelections: roomSelections.map((s) => ({ ...s, startDate: s.startDate || form.startDate, endDate: s.endDate || form.endDate || form.startDate })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'تعذر إرسال الطلبات');
      setSubmittedOrder({
        code: json?.data?.code || '',
        trainerName: form.trainerName, courseName: form.courseName,
        startDate: form.startDate, endDate: form.endDate, traineeCount,
        items: cartRows.map((r) => ({ title: r.item.title, quantity: r.quantity, unit: r.item.unit, category: r.item.category })),
        suggestedItems: validSuggested,
        rooms: selectedRooms.map(({ selection, room }) => ({ name: room.name, type: room.type, startDate: selection.startDate || form.startDate, endDate: selection.endDate || form.endDate })),
        submittedAt: new Date().toLocaleString('ar-SA'),
      });
      setCart({}); setRoomSelections([]); setSuggestedItems([]);
      await loadCatalog(); await loadRooms();
      setView('success');
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال الطلبات');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#F9F9F9] text-[#2A2A2A]">
      <style>{`@media print { .no-print { display:none!important; } }`}</style>

      {/* ─── Header ─── */}
      <header className="no-print sticky top-0 z-30 border-b border-[#DADBD9] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-[1480px] items-center gap-3 px-4 py-3">
          {/* Logo */}
          <img src="/nauss-gold-logo.png" alt="جامعة نايف" className="h-10 w-auto object-contain" />
          <div className="flex-1 min-w-0">
            <div className="truncate text-[13px] font-bold text-[#2A6364]">جامعة نايف العربية للعلوم الأمنية</div>
            <div className="text-[10px] text-[#B5BDBE]">مساعد تجهيز الدورة — وكالة التدريب</div>
          </div>

          {/* Nav */}
          {view !== 'success' && (
            <nav className="flex items-center gap-1.5">
              <NavBtn active={view === 'home'} onClick={() => setView('home')}>المواد</NavBtn>
              <NavBtn active={view === 'bundles'} onClick={() => setView('bundles')}>البكجات</NavBtn>
              <NavBtn active={view === 'rooms'} onClick={() => setView('rooms')}>القاعات</NavBtn>
              <NavBtn active={view === 'orders'} onClick={() => setView('orders')} badge={cartCount > 0 ? cartCount : undefined}>طلباتي</NavBtn>
              {/* Suggested items button */}
              <button onClick={() => setShowSuggestedModal(true)}
                className="relative flex items-center gap-1.5 rounded-[8px] border border-[#DADBD9] bg-[#F9F9F9] px-3 py-2 text-[12px] font-semibold text-[#6B5A4A] transition hover:border-[#C7B08C] hover:bg-[#fdf8f0]">
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                مقترحة
                {validSuggested.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#C7B08C] text-[9px] font-bold text-white">{validSuggested.length}</span>
                )}
              </button>
            </nav>
          )}
          <Link href="/login" className="no-print flex items-center gap-1.5 rounded-[8px] border border-[#DADBD9] bg-white px-3 py-2 text-[12px] font-semibold text-[#5A5A5A] hover:border-[#2A6364]/30 hover:text-[#2A6364]">
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>
            دخول
          </Link>
        </div>
        <StepBar view={view} />
      </header>

      {/* Suggested modal */}
      {showSuggestedModal && (
        <SuggestedModal
          items={suggestedItems}
          onClose={() => setShowSuggestedModal(false)}
          onSave={(items) => { setSuggestedItems(items); setShowSuggestedModal(false); }}
        />
      )}

      {/* ─── Content ─── */}
      <div className={`mx-auto max-w-[1480px] px-4 py-4 ${view !== 'orders' && view !== 'success' && cartCount > 0 ? 'pb-28' : ''}`}>
        {error && (
          <div className="no-print mb-3 flex items-center gap-2 rounded-[10px] border border-[#73384B]/20 bg-[#fff5f7] px-4 py-2.5 text-[13px] text-[#73384B]">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
            {error}
          </div>
        )}

        {view === 'home' && <HomeView loading={loading} items={visibleItems} categories={categories} category={category} query={query} cart={cart} setCategory={setCategory} setQuery={setQuery} setQty={setQty} />}
        {view === 'bundles' && <BundlesView bundles={bundles} traineeCount={traineeCount} onAdd={addBundle} />}
        {view === 'rooms' && <RoomsView rooms={visibleRooms} roomTypes={roomTypes} roomType={roomType} roomSelections={roomSelections} form={form} setRoomType={setRoomType} setRoomSelections={setRoomSelections} goOrders={() => setView('orders')} />}
        {view === 'orders' && <OrdersView form={form} setForm={setForm} cartRows={cartRows} selectedRooms={selectedRooms} suggestedItems={validSuggested} setQty={setQty} submitting={submitting} onSubmit={submitNeed} goHome={() => setView('home')} goRooms={() => setView('rooms')} onOpenSuggested={() => setShowSuggestedModal(true)} />}
        {view === 'success' && submittedOrder && <SuccessView order={submittedOrder} onReset={() => { setForm({ trainerName: '', courseName: '', startDate: '', endDate: '', traineeCount: '' }); setSubmittedOrder(null); setView('home'); }} />}
      </div>

      <footer className="no-print mt-8 border-t border-[#DADBD9] py-4 text-center text-[11px] text-[#B5BDBE]">
        وكالة التدريب — جامعة نايف العربية للعلوم الأمنية © 2026
      </footer>

      {/* Checkout float bar */}
      {view !== 'orders' && view !== 'success' && cartCount > 0 && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-[#DADBD9] bg-white/96 px-4 py-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-[640px] items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2A6364] text-[13px] font-bold text-white">{cartCount}</span>
              <div><div className="text-[13px] font-bold text-[#2A2A2A]">{cartRows.length} صنف · {cartCount} وحدة</div><div className="text-[10px] text-[#B5BDBE]">القاعة اختيارية — يمكن المتابعة بدونها</div></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setView('orders')} className="flex items-center gap-1.5 rounded-[10px] border border-[#DADBD9] bg-white px-3 py-2 text-[12px] font-bold text-[#5A5A5A] hover:border-[#2A6364]/30">
                مراجعة مباشرة
              </button>
              <button onClick={() => setView('rooms')} className="flex items-center gap-1.5 rounded-[10px] bg-[#2A6364] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#1e5152]">
                اختيار قاعة
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ═══════════════════════════════════════
   HOME VIEW — Materials Grid
═══════════════════════════════════════ */
function HomeView({ loading, items, categories, category, query, cart, setCategory, setQuery, setQty }: {
  loading: boolean; items: StoreItem[]; categories: string[]; category: string; query: string;
  cart: Cart; setCategory: (v: string) => void; setQuery: (v: string) => void; setQty: (id: string, qty: number) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Search — full row */}
      <div className="relative">
        <svg viewBox="0 0 24 24" fill="none" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B5BDBE]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث عن مادة أو فئة..."
          className="h-10 w-full rounded-[10px] border border-[#DADBD9] bg-white pr-10 pl-4 text-[13px] outline-none placeholder:text-[#B5BDBE] focus:border-[#2A6364]/50 focus:shadow-[0_0_0_3px_rgba(42,99,100,0.08)]" />
      </div>

      {/* Category chips — full row */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {categories.map((cat) => (
          <button key={cat} type="button" onClick={() => setCategory(cat)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${
              category === cat
                ? 'border-[#2A6364] bg-[#2A6364] text-white'
                : 'border-[#DADBD9] bg-white text-[#5A5A5A] hover:border-[#2A6364]/30 hover:text-[#2A6364]'
            }`}>{cat}</button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[1,2,3,4,5,6,7,8,9,10].map((i) => <div key={i} className="h-56 animate-pulse rounded-[14px] bg-[#DADBD9]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <CategoryIllustration category="" size={56} />
          <p className="text-[13px] text-[#B5BDBE]">لا توجد نتائج</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {items.map((item) => <MaterialCard key={item.id} item={item} qty={cart[item.id] || 0} setQty={setQty} />)}
        </div>
      )}
    </div>
  );
}

/* ─── Material Card — compact ─── */
function MaterialCard({ item, qty, setQty }: { item: StoreItem; qty: number; setQty: (id: string, qty: number) => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasImg = !!item.imageUrl && !imgFailed;
  const free = Math.max(item.stockQty - item.temporarilyReservedQty, 0);
  const stockColor = free === 0 ? '#73384B' : free < 5 ? '#6B5A4A' : '#4F8F7A';
  const stockLabel = item.isOnDemand ? 'عند الطلب' : free === 0 ? 'نافد' : free < 5 ? 'كمية محدودة' : 'متاح';

  return (
    <article className={`group flex flex-col overflow-hidden rounded-[14px] border bg-white transition hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] ${qty > 0 ? 'border-[#2A6364]/40 ring-1 ring-[#2A6364]/15' : 'border-[#DADBD9]'}`}>
      {/* Image — 4:3 ratio suits most professional product photos */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[#F9F9F9]">
        {hasImg ? (
          <img src={item.imageUrl!} alt={item.title} loading="lazy" className="h-full w-full object-cover object-center" onError={() => setImgFailed(true)} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CategoryIllustration category={item.category} size={56} />
          </div>
        )}
        {/* Stock pill */}
        <span className="absolute bottom-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: stockColor }}>
          {stockLabel}
        </span>
        {/* Added badge */}
        {qty > 0 && (
          <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#2A6364] text-[10px] font-bold text-white">{qty}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <div className="text-[13px] font-bold leading-snug text-[#2A2A2A] line-clamp-2">{item.title}</div>
          <div className="mt-0.5 text-[11px] text-[#B5BDBE]">{item.category}</div>
        </div>
        {item.isOnDemand && item.onDemandNote && (
          <div className="text-[10px] leading-4 text-[#6B5A4A] line-clamp-2">{item.onDemandNote}</div>
        )}

        {qty > 0 ? (
          <div className="mt-auto flex items-center justify-between gap-2">
            <QuantityControl value={qty} onMinus={() => setQty(item.id, qty - 1)} onPlus={() => setQty(item.id, qty + 1)} onChange={(v) => setQty(item.id, v)} />
            <button onClick={() => setQty(item.id, 0)} className="text-[11px] text-[#73384B] hover:underline">حذف</button>
          </div>
        ) : (
          <button type="button" onClick={() => setQty(item.id, 1)} disabled={free === 0 && !item.isOnDemand}
            className="mt-auto flex h-8 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#DADBD9] text-[12px] font-semibold text-[#2A6364] transition hover:border-[#2A6364]/40 hover:bg-[#eef5f4] disabled:cursor-not-allowed disabled:opacity-40">
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            {free === 0 && !item.isOnDemand ? 'نافد' : 'إضافة'}
          </button>
        )}
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════
   BUNDLES VIEW
═══════════════════════════════════════ */
function BundlesView({ bundles, traineeCount, onAdd }: { bundles: Bundle[]; traineeCount: number; onAdd: (b: Bundle) => void }) {
  const needsTraineeCount = bundles.some((b) => b.items.some((i) => i.quantityMode === 'PER_TRAINEE')) && traineeCount === 0;
  return (
    <div className="space-y-3">
      {/* Info bar */}
      <div className="flex items-start gap-3 rounded-[12px] border border-[#DADBD9] bg-white px-4 py-3">
        <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-[#2A6364]" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
        <div>
          <p className="text-[12px] font-bold text-[#2A6364]">البكجات الجاهزة</p>
          <p className="text-[11px] text-[#B5BDBE]">مجموعات مواد جاهزة لأنواع شائعة من الدورات — أضف بكجاً بضغطة واحدة وعدّل الكميات لاحقاً من صفحة الطلبات.</p>
          {needsTraineeCount && <p className="mt-1 text-[11px] text-[#C7B08C]">💡 بعض البكجات تحسب الكمية حسب عدد المتدربين — أدخله في صفحة المراجعة لرؤية الكميات الدقيقة.</p>}
        </div>
      </div>
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {!bundles.length && (
        <div className="col-span-3 rounded-[14px] border border-dashed border-[#DADBD9] bg-white py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F9F9F9]"><CategoryIllustration category="" size={32} /></div>
          <p className="text-[13px] font-semibold text-[#5A5A5A]">لا توجد بكجات جاهزة حالياً</p>
          <p className="mt-1 text-[11px] text-[#B5BDBE]">يمكنك إضافة بكجات من قسم إدارة المخزون في المنصة الرئيسية</p>
        </div>
      )}
      {bundles.map((bundle) => (
        <article key={bundle.id} className="flex flex-col overflow-hidden rounded-[14px] border border-[#DADBD9] bg-white transition hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <div className="aspect-[16/7] overflow-hidden bg-[#F9F9F9]">
            {bundle.imageUrl ? <img src={bundle.imageUrl} alt={bundle.title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><CategoryIllustration category="" size={48} /></div>}
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-extrabold text-[#2A2A2A]">{bundle.title}</h3>
                <span className="shrink-0 rounded-full border border-[#DADBD9] px-2 py-0.5 text-[10px] text-[#B5BDBE]">{bundle.items.length} مادة</span>
              </div>
              {bundle.description && <p className="mt-1 text-[12px] leading-5 text-[#B5BDBE]">{bundle.description}</p>}
            </div>
            <div className="space-y-1.5">
              {bundle.items.slice(0, 4).map((item) => (
                <div key={item.catalogItemId} className="flex items-center justify-between rounded-[8px] border border-[#DADBD9] bg-[#F9F9F9] px-3 py-1.5 text-[12px]">
                  <span className="text-[#2A2A2A]">{item.title}</span>
                  <span className="font-bold text-[#2A6364]">{item.quantityMode === 'PER_TRAINEE' ? `${traineeCount || '؟'}×${item.quantity}` : item.quantity}</span>
                </div>
              ))}
              {bundle.items.length > 4 && <div className="text-center text-[11px] text-[#B5BDBE]">+{bundle.items.length - 4} مواد أخرى</div>}
            </div>
            <button type="button" onClick={() => onAdd(bundle)}
              className="mt-auto flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#2A6364] text-[13px] font-bold text-white hover:bg-[#1e5152]">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              إضافة البكج
            </button>
          </div>
        </article>
      ))}
    </section>
    </div>
  );
}

/* ═══════════════════════════════════════
   ROOMS VIEW
═══════════════════════════════════════ */
function RoomsView({ rooms, roomTypes, roomType, roomSelections, form, setRoomType, setRoomSelections, goOrders }: {
  rooms: TrainingRoom[]; roomTypes: string[]; roomType: string; roomSelections: RoomSelection[];
  form: { startDate: string; endDate: string; traineeCount: string };
  setRoomType: (v: string) => void;
  setRoomSelections: React.Dispatch<React.SetStateAction<RoomSelection[]>>;
  goOrders: () => void;
}) {
  const selectedIds = new Set(roomSelections.map((s) => s.roomId));
  const selRows = roomSelections.map((s) => ({ selection: s, room: rooms.find((r) => r.id === s.roomId) })).filter((r) => r.room) as { selection: RoomSelection; room: TrainingRoom }[];

  function select(room: TrainingRoom) {
    if (!room.isAvailable) return;
    setRoomSelections((prev) => {
      if (prev.some((s) => s.roomId === room.id)) return prev.filter((s) => s.roomId !== room.id);
      return [...prev, { roomId: room.id, layout: room.layoutOptions[0] || '', startDate: form.startDate, endDate: form.endDate }];
    });
  }
  function updateSel(roomId: string, patch: Partial<RoomSelection>) {
    setRoomSelections((prev) => prev.map((s) => {
      if (s.roomId !== roomId) return s;
      const next = { ...s, ...patch };
      if (patch.startDate && next.endDate && next.endDate < patch.startDate) next.endDate = '';
      return next;
    }));
  }

  return (
    <div className="relative grid gap-4 xl:block xl:pl-[390px]">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[18px] font-extrabold text-[#2A2A2A]">القاعات التدريبية</h2>
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {roomTypes.map((t) => (
              <button key={t} onClick={() => setRoomType(t)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${roomType === t ? 'border-[#2A6364] bg-[#2A6364] text-white' : 'border-[#DADBD9] bg-white text-[#5A5A5A] hover:border-[#2A6364]/30'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const sel = selectedIds.has(room.id);
            return (
              <article key={room.id} className={`overflow-hidden rounded-[14px] border bg-white transition ${sel ? 'border-[#2A6364] ring-2 ring-[#2A6364]/15' : room.isAvailable ? 'border-[#DADBD9] hover:border-[#2A6364]/30' : 'border-[#DADBD9] opacity-60'}`}>
                <div className="aspect-[16/7] overflow-hidden">
                  {room.imageUrl ? <img src={room.imageUrl} alt={room.name} className="h-full w-full object-cover" /> : <RoomIllustration type={room.type} />}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[14px] font-bold text-[#2A2A2A]">{room.name}</div>
                      <div className="mt-0.5 text-[11px] text-[#B5BDBE]">{room.type} · سعة {room.capacity}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${room.isAvailable ? 'bg-[#eef8f2] text-[#4F8F7A]' : 'bg-[#fff0f3] text-[#73384B]'}`}>
                      {room.isAvailable ? 'متاحة' : 'محجوزة'}
                    </span>
                  </div>
                  {room.equipment.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {room.equipment.slice(0, 3).map((eq) => <span key={eq} className="rounded-full bg-[#F9F9F9] px-2 py-0.5 text-[10px] text-[#5A5A5A]">{eq}</span>)}
                    </div>
                  )}
                  <button onClick={() => select(room)} disabled={!room.isAvailable}
                    className={`mt-3 h-8 w-full rounded-[8px] text-[12px] font-bold transition disabled:opacity-40 ${sel ? 'border border-[#2A6364] bg-white text-[#2A6364]' : 'bg-[#2A6364] text-white hover:bg-[#1e5152]'}`}>
                    {sel ? '✓ محددة' : 'اختيار'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Side panel */}
      <aside className="rounded-[14px] border border-[#DADBD9] bg-white p-4 xl:fixed xl:left-[max(1rem,calc((100vw-1480px)/2+1rem))] xl:top-[108px] xl:z-20 xl:w-[375px] xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-extrabold text-[#2A2A2A]">القاعات المختارة</h3>
          {selRows.length > 0 && <button onClick={() => setRoomSelections([])} className="text-[11px] text-[#73384B] hover:underline">مسح الكل</button>}
        </div>
        <div className="mt-3 space-y-2">
          {selRows.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-[#DADBD9] py-6 text-center text-[12px] text-[#B5BDBE]">اختر قاعة من البطاقات</div>
          ) : selRows.map(({ selection, room }) => (
            <div key={room.id} className="rounded-[10px] border border-[#DADBD9] bg-[#F9F9F9] p-3">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-bold text-[#2A2A2A]">{room.name}</div>
                <button onClick={() => setRoomSelections((p) => p.filter((r) => r.roomId !== room.id))} className="text-[11px] text-[#73384B]">حذف</button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <label className="block text-[10px] text-[#B5BDBE]">
                  من
                  <input type="date" value={selection.startDate} onChange={(e) => updateSel(room.id, { startDate: e.target.value })} className="mt-0.5 h-7 w-full rounded-[6px] border border-[#DADBD9] bg-white px-2 text-[11px] outline-none focus:border-[#2A6364]/40" />
                </label>
                <label className="block text-[10px] text-[#B5BDBE]">
                  إلى
                  <input type="date" value={selection.endDate} min={selection.startDate || undefined} onChange={(e) => updateSel(room.id, { endDate: e.target.value })} className="mt-0.5 h-7 w-full rounded-[6px] border border-[#DADBD9] bg-white px-2 text-[11px] outline-none focus:border-[#2A6364]/40" />
                </label>
              </div>
            </div>
          ))}
        </div>
        <button onClick={goOrders} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-[#2A6364] text-[13px] font-bold text-white hover:bg-[#1e5152]">
          متابعة المراجعة
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </aside>
    </div>
  );
}

/* ═══════════════════════════════════════
   ORDERS VIEW — Review & Submit
═══════════════════════════════════════ */
function OrdersView({ form, setForm, cartRows, selectedRooms, suggestedItems, setQty, submitting, onSubmit, goHome, goRooms, onOpenSuggested }: {
  form: { trainerName: string; courseName: string; startDate: string; endDate: string; traineeCount: string };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  cartRows: { item: StoreItem; quantity: number }[];
  selectedRooms: { selection: RoomSelection; room: TrainingRoom }[];
  suggestedItems: SuggestedItem[];
  setQty: (id: string, qty: number) => void;
  submitting: boolean; onSubmit: (e: React.FormEvent) => void;
  goHome: () => void; goRooms: () => void; onOpenSuggested: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Course info — TOP, prominent */}
      <section className="rounded-[14px] border border-[#DADBD9] bg-white p-4">
        <h2 className="mb-3 text-[16px] font-extrabold text-[#2A6364]">بيانات الدورة التدريبية</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="اسم المدرب *" value={form.trainerName} onChange={(v) => setForm((p) => ({ ...p, trainerName: v }))} required className="xl:col-span-2" />
          <Field label="اسم الدورة *" value={form.courseName} onChange={(v) => setForm((p) => ({ ...p, courseName: v }))} required className="xl:col-span-2" />
          <Field label="عدد المتدربين" type="number" value={form.traineeCount} required={false} onChange={(v) => setForm((p) => ({ ...p, traineeCount: v }))} />
          <Field label="تاريخ البداية *" type="date" value={form.startDate} onChange={(v) => setForm((p) => ({ ...p, startDate: v }))} />
          <Field label="تاريخ النهاية *" type="date" value={form.endDate} onChange={(v) => setForm((p) => ({ ...p, endDate: v }))} />
          {/* Rooms quick summary */}
          <div className="xl:col-span-3">
            <div className="text-[11px] font-semibold text-[#B5BDBE] mb-1">القاعات</div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedRooms.length ? selectedRooms.map(({ room, selection }) => (
                <span key={room.id} className="rounded-full border border-[#DADBD9] bg-[#F9F9F9] px-2.5 py-1 text-[11px] text-[#2A2A2A]">
                  {room.name} · {selection.startDate || '؟'} → {selection.endDate || '؟'}
                </span>
              )) : (
                <button type="button" onClick={goRooms} className="text-[12px] text-[#2A6364] underline">اختر قاعة</button>
              )}
              {selectedRooms.length > 0 && <button type="button" onClick={goRooms} className="text-[11px] text-[#2A6364] underline">تعديل</button>}
            </div>
          </div>
        </div>
      </section>

      {/* Materials list + submit */}
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        {/* Materials */}
        <section className="rounded-[14px] border border-[#DADBD9] bg-white">
          <div className="flex items-center justify-between border-b border-[#DADBD9] px-4 py-3">
            <h2 className="text-[15px] font-extrabold text-[#2A2A2A]">المواد المطلوبة <span className="mr-1 text-[13px] font-normal text-[#B5BDBE]">({cartRows.length} صنف)</span></h2>
            <button type="button" onClick={goHome} className="text-[12px] font-semibold text-[#2A6364] hover:underline">+ إضافة مواد</button>
          </div>
          {cartRows.length ? (
            <div className="divide-y divide-[#F9F9F9]">
              {cartRows.map(({ item, quantity }) => {
                const free = Math.max(item.stockQty - item.temporarilyReservedQty, 0);
                return (
                  <div key={item.id} className="grid grid-cols-[52px_1fr_auto] items-center gap-3 px-4 py-3">
                    <div className="flex h-13 w-13 items-center justify-center overflow-hidden rounded-[8px] bg-[#F9F9F9]">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <CategoryIllustration category={item.category} size={32} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[#2A2A2A] truncate">{item.title}</div>
                      <div className="text-[11px] text-[#B5BDBE]">{item.category} · {item.isOnDemand ? 'عند الطلب' : `متاح: ${free}`}</div>
                      <button type="button" onClick={() => setQty(item.id, 0)} className="text-[11px] text-[#73384B] hover:underline">حذف</button>
                    </div>
                    <QuantityControl value={quantity} onMinus={() => setQty(item.id, quantity - 1)} onPlus={() => setQty(item.id, quantity + 1)} onChange={(v) => setQty(item.id, v)} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-14">
              <CategoryIllustration category="" size={48} />
              <p className="text-[13px] text-[#B5BDBE]">لا توجد مواد بعد</p>
              <button type="button" onClick={goHome} className="rounded-[8px] bg-[#2A6364] px-4 py-2 text-[12px] font-bold text-white">تصفح المواد</button>
            </div>
          )}

          {/* Suggested items summary */}
          {suggestedItems.length > 0 && (
            <div className="border-t border-[#DADBD9] px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[12px] font-bold text-[#6B5A4A]">مواد مقترحة ({suggestedItems.length})</span>
                <button type="button" onClick={onOpenSuggested} className="text-[11px] text-[#2A6364] underline">تعديل</button>
              </div>
              {suggestedItems.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-[12px] text-[#5A5A5A]">
                  <span>{s.title}</span>
                  <span className="font-bold text-[#6B5A4A]">×{s.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Submit panel */}
        <aside className="rounded-[14px] border border-[#DADBD9] bg-white p-4 xl:sticky xl:top-20 xl:self-start">
          <h3 className="text-[15px] font-extrabold text-[#2A2A2A]">ملخص الطلب</h3>
          <div className="mt-3 space-y-2">
            <SummaryRow label="عدد الأصناف" value={`${cartRows.length} صنف`} />
            <SummaryRow label="إجمالي الوحدات" value={`${cartRows.reduce((s, r) => s + r.quantity, 0)}`} />
            {suggestedItems.length > 0 && <SummaryRow label="مواد مقترحة" value={`${suggestedItems.length}`} />}
            {selectedRooms.length > 0 && <SummaryRow label="القاعات" value={`${selectedRooms.length}`} />}
          </div>
          <div className="my-4 border-t border-[#DADBD9]" />
          <div className="text-[11px] leading-5 text-[#B5BDBE]">
            تاريخ النهاية يُستخدم كموعد إرجاع متوقع للمواد المسترجعة.
          </div>
          <button type="submit" disabled={submitting || (cartRows.length === 0 && suggestedItems.length === 0)}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#2A6364] text-[14px] font-extrabold text-white shadow-[0_4px_14px_rgba(42,99,100,0.3)] hover:bg-[#1e5152] disabled:opacity-40">
            {submitting ? (
              <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> جاري الإرسال...</>
            ) : (
              <>إرسال الطلب <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg></>
            )}
          </button>
        </aside>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════
   SUCCESS VIEW
═══════════════════════════════════════ */
function SuccessView({ order, onReset }: { order: SubmittedOrder; onReset: () => void }) {
  const [copied, setCopied] = useState(false);

  const lmsText = [
    `طلب تجهيز دورة تدريبية`, `رقم الطلب: ${order.code}`, `─────────────────────`,
    `المدرب: ${order.trainerName}`, `الدورة: ${order.courseName}`,
    `التاريخ: ${order.startDate} إلى ${order.endDate}`,
    order.traineeCount > 0 ? `عدد المتدربين: ${order.traineeCount}` : '',
    ``, `المواد المطلوبة:`,
    ...order.items.map((i) => `• ${i.title}  ×${i.quantity} ${i.unit}`),
    ...(order.suggestedItems?.length ? [``, `مواد مقترحة:`, ...order.suggestedItems.map((s) => `◇ ${s.title} ×${s.quantity}${s.note ? ` — ${s.note}` : ''}`)] : []),
    ...(order.rooms.length ? [``, `القاعات:`, ...order.rooms.map((r) => `• ${r.name} — ${r.startDate} → ${r.endDate}`)] : []),
    ``, `تاريخ الإرسال: ${order.submittedAt}`,
    `─────────────────────`, `مساعد تجهيز الدورة — وكالة التدريب، جامعة نايف العربية للعلوم الأمنية`,
  ].filter(Boolean).join('\n');

  return (
    <div className="mx-auto max-w-[680px]">
      {/* Success header */}
      <div className="no-print mb-5 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#eef5f4]">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-[#4F8F7A]" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h2 className="text-[22px] font-extrabold text-[#2A2A2A]">تم إرسال الطلب بنجاح</h2>
        <p className="mt-1 text-[13px] text-[#B5BDBE]">سيراجع المنسق احتياجاتك ويتواصل معك</p>
      </div>

      {/* Summary card */}
      <div className="rounded-[18px] border border-[#DADBD9] bg-white overflow-hidden">
        {/* Code bar */}
        <div className="flex items-center justify-between bg-[#2A6364] px-5 py-4">
          <div><div className="text-[10px] font-semibold text-white/60">رقم الطلب</div><div className="mt-0.5 text-[20px] font-extrabold tracking-wider text-white">{order.code}</div></div>
          <div className="text-right"><div className="text-[10px] text-white/60">تاريخ الإرسال</div><div className="mt-0.5 text-[12px] font-semibold text-white">{order.submittedAt}</div></div>
        </div>

        <div className="p-5 space-y-4">
          {/* Info grid */}
          <div className="grid gap-2 sm:grid-cols-2">
            {[['المدرب', order.trainerName], ['الدورة', order.courseName], ['الفترة', `${order.startDate} — ${order.endDate}`], ...(order.traineeCount > 0 ? [['المتدربون', `${order.traineeCount} متدرب`]] : [])].map(([l, v]) => (
              <div key={String(l)} className="rounded-[10px] border border-[#DADBD9] bg-[#F9F9F9] px-3 py-2">
                <div className="text-[10px] text-[#B5BDBE]">{l}</div>
                <div className="mt-0.5 text-[13px] font-bold text-[#2A2A2A]">{v}</div>
              </div>
            ))}
          </div>

          {/* Materials table */}
          <div>
            <h3 className="mb-2 text-[13px] font-extrabold text-[#2A2A2A]">المواد المطلوبة</h3>
            <div className="overflow-hidden rounded-[10px] border border-[#DADBD9]">
              <table className="w-full text-[12px]">
                <thead><tr className="bg-[#F9F9F9] text-[#5A5A5A]"><th className="px-3 py-2 text-right font-bold">المادة</th><th className="px-3 py-2 text-center font-bold">الكمية</th><th className="px-3 py-2 text-right font-bold">الوحدة</th></tr></thead>
                <tbody className="divide-y divide-[#F9F9F9]">
                  {order.items.map((item, i) => (
                    <tr key={i}><td className="px-3 py-2 font-medium text-[#2A2A2A]">{item.title}</td><td className="px-3 py-2 text-center font-bold text-[#2A6364]">{item.quantity}</td><td className="px-3 py-2 text-[#B5BDBE]">{item.unit}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Suggested items */}
          {order.suggestedItems?.length > 0 && (
            <div>
              <h3 className="mb-2 text-[13px] font-extrabold text-[#6B5A4A]">مواد مقترحة</h3>
              {order.suggestedItems.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-[8px] border border-[#DADBD9] bg-[#fdf8f0] px-3 py-2 text-[12px] mb-1">
                  <span className="font-medium text-[#6B5A4A]">{s.title}{s.note ? ` — ${s.note}` : ''}</span>
                  <span className="font-bold text-[#C7B08C]">×{s.quantity}</span>
                </div>
              ))}
            </div>
          )}

          {/* Rooms */}
          {order.rooms.length > 0 && (
            <div>
              <h3 className="mb-2 text-[13px] font-extrabold text-[#2A2A2A]">القاعات</h3>
              {order.rooms.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-[8px] border border-[#DADBD9] bg-[#F9F9F9] px-3 py-2 text-[12px] mb-1">
                  <span className="font-bold text-[#2A2A2A] flex-1">{r.name}</span>
                  <span className="text-[#B5BDBE]">{r.startDate} → {r.endDate}</span>
                </div>
              ))}
            </div>
          )}

          {/* LMS note */}
          <div className="no-print rounded-[10px] border border-[#C7B08C]/30 bg-[#fdf8f0] px-4 py-3">
            <p className="text-[11px] font-bold text-[#6B5A4A]">نقل إلى منصة التدريب LMS</p>
            <p className="mt-0.5 text-[10px] leading-4 text-[#B5BDBE]">انسخ الملخص والصقه في خانة الملاحظات أو العرض الفني للدورة في منصة التدريب.</p>
          </div>
        </div>

        <div className="border-t border-[#DADBD9] bg-[#F9F9F9] px-5 py-2.5 text-center text-[10px] text-[#B5BDBE]">
          وكالة التدريب — جامعة نايف العربية للعلوم الأمنية
        </div>
      </div>

      {/* Actions */}
      <div className="no-print mt-4 flex flex-wrap gap-2">
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#DADBD9] bg-white px-4 py-2.5 text-[12px] font-bold text-[#5A5A5A] hover:border-[#2A6364]/30 hover:text-[#2A6364]">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
          طباعة
        </button>
        <button onClick={() => { navigator.clipboard.writeText(lmsText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }); }}
          className={`inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12px] font-bold text-white transition ${copied ? 'bg-[#4F8F7A]' : 'bg-[#2A6364] hover:bg-[#1e5152]'}`}>
          {copied ? '✓ تم النسخ' : 'نسخ للـ LMS'}
        </button>
        <button onClick={onReset} className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#DADBD9] bg-white px-4 py-2.5 text-[12px] font-bold text-[#5A5A5A] hover:border-[#2A6364]/30">
          طلب جديد
        </button>
      </div>
    </div>
  );
}

/* ─── Shared primitives ─── */
function NavBtn({ active, onClick, badge, children }: { active: boolean; onClick: () => void; badge?: number; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`relative rounded-[8px] border px-3 py-2 text-[12px] font-semibold transition ${active ? 'border-[#2A6364] bg-[#2A6364] text-white' : 'border-[#DADBD9] bg-white text-[#5A5A5A] hover:border-[#2A6364]/30 hover:text-[#2A6364]'}`}>
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#C7B08C] text-[9px] font-extrabold text-white">{badge}</span>
      )}
    </button>
  );
}

function QuantityControl({ value, onMinus, onPlus, onChange }: { value: number; onMinus: () => void; onPlus: () => void; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex h-8 items-center overflow-hidden rounded-full border border-[#DADBD9] bg-white">
      <button type="button" onClick={onPlus} className="flex h-full w-8 items-center justify-center text-[18px] text-[#2A6364] hover:bg-[#eef5f4]">+</button>
      <input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-full w-10 border-x border-[#DADBD9] text-center text-[13px] font-bold outline-none" />
      <button type="button" onClick={onMinus} className="flex h-full w-8 items-center justify-center text-[18px] text-[#2A6364] hover:bg-[#eef5f4]">−</button>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = true, className = '' }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold text-[#5A5A5A]">{label}</span>
      <input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-[8px] border border-[#DADBD9] bg-[#F9F9F9] px-3 text-[13px] outline-none transition focus:border-[#2A6364]/50 focus:bg-white" />
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-[#B5BDBE]">{label}</span>
      <span className="font-bold text-[#2A2A2A]">{value}</span>
    </div>
  );
}
