'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

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
type SubmittedOrder = {
  code: string; trainerName: string; courseName: string;
  startDate: string; endDate: string; traineeCount: number;
  items: { title: string; quantity: number; unit: string; category: string }[];
  rooms: { name: string; type: string; startDate: string; endDate: string }[];
  submittedAt: string;
};

/* ─── Category SVG illustrations ─── */
function CategoryIllustration({ category, className = 'h-16 w-16' }: { category: string; className?: string }) {
  const c = category || '';
  // Pen / stationery
  if (/قلم|أقلام|قرطاسية/.test(c)) return (
    <svg viewBox="0 0 80 80" className={className} fill="none">
      <rect width="80" height="80" rx="20" fill="#eef5f4" />
      <path d="M52 20l8 8L32 56H24v-8L52 20z" stroke="#2A6364" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M45 27l8 8" stroke="#2A6364" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 48l4 4" stroke="#2A6364" strokeWidth="2" strokeLinecap="round" />
      <rect x="22" y="60" width="36" height="4" rx="2" fill="#d0b284" opacity=".6" />
    </svg>
  );
  // Notebook / notepad
  if (/نوت|دفتر|كتاب|مذكرة/.test(c)) return (
    <svg viewBox="0 0 80 80" className={className} fill="none">
      <rect width="80" height="80" rx="20" fill="#eef5f4" />
      <rect x="22" y="14" width="36" height="52" rx="4" fill="#fff" stroke="#2A6364" strokeWidth="2" />
      <rect x="16" y="20" width="8" height="40" rx="2" fill="#d0b284" opacity=".5" />
      <path d="M30 28h20M30 36h20M30 44h14" stroke="#2A6364" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="26" r="2" fill="#2A6364" opacity=".4" />
      <circle cx="20" cy="34" r="2" fill="#2A6364" opacity=".4" />
      <circle cx="20" cy="42" r="2" fill="#2A6364" opacity=".4" />
    </svg>
  );
  // Folder / files
  if (/ملف|فولدر|مجلد|حافظة/.test(c)) return (
    <svg viewBox="0 0 80 80" className={className} fill="none">
      <rect width="80" height="80" rx="20" fill="#eef5f4" />
      <path d="M14 30a4 4 0 0 1 4-4h16l6 6h22a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V30z" fill="#d0b284" opacity=".35" stroke="#8a6a37" strokeWidth="2" />
      <path d="M14 38h52" stroke="#8a6a37" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M26 50h28M26 44h18" stroke="#8a6a37" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  // Certificate / badge
  if (/شهادة|شهادات|جائزة/.test(c)) return (
    <svg viewBox="0 0 80 80" className={className} fill="none">
      <rect width="80" height="80" rx="20" fill="#eef5f4" />
      <rect x="16" y="16" width="48" height="36" rx="4" fill="#fff" stroke="#2A6364" strokeWidth="2" />
      <path d="M28 28h24M28 36h16" stroke="#2A6364" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="60" r="10" fill="#d0b284" opacity=".6" stroke="#8a6a37" strokeWidth="2" />
      <path d="M36 60l3 3 6-6" stroke="#8a6a37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M38 50v-2M42 50v-2" stroke="#8a6a37" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  // Laptop / tech devices
  if (/لابتوب|حاسب|جهاز|تقني|USB|HDMI|محول|شاحن/.test(c)) return (
    <svg viewBox="0 0 80 80" className={className} fill="none">
      <rect width="80" height="80" rx="20" fill="#e7eff5" />
      <rect x="16" y="20" width="48" height="32" rx="4" fill="#fff" stroke="#1b4f68" strokeWidth="2" />
      <rect x="22" y="26" width="36" height="20" rx="2" fill="#e7eff5" />
      <path d="M10 52h60l-4 8H14l-4-8z" fill="#fff" stroke="#1b4f68" strokeWidth="2" />
      <circle cx="40" cy="56" r="2" fill="#1b4f68" opacity=".4" />
      <path d="M32 36l4 4 8-8" stroke="#1b4f68" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  // Microphone / audio
  if (/ميكروفون|مكبر|صوت/.test(c)) return (
    <svg viewBox="0 0 80 80" className={className} fill="none">
      <rect width="80" height="80" rx="20" fill="#eef5f4" />
      <rect x="32" y="14" width="16" height="28" rx="8" fill="#fff" stroke="#2A6364" strokeWidth="2" />
      <path d="M24 38a16 16 0 0 0 32 0" stroke="#2A6364" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 54v10M32 64h16" stroke="#2A6364" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  // Projector / display
  if (/بروجكتر|شاشة|عرض/.test(c)) return (
    <svg viewBox="0 0 80 80" className={className} fill="none">
      <rect width="80" height="80" rx="20" fill="#eef5f4" />
      <rect x="12" y="26" width="56" height="34" rx="4" fill="#fff" stroke="#2A6364" strokeWidth="2" />
      <rect x="20" y="32" width="40" height="22" rx="2" fill="#eef5f4" />
      <circle cx="58" cy="24" r="6" fill="#2A6364" opacity=".2" stroke="#2A6364" strokeWidth="1.5" />
      <path d="M40 60v8M32 68h16" stroke="#2A6364" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  // Marker / board
  if (/سبورة|لوح|لوحة|ماركر/.test(c)) return (
    <svg viewBox="0 0 80 80" className={className} fill="none">
      <rect width="80" height="80" rx="20" fill="#eef5f4" />
      <rect x="12" y="16" width="56" height="38" rx="4" fill="#fff" stroke="#2A6364" strokeWidth="2" />
      <path d="M24 38l8-12 8 8 6-6 8 10" stroke="#2A6364" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 54l4 10h8l4-10" stroke="#2A6364" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  // On-demand / special order
  if (/عند الطلب|طلب/.test(c)) return (
    <svg viewBox="0 0 80 80" className={className} fill="none">
      <rect width="80" height="80" rx="20" fill="#f7f1e4" />
      <circle cx="40" cy="36" r="16" fill="#fff" stroke="#8a6a37" strokeWidth="2" />
      <path d="M40 26v12l6 6" stroke="#8a6a37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 58h28" stroke="#8a6a37" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
    </svg>
  );
  // Default / general training materials
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none">
      <rect width="80" height="80" rx="20" fill="#eef5f4" />
      <path d="M22 26a4 4 0 0 1 4-4h28l10 10v26a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V26z" fill="#fff" stroke="#2A6364" strokeWidth="2" />
      <path d="M54 22v10h10" stroke="#2A6364" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 36h20M30 44h14M30 52h10" stroke="#2A6364" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Room type illustration ─── */
function RoomIllustration({ type, className = 'h-full w-full' }: { type: string; className?: string }) {
  const bg = /معمل/.test(type) ? '#e7eff5' : /مسرح|كبرى/.test(type) ? '#f4e7eb' : /ورشة/.test(type) ? '#f7f1e4' : '#eef5f4';
  const stroke = /معمل/.test(type) ? '#1b4f68' : /مسرح|كبرى/.test(type) ? '#7c1e3e' : /ورشة/.test(type) ? '#8a6a37' : '#2A6364';
  return (
    <svg viewBox="0 0 320 180" className={className} fill="none" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="180" fill={bg} />
      <rect x="20" y="20" width="280" height="140" rx="8" fill="white" opacity=".5" />
      {/معمل/.test(type) ? (
        <>
          {[0,1,2,3,4].map((i) => [0,1,2,3].map((j) => (
            <rect key={`${i}${j}`} x={36+i*50} y={36+j*32} width="30" height="20" rx="3" fill={stroke} opacity=".15" stroke={stroke} strokeWidth="1" />
          )))}
          <rect x="80" y="148" width="160" height="8" rx="2" fill={stroke} opacity=".2" />
        </>
      ) : /مسرح|كبرى/.test(type) ? (
        <>
          {[0,1,2,3,4,5].map((row) => [0,1,2,3,4,5,6].map((col) => (
            <rect key={`${row}${col}`} x={28+col*40} y={24+row*22} width="30" height="14" rx="3" fill={stroke} opacity=".12" />
          )))}
          <rect x="100" y="152" width="120" height="16" rx="4" fill={stroke} opacity=".25" />
        </>
      ) : /ورشة/.test(type) ? (
        <>
          {[0,1,2,3].map((i) => (
            <g key={i} transform={`translate(${36+i*66}, 50)`}>
              <rect width="50" height="50" rx="25" fill={stroke} opacity=".1" stroke={stroke} strokeWidth="1.5" />
              {[0,1,2,3].map((j) => (
                <rect key={j} x={20+Math.cos(j*Math.PI/2)*16} y={20+Math.sin(j*Math.PI/2)*16} width="10" height="6" rx="2" fill={stroke} opacity=".2" />
              ))}
            </g>
          ))}
        </>
      ) : (
        <>
          {[0,1,2,3,4].map((row) => (
            <g key={row}>
              <rect x="30" y={28+row*26} width="260" height="18" rx="3" fill={stroke} opacity=".08" />
              {[0,1,2,3,4,5,6,7].map((col) => (
                <rect key={col} x={34+col*32} y={30+row*26} width="24" height="14" rx="2" fill={stroke} opacity=".12" />
              ))}
            </g>
          ))}
          <rect x="130" y="158" width="60" height="10" rx="3" fill={stroke} opacity=".25" />
        </>
      )}
    </svg>
  );
}

/* ─── Step indicator ─── */
const STEPS = [
  { key: 'home', label: 'المواد', icon: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </svg>
  )},
  { key: 'rooms', label: 'القاعة', icon: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V7l7-4 7 4v14" /><path d="M9 21v-4h6v4" />
    </svg>
  )},
  { key: 'orders', label: 'المراجعة', icon: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12l2 2 4-4" />
    </svg>
  )},
];

function stepIndex(view: View) {
  if (view === 'home' || view === 'bundles') return 0;
  if (view === 'rooms') return 1;
  if (view === 'orders') return 2;
  return 3;
}

function StepBar({ view }: { view: View }) {
  const current = stepIndex(view);
  if (view === 'success') return null;
  return (
    <div className="flex items-center justify-center gap-0 py-3">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.key} className="flex items-center">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
              active ? 'bg-[#2A6364] text-white shadow-[0_4px_14px_rgba(42,99,100,0.3)]'
              : done ? 'bg-[#eef5f4] text-[#2A6364]'
              : 'bg-[#f4f7f6] text-[#9aacaa]'
            }`}>
              {done ? (
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              ) : step.icon}
              <span>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-1 h-[2px] w-8 rounded-full transition ${i < current ? 'bg-[#2A6364]' : 'bg-[#dce6e3]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main page ─── */
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
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrder | null>(null);
  const [error, setError] = useState('');

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
    loadCatalog()
      .catch(() => mounted && setError('تعذر تحميل المواد'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => { loadRooms().catch(() => undefined); }, [form.startDate, form.endDate, form.traineeCount]);

  useEffect(() => {
    const starts = roomSelections.map((s) => s.startDate).filter(Boolean).sort();
    const ends = roomSelections.map((s) => s.endDate).filter(Boolean).sort();
    if (!starts.length && !ends.length) return;
    const nextStart = starts[0];
    const nextEnd = ends[ends.length - 1] || '';
    setForm((prev) => {
      if (prev.startDate === nextStart && prev.endDate === nextEnd) return prev;
      return { ...prev, startDate: nextStart, endDate: nextEnd };
    });
  }, [roomSelections]);

  const traineeCount = Math.max(0, Number(form.traineeCount || 0));
  const cartRows = useMemo(
    () => Object.entries(cart)
      .map(([id, quantity]) => ({ item: items.find((r) => r.id === id), quantity }))
      .filter((r) => r.item && r.quantity > 0) as { item: StoreItem; quantity: number }[],
    [cart, items]
  );
  const categories = useMemo(() => ['الكل', ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const roomTypes = useMemo(() => ['الكل', ...Array.from(new Set(rooms.map((r) => r.type)))], [rooms]);
  const selectedRooms = useMemo(
    () => roomSelections.map((s) => ({ selection: s, room: rooms.find((r) => r.id === s.roomId) || null }))
      .filter((r) => r.room) as { selection: RoomSelection; room: TrainingRoom }[],
    [rooms, roomSelections]
  );
  const visibleRooms = useMemo(() => rooms.filter((r) => roomType === 'الكل' || r.type === roomType), [rooms, roomType]);
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const catMatch = category === 'الكل' || item.category === category;
      const searchMatch = !needle || item.title.toLowerCase().includes(needle) || item.category.toLowerCase().includes(needle);
      return catMatch && searchMatch;
    });
  }, [items, category, query]);
  const cartCount = cartRows.reduce((s, r) => s + r.quantity, 0);

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
          roomId: roomSelections[0]?.roomId || null,
          requestedLayout: roomSelections[0]?.layout || '',
          roomSelections: roomSelections.map((s) => ({
            ...s,
            startDate: s.startDate || form.startDate,
            endDate: s.endDate || form.endDate || form.startDate,
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'تعذر إرسال الطلبات');
      // Build submitted order summary
      setSubmittedOrder({
        code: json?.data?.code || '',
        trainerName: form.trainerName,
        courseName: form.courseName,
        startDate: form.startDate,
        endDate: form.endDate,
        traineeCount,
        items: cartRows.map((r) => ({ title: r.item.title, quantity: r.quantity, unit: r.item.unit, category: r.item.category })),
        rooms: selectedRooms.map(({ selection, room }) => ({
          name: room.name, type: room.type,
          startDate: selection.startDate || form.startDate,
          endDate: selection.endDate || form.endDate,
        })),
        submittedAt: new Date().toLocaleString('ar-SA'),
      });
      setCart({});
      setRoomSelections([]);
      await loadCatalog();
      await loadRooms();
      setView('success');
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال الطلبات');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[linear-gradient(180deg,#eef4f2_0%,#fafcfb_42%,#eef3f1_100%)] text-[#223738]">
      {/* Print styles */}
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white; } }`}</style>

      {/* Header */}
      <header className="no-print sticky top-0 z-30 border-b border-[#dce6e3] bg-white/92 shadow-[0_4px_20px_rgba(34,55,56,0.07)] backdrop-blur">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-1 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <img src="/nauss-gold-logo.png" alt="جامعة نايف العربية للعلوم الأمنية" className="h-11 w-auto object-contain" />
            <div>
              <div className="text-[14px] font-semibold text-[#223738]">جامعة نايف العربية للعلوم الأمنية</div>
              <div className="text-[11px] text-[#6f7f7d]">وكالة التدريب — مساعد تجهيز الدورة</div>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            {view !== 'success' && (
              <>
                <NavBtn active={view === 'home'} onClick={() => setView('home')} icon={
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
                  </svg>
                }>المواد</NavBtn>
                <NavBtn active={view === 'bundles'} onClick={() => setView('bundles')} icon={
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
                  </svg>
                }>البكجات</NavBtn>
                <NavBtn active={view === 'rooms'} onClick={() => setView('rooms')} icon={
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18M5 21V7l7-4 7 4v14" /><path d="M9 21v-4h6v4" />
                  </svg>
                }>القاعات</NavBtn>
                <NavBtn active={view === 'orders'} onClick={() => setView('orders')} icon={
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                } badge={cartCount > 0 ? cartCount : undefined}>الطلبات</NavBtn>
              </>
            )}
            <Link href="/login" className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#dce6e3] bg-white px-3 py-2 text-[12px] font-semibold text-[#2A6364] transition hover:border-[#2A6364]/40 hover:bg-[#eef5f4]">
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
              </svg>
              تسجيل الدخول
            </Link>
          </nav>
        </div>
        <StepBar view={view} />
      </header>

      <div className={`mx-auto max-w-[1480px] px-4 py-5 ${view !== 'orders' && view !== 'success' && cartCount > 0 ? 'pb-28' : ''}`}>
        {/* Hero banner */}
        {view !== 'success' && (
          <section className="no-print mb-5 overflow-hidden rounded-[20px] border border-[#dce6e3] border-t-[#c8a55e] bg-white shadow-[0_16px_40px_rgba(34,55,56,0.08)]">
            <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#d9c99f] bg-[#fbf6ea] px-3 py-1 text-[12px] font-semibold text-[#6f5a2f]">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" /><path d="M6 12v5c3.5 3 8.5 3 12 0v-5" />
                  </svg>
                  مساعد تجهيز الدورة
                </div>
                <h1 className="mt-2.5 text-[26px] font-extrabold leading-tight text-[#1a3535]">اختيار مستلزمات التدريب</h1>
                <p className="mt-1.5 max-w-[680px] text-[13px] leading-7 text-[#6d7b78]">
                  اختر المواد المطلوبة، حدد القاعة المناسبة، ثم أرسل الاحتياج. يتولى المنسق المراجعة والحجز الذكي تلقائياً.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <StatChip label="مواد متاحة" value={items.length} color="#2A6364" />
                <StatChip label="محجوز مؤقتاً" value={items.reduce((s, i) => s + i.temporarilyReservedQty, 0)} color="#8a6a37" />
                <StatChip label="في طلباتك" value={cartCount} color="#1b4f68" />
              </div>
            </div>
          </section>
        )}

        {error && (
          <div className="no-print mb-4 flex items-start gap-3 rounded-[14px] border border-[#ecd0d8] bg-[#fff7f8] px-4 py-3">
            <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-[#7c1e3e]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
            <p className="text-[13px] text-[#7c1e3e]">{error}</p>
          </div>
        )}

        {view === 'home' && (
          <HomeView loading={loading} items={visibleItems} categories={categories} category={category}
            query={query} cart={cart} setCategory={setCategory} setQuery={setQuery} setQty={setQty} />
        )}
        {view === 'bundles' && (
          <BundlesView bundles={bundles} traineeCount={traineeCount} onAdd={addBundle} />
        )}
        {view === 'rooms' && (
          <RoomsView rooms={visibleRooms} roomTypes={roomTypes} roomType={roomType}
            roomSelections={roomSelections} form={form}
            setRoomType={setRoomType} setRoomSelections={setRoomSelections}
            goOrders={() => setView('orders')} />
        )}
        {view === 'orders' && (
          <OrdersView form={form} setForm={setForm} cartRows={cartRows} selectedRooms={selectedRooms}
            setQty={setQty} submitting={submitting} onSubmit={submitNeed}
            goHome={() => setView('home')} goRooms={() => setView('rooms')} />
        )}
        {view === 'success' && submittedOrder && (
          <SuccessView order={submittedOrder} onReset={() => { setForm({ trainerName: '', courseName: '', startDate: '', endDate: '', traineeCount: '' }); setSubmittedOrder(null); setView('home'); }} />
        )}
      </div>

      <footer className="no-print border-t border-[#dce6e3] bg-white px-4 py-4 text-center text-[12px] text-[#8a9a98]">
        حقوق النشر — إدارة عمليات التدريب، وكالة التدريب 2026
      </footer>

      {view !== 'orders' && view !== 'success' && cartCount > 0 && (
        <CheckoutBar count={cartCount} uniqueCount={cartRows.length} onCheckout={() => setView('rooms')} />
      )}
    </main>
  );
}

/* ─── Home / Materials view ─── */
function HomeView({ loading, items, categories, category, query, cart, setCategory, setQuery, setQty }: {
  loading: boolean; items: StoreItem[]; categories: string[]; category: string; query: string;
  cart: Cart; setCategory: (v: string) => void; setQuery: (v: string) => void; setQty: (id: string, qty: number) => void;
}) {
  return (
    <section className="rounded-[20px] border border-[#dce6e3] bg-white shadow-[0_12px_32px_rgba(34,55,56,0.06)]">
      <div className="flex flex-col gap-3 border-b border-[#edf2f1] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aacaa]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث عن مادة أو فئة..."
            className="h-10 w-full rounded-[10px] border border-[#dce6e3] bg-[#f8fbfb] pr-9 pl-4 text-[13px] outline-none transition placeholder:text-[#9aacaa] focus:border-[#2A6364]/50 focus:bg-white lg:w-[300px]" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button key={cat} type="button" onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-[12px] font-semibold transition ${
                category === cat ? 'border-[#2A6364]/30 bg-[#2A6364] text-white shadow-[0_4px_12px_rgba(42,99,100,0.25)]' : 'border-[#dce6e3] bg-white text-[#4a5e5d] hover:border-[#b8cbc6] hover:bg-[#f4f9f8]'
              }`}>{cat}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#dce6e3] border-t-[#2A6364]" />
          <p className="text-[13px] text-[#6d7b78]">جاري تحميل المواد...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <CategoryIllustration category="" className="h-20 w-20 opacity-60" />
          <p className="text-[14px] text-[#6d7b78]">لا توجد نتائج لهذا البحث</p>
        </div>
      ) : (
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => <MaterialCard key={item.id} item={item} qty={cart[item.id] || 0} setQty={setQty} />)}
        </div>
      )}
    </section>
  );
}

/* ─── Bundles view ─── */
function BundlesView({ bundles, traineeCount, onAdd }: { bundles: Bundle[]; traineeCount: number; onAdd: (b: Bundle) => void }) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {bundles.length === 0 && (
        <div className="col-span-3 rounded-[20px] border border-dashed border-[#dce6e3] bg-white px-8 py-20 text-center text-[13px] text-[#6d7b78]">لا توجد بكجات مقترحة حالياً</div>
      )}
      {bundles.map((bundle) => (
        <article key={bundle.id} className="overflow-hidden rounded-[20px] border border-[#dce6e3] bg-white shadow-[0_12px_32px_rgba(34,55,56,0.06)] transition hover:-translate-y-0.5 hover:border-[#b8cbc6]">
          <ProductImage title={bundle.title} imageUrl={bundle.imageUrl} ratio="aspect-[16/9]" category="" />
          <div className="p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-[18px] font-extrabold text-[#223738]">{bundle.title}</h2>
              <span className="rounded-full bg-[#eef5f4] px-2 py-0.5 text-[11px] font-semibold text-[#2A6364]">{bundle.items.length} مادة</span>
            </div>
            <p className="mt-1 min-h-10 text-[12px] leading-6 text-[#6d7b78]">{bundle.description}</p>
            <div className="mt-3 space-y-1.5">
              {bundle.items.map((item) => (
                <div key={item.catalogItemId} className="flex items-center justify-between rounded-[10px] border border-[#edf2f1] bg-[#f8fbfb] px-3 py-2 text-[12px]">
                  <span className="font-medium text-[#2a4444]">{item.title}</span>
                  <span className="font-bold text-[#2A6364]">
                    {item.quantityMode === 'PER_TRAINEE' ? `${traineeCount || '؟'} × ${item.quantity}` : item.quantity}
                  </span>
                </div>
              ))}
            </div>
            {traineeCount === 0 && bundle.items.some((i) => i.quantityMode === 'PER_TRAINEE') && (
              <p className="mt-2 text-[11px] text-[#8a6a37]">أدخل عدد المتدربين في صفحة المراجعة لحساب الكميات الدقيقة</p>
            )}
            <button type="button" onClick={() => onAdd(bundle)}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#2A6364] text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(42,99,100,0.2)] transition hover:bg-[#1e5152]">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              إضافة البكج للطلبات
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

/* ─── Rooms view ─── */
function RoomsView({ rooms, roomTypes, roomType, roomSelections, form, setRoomType, setRoomSelections, goOrders }: {
  rooms: TrainingRoom[]; roomTypes: string[]; roomType: string; roomSelections: RoomSelection[];
  form: { startDate: string; endDate: string; traineeCount: string };
  setRoomType: (v: string) => void;
  setRoomSelections: React.Dispatch<React.SetStateAction<RoomSelection[]>>;
  goOrders: () => void;
}) {
  const selectedRoomIds = new Set(roomSelections.map((s) => s.roomId));
  const selectionRows = roomSelections.map((s) => ({ selection: s, room: rooms.find((r) => r.id === s.roomId) })).filter((r) => r.room) as { selection: RoomSelection; room: TrainingRoom }[];
  const incomplete = roomSelections.some((s) => !s.startDate || !s.endDate);

  function selectRoom(room: TrainingRoom) {
    if (!room.isAvailable) return;
    setRoomSelections((prev) => {
      const exists = prev.some((s) => s.roomId === room.id);
      if (exists) return prev.filter((s) => s.roomId !== room.id);
      return [...prev, { roomId: room.id, layout: room.layoutOptions[0] || '', startDate: form.startDate, endDate: form.endDate }];
    });
  }

  function updateSelection(roomId: string, patch: Partial<RoomSelection>) {
    setRoomSelections((prev) => prev.map((s) => {
      if (s.roomId !== roomId) return s;
      const next = { ...s, ...patch };
      if (patch.startDate && next.endDate && next.endDate < patch.startDate) next.endDate = '';
      return next;
    }));
  }

  return (
    <section className="relative grid gap-5 xl:block xl:pl-[420px]">
      <div className="rounded-[20px] border border-[#dce6e3] bg-white p-4 shadow-[0_12px_32px_rgba(34,55,56,0.06)]">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[22px] font-extrabold text-[#223738]">القاعات التدريبية</h2>
            <p className="mt-0.5 text-[12px] text-[#6d7b78]">اختر قاعة أو أكثر حسب أيام الدورة</p>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {roomTypes.map((t) => (
              <button key={t} type="button" onClick={() => setRoomType(t)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${roomType === t ? 'border-[#2A6364]/30 bg-[#2A6364] text-white' : 'border-[#dce6e3] bg-white text-[#4a5e5d] hover:bg-[#f4f9f8]'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {incomplete && (
          <div className="mb-4 flex items-start gap-2 rounded-[12px] border border-[#e8ddbf] bg-[#fffbf0] px-4 py-3 text-[12px] leading-6 text-[#7f6b43]">
            <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
            حدد تاريخ البداية والنهاية لكل قاعة مختارة
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const selected = selectedRoomIds.has(room.id);
            return (
              <article key={room.id} className={`overflow-hidden rounded-[18px] border bg-white transition ${selected ? 'border-[#2A6364] ring-2 ring-[#d9e7e3]' : 'border-[#dce6e3] hover:border-[#b8cbc6]'}`}>
                <div className="aspect-[16/9] overflow-hidden bg-[#eef4f2]">
                  {room.imageUrl ? (
                    <img src={room.imageUrl} alt={room.name} className="h-full w-full object-cover" />
                  ) : (
                    <RoomIllustration type={room.type} />
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[16px] font-extrabold text-[#223738]">{room.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#6d7b78]">
                        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        {room.type} — سعة {room.capacity}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${room.isAvailable ? 'bg-[#e8f5ef] text-[#1e6b4c]' : 'bg-[#fff1f3] text-[#7c1e3e]'}`}>
                      {room.isAvailable ? 'متاحة' : 'محجوزة'}
                    </span>
                  </div>
                  {room.equipment.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {room.equipment.slice(0, 3).map((eq) => (
                        <span key={eq} className="rounded-full bg-[#f4f8f7] px-2 py-0.5 text-[10px] text-[#4a5e5d]">{eq}</span>
                      ))}
                      {room.equipment.length > 3 && <span className="rounded-full bg-[#f4f8f7] px-2 py-0.5 text-[10px] text-[#9aacaa]">+{room.equipment.length - 3}</span>}
                    </div>
                  )}
                  {room.layoutOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {room.layoutOptions.slice(0, 2).map((l) => (
                        <span key={l} className="rounded-full border border-[#dce6e3] px-2 py-0.5 text-[10px] text-[#6d7b78]">{l}</span>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => selectRoom(room)} disabled={!room.isAvailable}
                    className={`h-10 w-full rounded-[10px] text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? 'border border-[#2A6364] bg-white text-[#2A6364] hover:bg-[#eef5f4]' : 'bg-[#2A6364] text-white hover:bg-[#1e5152]'}`}>
                    {selected ? '✓ تم اختيار القاعة' : 'اختيار القاعة'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <aside className="rounded-[20px] border border-[#dce6e3] bg-white p-4 shadow-[0_12px_32px_rgba(34,55,56,0.07)] xl:fixed xl:left-[max(1rem,calc((100vw-1480px)/2+1rem))] xl:top-24 xl:z-20 xl:w-[390px]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[17px] font-extrabold text-[#223738]">القاعات المختارة</h3>
          {selectionRows.length > 0 && (
            <button type="button" onClick={() => setRoomSelections([])} className="rounded-[8px] border border-[#ecd0d8] px-2.5 py-1 text-[12px] font-semibold text-[#7c1e3e] hover:bg-[#fff7f8]">مسح الكل</button>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {selectionRows.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-[#dce6e3] bg-[#f8fbfb] px-4 py-8 text-center text-[12px] leading-6 text-[#6d7b78]">
              اختر قاعة من البطاقات وستظهر هنا
            </div>
          ) : selectionRows.map(({ selection, room }) => (
            <div key={room.id} className="rounded-[14px] border border-[#dce6e3] bg-[#f8fbfb] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-bold text-[#223738]">{room.name}</div>
                  <div className="text-[11px] text-[#6d7b78]">{room.type} — سعة {room.capacity}</div>
                </div>
                <button type="button" onClick={() => setRoomSelections((prev) => prev.filter((r) => r.roomId !== room.id))} className="text-[12px] text-[#7c1e3e] hover:underline">حذف</button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <label className="block text-[10px] font-semibold text-[#4a5e5d]">
                  من
                  <input type="date" value={selection.startDate} onChange={(e) => updateSelection(room.id, { startDate: e.target.value })}
                    className="mt-0.5 h-8 w-full rounded-[8px] border border-[#dce6e3] bg-white px-2 text-[11px] outline-none focus:border-[#2A6364]/50" />
                </label>
                <label className="block text-[10px] font-semibold text-[#4a5e5d]">
                  إلى
                  <input type="date" value={selection.endDate} min={selection.startDate || undefined} onChange={(e) => updateSelection(room.id, { endDate: e.target.value })}
                    className="mt-0.5 h-8 w-full rounded-[8px] border border-[#dce6e3] bg-white px-2 text-[11px] outline-none focus:border-[#2A6364]/50" />
                </label>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={goOrders}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#2A6364] text-[14px] font-bold text-white shadow-[0_8px_20px_rgba(42,99,100,0.2)] transition hover:bg-[#1e5152]">
          متابعة ومراجعة الطلب
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </aside>
    </section>
  );
}

/* ─── Orders / Review view ─── */
function OrdersView({ form, setForm, cartRows, selectedRooms, setQty, submitting, onSubmit, goHome, goRooms }: {
  form: { trainerName: string; courseName: string; startDate: string; endDate: string; traineeCount: string };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  cartRows: { item: StoreItem; quantity: number }[];
  selectedRooms: { selection: RoomSelection; room: TrainingRoom }[];
  setQty: (id: string, qty: number) => void;
  submitting: boolean; onSubmit: (e: React.FormEvent) => void;
  goHome: () => void; goRooms: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <section className="rounded-[20px] border border-[#dce6e3] bg-white shadow-[0_12px_32px_rgba(34,55,56,0.06)]">
        <div className="flex items-center justify-between border-b border-[#edf2f1] px-5 py-4">
          <h2 className="text-[20px] font-extrabold text-[#223738]">المواد المطلوبة</h2>
          <button type="button" onClick={goHome}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#dce6e3] px-3 py-2 text-[12px] font-semibold text-[#2A6364] hover:bg-[#eef5f4]">
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            إضافة مواد
          </button>
        </div>
        {cartRows.length ? (
          <div className="divide-y divide-[#f0f4f3]">
            {cartRows.map(({ item, quantity }) => (
              <div key={item.id} className="grid gap-4 px-5 py-4 sm:grid-cols-[80px_1fr_auto] sm:items-center">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[12px] bg-[#f4f8f7]">
                  <CategoryIllustration category={item.category} className="h-12 w-12" />
                </div>
                <div>
                  <div className="text-[16px] font-extrabold text-[#223738]">{item.title}</div>
                  <div className="mt-0.5 text-[12px] text-[#6d7b78]">{item.category}</div>
                  <StockLine item={item} />
                  <button type="button" onClick={() => setQty(item.id, 0)} className="mt-2 text-[12px] text-[#7c1e3e] hover:underline">حذف</button>
                </div>
                <QuantityControl value={quantity} onMinus={() => setQty(item.id, quantity - 1)} onPlus={() => setQty(item.id, quantity + 1)} onChange={(v) => setQty(item.id, v)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-20">
            <CategoryIllustration category="" className="h-20 w-20 opacity-50" />
            <p className="text-[13px] text-[#6d7b78]">لا توجد مواد في الطلب حتى الآن</p>
            <button type="button" onClick={goHome} className="rounded-[10px] bg-[#2A6364] px-4 py-2 text-[13px] font-bold text-white">تصفح المواد</button>
          </div>
        )}
      </section>

      <aside className="rounded-[20px] border border-[#dce6e3] bg-white p-5 shadow-[0_12px_32px_rgba(34,55,56,0.07)] xl:sticky xl:top-24 xl:self-start">
        <h3 className="text-[18px] font-extrabold text-[#223738]">بيانات الدورة</h3>
        <div className="mt-4 space-y-3">
          <FormField label="اسم المدرب" value={form.trainerName} onChange={(v) => setForm((p) => ({ ...p, trainerName: v }))} />
          <FormField label="اسم الدورة" value={form.courseName} onChange={(v) => setForm((p) => ({ ...p, courseName: v }))} />
          <div className="grid grid-cols-2 gap-2">
            <FormField label="تاريخ البداية" type="date" value={form.startDate} onChange={(v) => setForm((p) => ({ ...p, startDate: v }))} />
            <FormField label="تاريخ النهاية" type="date" value={form.endDate} onChange={(v) => setForm((p) => ({ ...p, endDate: v }))} />
          </div>
          <FormField label="عدد المتدربين" type="number" value={form.traineeCount} required={false} onChange={(v) => setForm((p) => ({ ...p, traineeCount: v }))} />
        </div>

        <div className="mt-4 rounded-[12px] border border-[#dce6e3] bg-[#f8fbfb] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-bold text-[#223738]">القاعات المطلوبة</div>
            <button type="button" onClick={goRooms} className="text-[11px] font-semibold text-[#2A6364] hover:underline">
              {selectedRooms.length ? 'تعديل' : 'اختيار قاعة'}
            </button>
          </div>
          {selectedRooms.length ? (
            <div className="mt-2 space-y-1">
              {selectedRooms.map(({ selection, room }) => (
                <div key={room.id} className="flex items-center gap-2 text-[12px] text-[#4a5e5d]">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0 text-[#2A6364]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18M5 21V7l7-4 7 4v14" /><path d="M9 21v-4h6v4" />
                  </svg>
                  <span>{room.name} — {selection.startDate || '؟'} إلى {selection.endDate || '؟'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-[#9aacaa]">لم يتم اختيار قاعة بعد</p>
          )}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-[#e8ddbf] bg-[#fffbf0] px-3 py-2.5 text-[11px] leading-5 text-[#7f6b43]">
          <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-3.5 w-3.5 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
          تاريخ النهاية يُستخدم كموعد إرجاع متوقع للمواد المسترجعة
        </div>

        <button type="submit" disabled={submitting || cartRows.length === 0}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#2A6364] text-[15px] font-extrabold text-white shadow-[0_10px_24px_rgba(42,99,100,0.25)] transition hover:bg-[#1e5152] disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? (
            <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> جاري الإرسال...</>
          ) : (
            <><svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg> إرسال الطلب</>
          )}
        </button>
      </aside>
    </form>
  );
}

/* ─── Success / Summary view ─── */
function SuccessView({ order, onReset }: { order: SubmittedOrder; onReset: () => void }) {
  const [copied, setCopied] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const lmsText = [
    `طلب تجهيز دورة تدريبية`,
    `رقم الطلب: ${order.code}`,
    `─────────────────────`,
    `المدرب: ${order.trainerName}`,
    `الدورة: ${order.courseName}`,
    `التاريخ: ${order.startDate} إلى ${order.endDate}`,
    order.traineeCount > 0 ? `عدد المتدربين: ${order.traineeCount}` : '',
    ``,
    `المواد المطلوبة:`,
    ...order.items.map((i) => `• ${i.title}  ×${i.quantity} ${i.unit}`),
    order.rooms.length > 0 ? `` : '',
    order.rooms.length > 0 ? `القاعات المطلوبة:` : '',
    ...order.rooms.map((r) => `• ${r.name} (${r.type}) — ${r.startDate} إلى ${r.endDate}`),
    ``,
    `تاريخ الإرسال: ${order.submittedAt}`,
    `─────────────────────`,
    `تم الإرسال عبر مساعد تجهيز الدورة — وكالة التدريب، جامعة نايف العربية للعلوم الأمنية`,
  ].filter((l) => l !== undefined).join('\n');

  function copyToClipboard() {
    navigator.clipboard.writeText(lmsText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function printSummary() {
    window.print();
  }

  return (
    <div className="mx-auto max-w-[720px]">
      {/* Success header */}
      <div className="no-print mb-5 flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef5f4] shadow-[0_0_0_8px_rgba(42,99,100,0.08)]">
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-[#2A6364]" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div>
          <h2 className="text-[24px] font-extrabold text-[#223738]">تم إرسال الطلب بنجاح</h2>
          <p className="mt-1 text-[13px] text-[#6d7b78]">سيتولى المنسق مراجعة احتياجاتك والتواصل معك</p>
        </div>
      </div>

      {/* Summary card — printed too */}
      <div ref={summaryRef} className="rounded-[20px] border border-[#dce6e3] bg-white shadow-[0_12px_32px_rgba(34,55,56,0.08)]">
        {/* Code bar */}
        <div className="flex items-center justify-between rounded-t-[20px] bg-[#2A6364] px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold text-white/70">رقم الطلب</div>
            <div className="mt-0.5 text-[22px] font-extrabold tracking-wide text-white">{order.code}</div>
          </div>
          <div className="text-left text-right">
            <div className="text-[11px] text-white/70">تاريخ الإرسال</div>
            <div className="mt-0.5 text-[13px] font-semibold text-white">{order.submittedAt}</div>
          </div>
        </div>

        <div className="p-5">
          {/* Course info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={<svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" /><path d="M6 12v5c3.5 3 8.5 3 12 0v-5" /></svg>} label="المدرب" value={order.trainerName} />
            <InfoRow icon={<svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" /><path d="M14 2v6h6" /></svg>} label="الدورة" value={order.courseName} />
            <InfoRow icon={<svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>} label="الفترة" value={`${order.startDate} — ${order.endDate}`} />
            {order.traineeCount > 0 && (
              <InfoRow icon={<svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>} label="عدد المتدربين" value={`${order.traineeCount} متدرب`} />
            )}
          </div>

          {/* Materials */}
          <div className="mt-5">
            <h3 className="mb-2 text-[14px] font-extrabold text-[#223738]">المواد المطلوبة</h3>
            <div className="overflow-hidden rounded-[14px] border border-[#edf2f1]">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#f4f8f7] text-[12px] text-[#2A6364]">
                    <th className="px-4 py-2.5 text-right font-bold">المادة</th>
                    <th className="px-4 py-2.5 text-right font-bold">الفئة</th>
                    <th className="px-4 py-2.5 text-center font-bold">الكمية</th>
                    <th className="px-4 py-2.5 text-right font-bold">الوحدة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f4f3]">
                  {order.items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5 font-semibold text-[#223738]">{item.title}</td>
                      <td className="px-4 py-2.5 text-[#6d7b78]">{item.category}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-[#2A6364]">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-[#6d7b78]">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rooms */}
          {order.rooms.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-[14px] font-extrabold text-[#223738]">القاعات المطلوبة</h3>
              <div className="space-y-2">
                {order.rooms.map((room, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-[12px] border border-[#dce6e3] bg-[#f8fbfb] px-4 py-2.5">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-[#2A6364]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21h18M5 21V7l7-4 7 4v14" /><path d="M9 21v-4h6v4" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-[#223738]">{room.name}</span>
                      <span className="mx-1 text-[#9aacaa]">—</span>
                      <span className="text-[12px] text-[#6d7b78]">{room.type}</span>
                    </div>
                    <span className="shrink-0 text-[12px] text-[#6d7b78]">{room.startDate} → {room.endDate}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LMS note */}
          <div className="no-print mt-5 rounded-[14px] border border-[#d9c99f] bg-[#fffbf0] px-4 py-3">
            <div className="flex items-start gap-2">
              <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6a37]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
              </svg>
              <div>
                <p className="text-[12px] font-bold text-[#7f6b43]">نقل الطلب إلى منصة التدريب LMS</p>
                <p className="mt-0.5 text-[11px] leading-5 text-[#8a7048]">انسخ ملخص الطلب بزر "نسخ للـ LMS" أدناه والصقه في خانة الملاحظات أو العرض الفني للدورة في منصة التدريب.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer stamp */}
        <div className="rounded-b-[20px] border-t border-[#edf2f1] bg-[#f8fbfb] px-5 py-3 text-[11px] text-[#9aacaa]">
          وكالة التدريب — جامعة نايف العربية للعلوم الأمنية — مساعد تجهيز الدورة
        </div>
      </div>

      {/* Action buttons */}
      <div className="no-print mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={printSummary}
          className="inline-flex items-center gap-2 rounded-[12px] border border-[#dce6e3] bg-white px-5 py-2.5 text-[13px] font-bold text-[#223738] shadow-[0_2px_8px_rgba(34,55,56,0.06)] transition hover:border-[#2A6364]/30 hover:bg-[#eef5f4]">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          طباعة الملخص
        </button>
        <button type="button" onClick={copyToClipboard}
          className={`inline-flex items-center gap-2 rounded-[12px] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(42,99,100,0.25)] transition ${copied ? 'bg-[#1e6b4c]' : 'bg-[#2A6364] hover:bg-[#1e5152]'}`}>
          {copied ? (
            <><svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> تم النسخ!</>
          ) : (
            <><svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg> نسخ للـ LMS</>
          )}
        </button>
        <button type="button" onClick={onReset}
          className="inline-flex items-center gap-2 rounded-[12px] border border-[#dce6e3] bg-white px-5 py-2.5 text-[13px] font-bold text-[#6d7b78] transition hover:border-[#2A6364]/30 hover:text-[#2A6364]">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 9H5V5" /><path d="M5 9C6.8 6.6 9 5.5 12 5.5c4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4" />
          </svg>
          طلب جديد
        </button>
      </div>
    </div>
  );
}

/* ─── Shared sub-components ─── */
function MaterialCard({ item, qty, setQty }: { item: StoreItem; qty: number; setQty: (id: string, qty: number) => void }) {
  return (
    <article className={`overflow-hidden rounded-[18px] border bg-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(34,55,56,0.10)] ${qty > 0 ? 'border-[#2A6364]/40 ring-2 ring-[#d9e7e3]' : 'border-[#dce6e3] hover:border-[#b8cbc6]'}`}>
      <div className="aspect-[4/3] overflow-hidden bg-[#f4f8f7]">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CategoryIllustration category={item.category} className="h-16 w-16" />
          </div>
        )}
      </div>
      <div className="space-y-3 p-3.5">
        <div>
          <div className="text-[14px] font-extrabold text-[#223738] leading-snug">{item.title}</div>
          <div className="mt-0.5 text-[11px] text-[#6d7b78]">{item.category}</div>
        </div>
        <StockLine item={item} />
        {qty > 0 ? (
          <div className="flex items-center justify-between gap-2">
            <QuantityControl value={qty} onMinus={() => setQty(item.id, qty - 1)} onPlus={() => setQty(item.id, qty + 1)} onChange={(v) => setQty(item.id, v)} />
            <span className="rounded-full bg-[#eef5f4] px-2.5 py-1 text-[11px] font-bold text-[#2A6364]">✓ مضاف</span>
          </div>
        ) : (
          <button type="button" onClick={() => setQty(item.id, 1)}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#dce6e3] bg-[#f8fbfb] text-[13px] font-semibold text-[#2A6364] transition hover:border-[#2A6364]/40 hover:bg-[#eef5f4]">
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            إضافة للطلب
          </button>
        )}
      </div>
    </article>
  );
}

function CheckoutBar({ count, uniqueCount, onCheckout }: { count: number; uniqueCount: number; onCheckout: () => void }) {
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-[#dce6e3] bg-white/94 px-4 py-3 shadow-[0_-12px_32px_rgba(34,55,56,0.12)] backdrop-blur">
      <div className="mx-auto flex max-w-[880px] items-center justify-between gap-3 rounded-[14px] border border-[#dce6e3] bg-white p-2 shadow-[0_4px_16px_rgba(34,55,56,0.06)]">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2A6364] text-[13px] font-extrabold text-white">{count}</div>
          <div>
            <div className="text-[13px] font-bold text-[#223738]">{count} مادة محددة</div>
            <div className="text-[11px] text-[#6d7b78]">{uniqueCount} صنف مختلف</div>
          </div>
        </div>
        <button type="button" onClick={onCheckout}
          className="flex h-11 shrink-0 items-center gap-2 rounded-[10px] bg-[#2A6364] px-5 text-[14px] font-bold text-white shadow-[0_6px_18px_rgba(42,99,100,0.25)] transition hover:bg-[#1e5152]">
          اختيار القاعة
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
    </div>
  );
}

function ProductImage({ title, imageUrl, ratio, category }: { title: string; imageUrl?: string | null; ratio: string; category: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [imageUrl]);
  return (
    <div className={`${ratio} overflow-hidden bg-[#f4f8f7]`}>
      {imageUrl && !failed ? (
        <img src={imageUrl} alt={title} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <CategoryIllustration category={category} className="h-16 w-16" />
        </div>
      )}
    </div>
  );
}

function QuantityControl({ value, onMinus, onPlus, onChange }: { value: number; onMinus: () => void; onPlus: () => void; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex h-9 items-center overflow-hidden rounded-full border border-[#dce6e3] bg-white shadow-[0_2px_8px_rgba(34,55,56,0.05)]">
      <button type="button" onClick={onPlus} className="flex h-full w-9 items-center justify-center text-[20px] text-[#2A6364] hover:bg-[#eef5f4]">+</button>
      <input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="h-full w-12 border-x border-[#edf2f1] text-center text-[14px] font-bold outline-none" />
      <button type="button" onClick={onMinus} className="flex h-full w-9 items-center justify-center text-[20px] text-[#2A6364] hover:bg-[#eef5f4]">−</button>
    </div>
  );
}

function StockLine({ item }: { item: StoreItem }) {
  if (item.isOnDemand) return (
    <div className="flex items-start gap-1.5 rounded-[8px] border border-[#e8ddbf] bg-[#fbf6ea] px-2.5 py-1.5 text-[11px] leading-5 text-[#7f6b43]">
      <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-3 w-3 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
      {item.onDemandNote || 'عند الطلب'}
    </div>
  );
  const free = Math.max(item.stockQty - item.temporarilyReservedQty, 0);
  const level = free === 0 ? 'نافد' : free < 5 ? 'منخفض' : 'متاح';
  const color = free === 0 ? '#7c1e3e' : free < 5 ? '#8a6a37' : '#1e6b4c';
  const bg = free === 0 ? '#fff1f3' : free < 5 ? '#fffbf0' : '#eef8f2';
  return (
    <div className="rounded-[8px] border px-2.5 py-1.5 text-[11px]" style={{ borderColor: `${color}30`, backgroundColor: bg }}>
      <div className="flex items-center justify-between">
        <span style={{ color }} className="font-bold">{level}</span>
        <span style={{ color }} className="font-semibold">{free} {item.unit}</span>
      </div>
      {item.temporarilyReservedQty > 0 && <div className="mt-0.5 text-[#9aacaa]">محجوز مؤقتاً: {item.temporarilyReservedQty}</div>}
    </div>
  );
}

function NavBtn({ active, onClick, icon, badge, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; badge?: number; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12px] font-semibold transition ${
        active ? 'border-[#2A6364]/30 bg-[#2A6364] text-white shadow-[0_4px_12px_rgba(42,99,100,0.2)]' : 'border-[#dce6e3] bg-white text-[#4a5e5d] hover:border-[#b8cbc6] hover:bg-[#f4f9f8]'
      }`}>
      {icon}{children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -left-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#d0b284] text-[9px] font-extrabold text-[#1a3535]">{badge}</span>
      )}
    </button>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[12px] border border-[#edf2f1] bg-white px-3 py-2 text-center shadow-[0_2px_8px_rgba(34,55,56,0.04)]">
      <div className="text-[10px] font-semibold text-[#6d7b78]">{label}</div>
      <div className="mt-0.5 text-[20px] font-extrabold" style={{ color }}>{value}</div>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', required = true }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-[#4a5e5d]">{label}{required && <span className="text-[#7c1e3e]"> *</span>}</span>
      <input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-[10px] border border-[#dce6e3] bg-white px-3 text-[13px] outline-none transition focus:border-[#2A6364]/50 focus:shadow-[0_0_0_3px_rgba(42,99,100,0.08)]" />
    </label>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[12px] border border-[#edf2f1] bg-[#f8fbfb] px-3.5 py-2.5">
      <div className="mt-0.5 text-[#2A6364]">{icon}</div>
      <div>
        <div className="text-[10px] font-semibold text-[#9aacaa]">{label}</div>
        <div className="mt-0.5 text-[13px] font-bold text-[#223738]">{value}</div>
      </div>
    </div>
  );
}
