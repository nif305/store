'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';

/* ══════════════════════════════════════
   Performance data type
══════════════════════════════════════ */
type PerformanceData = {
  totalRequests: number; totalUnitsRequested: number; fulfillmentRate: number;
  requestsByStatus: { pending: number; issued: number; returned: number; rejected: number };
  monthlyTrend: { month: string; year: number; count: number }[];
  custody: { active: number; overdue: number; returned: number };
  returns: { pending: number; approved: number; rejected: number };
  trainerNeedsAssigned: number;
};

/* ── Donut chart ── */
function Donut({ segments, size = 120, stroke = 18, label, value }: {
  segments: { color: string; value: number }[]; size?: number; stroke?: number; label: string; value: string | number;
}) {
  const r = (size / 2) - (stroke / 2);
  const c = 2 * Math.PI * r;
  const total = Math.max(segments.reduce((s, seg) => s + seg.value, 0), 1);
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#DADBD9" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * c;
          const el = <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color} strokeWidth={stroke} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} strokeLinecap="round" />;
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[10px] leading-tight text-[#B5BDBE]">{label}</div>
        <div className="text-[18px] font-extrabold text-[#2A2A2A]">{value}</div>
      </div>
    </div>
  );
}

/* ── Bar chart ── */
function BarChart({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-[90px] items-end gap-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="text-[9px] font-bold text-[#2A6364]">{d.count > 0 ? d.count : ''}</div>
          <div className="w-full rounded-t-[4px] bg-[#2A6364] transition-all" style={{ height: `${Math.max((d.count / max) * 60, d.count > 0 ? 4 : 2)}px`, opacity: d.count > 0 ? 1 : 0.2 }} />
          <div className="text-[8px] text-[#B5BDBE] text-center leading-tight">{d.month.slice(0, 3)}</div>
        </div>
      ))}
    </div>
  );
}

/* ── KPI chip ── */
function KpiChip({ label, value, color, bg }: { label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className="flex flex-col items-center rounded-[12px] border px-3 py-2.5 text-center" style={{ backgroundColor: bg, borderColor: `${color}30` }}>
      <div className="text-[22px] font-extrabold" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold" style={{ color: `${color}bb` }}>{label}</div>
    </div>
  );
}

/* ══════════════════════════════════════
   Types
══════════════════════════════════════ */
type InvItem = {
  id: string; code: string; name: string; category: string;
  availableQty: number; unit: string; imageUrl?: string | null;
  type: 'RETURNABLE' | 'CONSUMABLE'; status: string;
};
type CartItem = { item: InvItem; quantity: number; expectedReturnDate: string };
type Metrics = {
  pendingRequests: number; issuedRequests: number;
  activeCustody: number; delayedCustody: number;
  returnRequestsTotal: number;
};

/* ══════════════════════════════════════
   Request Store Modal
══════════════════════════════════════ */
function RequestStoreModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (code: string) => void }) {
  const { language } = useI18n();
  const en = language === 'en';
  const tx = (ar: string, eng: string) => en ? eng : ar;
  const ALL_LABEL = tx('الكل', 'All');

  const [items, setItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState(ALL_LABEL);
  const [query, setQuery] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/inventory?limit=500&requestMode=true', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json()).then((j) => setItems(Array.isArray(j.data) ? j.data : []))
      .catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  // Reset category label when language switches
  useEffect(() => { setCategory(ALL_LABEL); }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => [ALL_LABEL, ...Array.from(new Set(items.map((i) => i.category).filter(Boolean)))], [items, ALL_LABEL]);

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((i) => {
      if (i.status === 'OUT_OF_STOCK' && i.availableQty === 0) return false;
      const catOk = category === ALL_LABEL || i.category === category;
      const sOk = !q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q);
      return catOk && sOk;
    });
  }, [items, category, query, ALL_LABEL]);

  const totalUnits = cart.reduce((s, r) => s + r.quantity, 0);

  function setQty(item: InvItem, qty: number) {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((r) => r.item.id !== item.id);
      const existing = prev.find((r) => r.item.id === item.id);
      if (existing) return prev.map((r) => r.item.id === item.id ? { ...r, quantity: qty } : r);
      return [...prev, { item, quantity: qty, expectedReturnDate: '' }];
    });
  }

  function setDate(itemId: string, date: string) {
    setCart((prev) => prev.map((r) => r.item.id === itemId ? { ...r, expectedReturnDate: date } : r));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!purpose.trim()) { setError(tx('حقل الغرض مطلوب', 'Purpose is required')); return; }
    if (!cart.length) { setError(tx('أضف مادة واحدة على الأقل', 'Add at least one material')); return; }
    const missingDate = cart.find((r) => r.item.type === 'RETURNABLE' && !r.expectedReturnDate);
    if (missingDate) { setError(en ? `Set return date for "${missingDate.item.name}"` : `حدد تاريخ الإرجاع لـ "${missingDate.item.name}"`); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          purpose: purpose.trim(),
          items: cart.map((r) => ({ itemId: r.item.id, quantity: r.quantity, expectedReturnDate: r.expectedReturnDate || null })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || tx('تعذر إرسال الطلب', 'Unable to submit request'));
      onSuccess(json?.data?.code || '');
    } catch (err: any) {
      setError(err?.message || tx('تعذر إرسال الطلب', 'Unable to submit request'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F9F9F9]" dir={en ? 'ltr' : 'rtl'}>
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-[#DADBD9] bg-white px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#2A6364] text-white">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-[#2A2A2A]">{tx('طلب مواد جديد', 'New Material Request')}</div>
            <div className="text-[11px] text-[#B5BDBE]">
              {cart.length > 0
                ? `${cart.length} ${tx('صنف', 'item(s)')} · ${totalUnits} ${tx('وحدة', 'unit(s)')}`
                : tx('اختر المواد المطلوبة', 'Select required materials')}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F9F9F9] text-[#5A5A5A] hover:bg-[#DADBD9]">✕</button>
      </div>

      {error && (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded-[10px] border border-[#73384B]/20 bg-[#fff5f7] px-3 py-2 text-[12px] text-[#73384B]">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          {error}
        </div>
      )}

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: Items grid */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Search + filters */}
          <div className="border-b border-[#DADBD9] bg-white px-4 py-3 space-y-2">
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B5BDBE]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx('بحث عن مادة...', 'Search for a material...')}
                className="h-9 w-full rounded-[8px] border border-[#DADBD9] bg-[#F9F9F9] pr-9 pl-3 text-[13px] outline-none focus:border-[#2A6364]/50 focus:bg-white" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {categories.map((cat) => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${category === cat ? 'border-[#2A6364] bg-[#2A6364] text-white' : 'border-[#DADBD9] bg-white text-[#5A5A5A] hover:border-[#2A6364]/30'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1,2,3,4,5,6,7,8].map((i) => <div key={i} className="h-48 animate-pulse rounded-[12px] bg-[#DADBD9]" />)}
              </div>
            ) : visible.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-[13px] text-[#B5BDBE]">{tx('لا توجد نتائج', 'No results found')}</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((item) => {
                  const inCart = cart.find((r) => r.item.id === item.id);
                  const qty = inCart?.quantity ?? 0;
                  const avail = item.availableQty;
                  return (
                    <article key={item.id}
                      className={`flex flex-col overflow-hidden rounded-[12px] border bg-white transition hover:-translate-y-px ${qty > 0 ? 'border-[#2A6364]/40 ring-1 ring-[#2A6364]/10' : 'border-[#DADBD9]'}`}>
                      {/* Image */}
                      <div className="relative aspect-[4/3] overflow-hidden bg-[#F9F9F9]">
                        {item.imageUrl
                          ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                          : <div className="flex h-full w-full items-center justify-center">
                              <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-[#DADBD9]" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                              </svg>
                            </div>}
                        {/* availability badge */}
                        <span className={`absolute bottom-1.5 right-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold text-white ${avail === 0 ? 'bg-[#73384B]' : avail < 5 ? 'bg-[#6B5A4A]' : 'bg-[#4F8F7A]'}`}>
                          {avail > 0 ? `${avail} ${item.unit}` : tx('نافد', 'Out')}
                        </span>
                        {item.type === 'RETURNABLE' && (
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-[#eef5f4] px-1.5 py-0.5 text-[9px] font-bold text-[#2A6364]">{tx('مسترجعة', 'Returnable')}</span>
                        )}
                        {qty > 0 && (
                          <span className="absolute left-1.5 bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2A6364] text-[10px] font-bold text-white">{qty}</span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <div>
                          <div className="text-[12px] font-bold leading-snug text-[#2A2A2A] line-clamp-2">{item.name}</div>
                          <div className="mt-0.5 text-[10px] text-[#B5BDBE]">{item.category}</div>
                        </div>
                        {qty > 0 ? (
                          <div className="mt-auto flex items-center justify-between gap-2">
                            <div className="inline-flex h-7 items-center overflow-hidden rounded-full border border-[#DADBD9] bg-white">
                              <button onClick={() => setQty(item, qty + 1)} disabled={qty >= avail} className="flex h-full w-7 items-center justify-center text-[16px] text-[#2A6364] disabled:opacity-30 hover:bg-[#eef5f4]">+</button>
                              <span className="w-8 text-center text-[12px] font-bold">{qty}</span>
                              <button onClick={() => setQty(item, qty - 1)} className="flex h-full w-7 items-center justify-center text-[16px] text-[#2A6364] hover:bg-[#eef5f4]">−</button>
                            </div>
                            <button onClick={() => setQty(item, 0)} className="text-[10px] text-[#73384B] hover:underline">حذف</button>
                          </div>
                        ) : (
                          <button disabled={avail === 0} onClick={() => setQty(item, 1)}
                            className="mt-auto flex h-8 items-center justify-center gap-1 rounded-[8px] border border-[#DADBD9] text-[11px] font-semibold text-[#2A6364] transition hover:border-[#2A6364]/40 hover:bg-[#eef5f4] disabled:opacity-40 disabled:cursor-not-allowed">
                            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                            {avail === 0 ? 'نافد' : 'إضافة'}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart + submit */}
        <form onSubmit={submit} className="flex w-[320px] shrink-0 flex-col border-r border-[#DADBD9] bg-white">
          <div className="border-b border-[#DADBD9] px-4 py-3">
            <div className="text-[14px] font-extrabold text-[#2A2A2A]">{tx('المواد المختارة', 'Selected Materials')}</div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-[#DADBD9]" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                <p className="mt-2 text-[12px] text-[#B5BDBE]">{tx('أضف مواد من القائمة', 'Add materials from the list')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((row) => (
                  <div key={row.item.id} className="rounded-[10px] border border-[#DADBD9] bg-[#F9F9F9] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#2A2A2A]">{row.item.name}</div>
                        <div className="text-[10px] text-[#B5BDBE]">{row.quantity} {row.item.unit} {row.item.type === 'RETURNABLE' ? `· ${tx('مسترجعة', 'Returnable')}` : `· ${tx('مستهلكة', 'Consumable')}`}</div>
                      </div>
                      <button type="button" onClick={() => setQty(row.item, 0)} className="text-[10px] text-[#73384B]">✕</button>
                    </div>
                    {row.item.type === 'RETURNABLE' && (
                      <div className="mt-2">
                        <label className="block text-[10px] font-semibold text-[#5A5A5A]">{tx('تاريخ الإرجاع المتوقع *', 'Expected Return Date *')}</label>
                        <input type="date" value={row.expectedReturnDate} onChange={(e) => setDate(row.item.id, e.target.value)}
                          className="mt-0.5 h-7 w-full rounded-[6px] border border-[#DADBD9] px-2 text-[11px] outline-none focus:border-[#2A6364]/50" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#DADBD9] px-4 pb-4 pt-3 space-y-3">
            {cart.length > 0 && (
              <div className="flex items-center justify-between rounded-[8px] bg-[#eef5f4] px-3 py-2 text-[12px]">
                <span className="text-[#2A6364]">{cart.length} {tx('صنف', 'item(s)')}</span>
                <span className="font-bold text-[#2A6364]">{totalUnits} {tx('وحدة', 'unit(s)')}</span>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-[#5A5A5A] mb-1">{tx('الغرض من الطلب *', 'Request Purpose *')}</label>
              <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3}
                placeholder={tx('مثال: تجهيز قاعة تدريب أمن معلومات...', 'e.g., Setting up cybersecurity training room...')}
                className="w-full resize-none rounded-[8px] border border-[#DADBD9] px-3 py-2 text-[12px] outline-none focus:border-[#2A6364]/50" />
            </div>
            <button type="submit" disabled={submitting || cart.length === 0 || !purpose.trim()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#2A6364] text-[14px] font-extrabold text-white shadow-[0_4px_14px_rgba(42,99,100,0.3)] transition hover:bg-[#1e5152] disabled:opacity-40">
              {submitting ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"/> {tx('جاري الإرسال...', 'Submitting...')}</>
              ) : (
                <><svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>{tx('إرسال الطلب', 'Submit Request')}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   Success overlay after submitting
══════════════════════════════════════ */
function RequestSuccess({ code, onClose }: { code: string; onClose: () => void }) {
  const { language } = useI18n();
  const en = language === 'en';
  const tx = (ar: string, eng: string) => en ? eng : ar;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir={en ? 'ltr' : 'rtl'}>
      <div className="w-full max-w-[420px] overflow-hidden rounded-[20px] bg-white shadow-2xl">
        <div className="bg-[#2A6364] px-6 py-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-white" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <div className="text-[11px] font-semibold text-white/70">{tx('رقم الطلب', 'Request Number')}</div>
          <div className="mt-1 text-[22px] font-extrabold tracking-wide text-white">{code}</div>
        </div>
        <div className="p-5 text-center">
          <p className="text-[14px] font-bold text-[#2A2A2A]">{tx('تم إرسال الطلب بنجاح', 'Request submitted successfully')}</p>
          <p className="mt-1 text-[12px] text-[#B5BDBE]">{tx('سيتم مراجعته وصرفه من المستودع', 'It will be reviewed and issued from the warehouse')}</p>
          <div className="mt-4 flex gap-2">
            <a href="/materials/requests" className="flex-1 rounded-[10px] border border-[#DADBD9] py-2.5 text-[13px] font-semibold text-[#2A6364] text-center hover:bg-[#eef5f4]">
              {tx('تتبع الطلب', 'Track Request')}
            </a>
            <button onClick={onClose} className="flex-1 rounded-[10px] bg-[#2A6364] py-2.5 text-[13px] font-bold text-white hover:bg-[#1e5152]">
              {tx('طلب آخر', 'New Request')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   Main Employee Dashboard
══════════════════════════════════════ */
export function EmployeeDashboard({ metrics }: { metrics: Metrics | null }) {
  const { user } = useAuth();
  const { language } = useI18n();
  const en = language === 'en';
  /** Bilingual helper — returns English or Arabic based on current language */
  const tx = (ar: string, eng: string) => en ? eng : ar;

  const [showStore, setShowStore] = useState(false);
  const [successCode, setSuccessCode] = useState('');
  const [perf, setPerf] = useState<PerformanceData | null>(null);
  const [perfLoading, setPerfLoading] = useState(true);

  useEffect(() => {
    fetch('/api/employee/performance', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setPerf(d))
      .catch(() => null)
      .finally(() => setPerfLoading(false));
  }, []);

  const greetHour = new Date().getHours();
  const greeting = en
    ? (greetHour < 12 ? 'Good morning' : greetHour < 17 ? 'Good afternoon' : 'Good evening')
    : (greetHour < 12 ? 'صباح الخير' : greetHour < 17 ? 'مساء الخير' : 'مساء النور');

  const stats = [
    { label: tx('طلبات معلقة', 'Pending Requests'), value: metrics?.pendingRequests ?? 0, color: '#8a6a37', bg: '#f7f1e4', href: '/materials/requests', icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
    )},
    { label: tx('طلبات مصروفة', 'Issued Requests'), value: metrics?.issuedRequests ?? 0, color: '#1e6b4c', bg: '#e8f5ef', href: '/materials/requests', icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
    )},
    { label: tx('عهد نشطة', 'Active Custody'), value: metrics?.activeCustody ?? 0, color: '#2A6364', bg: '#eef5f4', href: '/materials/custody', icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z"/></svg>
    )},
  ];

  const quickActions = [
    { label: tx('المرتجعات', 'Returns'), icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 9H5V5"/><path d="M5 9C6.8 6.6 9 5.5 12 5.5c4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4"/></svg>
    ), href: '/materials/returns', color: '#1b4f68', bg: '#e7eff5' },
    { label: tx('العهد', 'My Custody'), icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z"/><path d="M9 12l2 2 4-4"/></svg>
    ), href: '/materials/custody', color: '#2A6364', bg: '#eef5f4' },
    { label: tx('احتياجات المدربين', 'Trainer Needs'), icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3.5 3 8.5 3 12 0v-5"/></svg>
    ), href: '/materials/trainer-needs', color: '#73384B', bg: '#f4e7eb' },
    { label: tx('مساعد تجهيز الدورة', 'Course Prep Assistant'), icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></svg>
    ), href: '/training-kit', color: '#6B5A4A', bg: '#f7f1e4', external: true },
  ];

  return (
    <div className="space-y-5" dir={en ? 'ltr' : 'rtl'}>
      {/* ── Personal greeting card ── */}
      <section className="overflow-hidden rounded-[20px] bg-gradient-to-l from-[#1a3c3c] to-[#2A6364] p-5 text-white shadow-[0_16px_40px_rgba(42,99,100,0.3)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[12px] text-white/60">{greeting}</div>
            <h1 className="mt-1 text-[24px] font-extrabold">{user?.fullName?.split(' ').slice(0, 2).join(' ') || tx('مرحباً', 'Welcome')}</h1>
            <div className="mt-1 text-[12px] text-white/70">{user?.department || tx('وكالة التدريب', 'Training Deputieship')}</div>
          </div>
          <button
            onClick={() => setShowStore(true)}
            className="inline-flex items-center gap-2 self-start rounded-[14px] bg-white px-5 py-3 text-[14px] font-extrabold text-[#2A6364] shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition hover:bg-[#f0fbf9] sm:self-auto"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            {tx('طلب مواد جديد', 'New Material Request')}
          </button>
        </div>

        {/* Stats row */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <a key={stat.label} href={stat.href}
              className="rounded-[14px] border border-white/10 bg-white/10 px-4 py-3 transition hover:bg-white/15 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-white/70">
                {stat.icon}
                <span className="text-[11px] font-semibold">{stat.label}</span>
              </div>
              <div className="mt-1.5 text-[26px] font-extrabold">{stat.value}</div>
            </a>
          ))}
        </div>
      </section>

      {/* ── Quick actions ── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((action) => (
          <a
            key={action.label}
            href={action.href}
            {...(action.external ? { target: '_blank', rel: 'noopener' } : {})}
            className="group flex items-center gap-3 rounded-[16px] border border-[#DADBD9] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#DADBD9] hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition" style={{ backgroundColor: action.bg, color: action.color }}>
              {action.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-[#2A2A2A]">{action.label}</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-[#DADBD9] transition group-hover:text-[#2A6364]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </a>
        ))}
      </section>

      {/* ── My requests tracker ── */}
      <section className="rounded-[20px] border border-[#DADBD9] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold text-[#2A2A2A]">{tx('متابعة طلباتي', 'My Requests')}</h2>
          <a href="/materials/requests" className="text-[12px] font-semibold text-[#2A6364] hover:underline">{tx('عرض الكل', 'View All')}</a>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: tx('بانتظار الصرف', 'Pending Issuance'), value: metrics?.pendingRequests ?? 0, color: '#8a6a37', bg: '#f7f1e4', border: '#e8ddbf', href: '/materials/requests' },
            { label: tx('مصروفة بيدي', 'Issued to Me'), value: metrics?.issuedRequests ?? 0, color: '#1e6b4c', bg: '#e8f5ef', border: '#cce6d7', href: '/materials/requests' },
            { label: tx('طلبات مرتجعات', 'Return Requests'), value: metrics?.returnRequestsTotal ?? 0, color: '#1b4f68', bg: '#e7eff5', border: '#b8d4e4', href: '/materials/returns' },
          ].map((item) => (
            <a key={item.label} href={item.href}
              className="flex items-center gap-4 rounded-[14px] border px-4 py-4 transition hover:-translate-y-0.5"
              style={{ backgroundColor: item.bg, borderColor: item.border }}>
              <div className="text-[30px] font-extrabold" style={{ color: item.color }}>{item.value}</div>
              <div className="text-[13px] font-semibold" style={{ color: item.color }}>{item.label}</div>
            </a>
          ))}
        </div>
        {(metrics?.delayedCustody ?? 0) > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-[#ecd0d8] bg-[#fff7f8] px-4 py-2.5 text-[12px] text-[#73384B]">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            {tx('لديك', 'You have')} <strong className="mx-1">{metrics?.delayedCustody}</strong> {tx('عهدة متأخرة التسليم', 'overdue custody items')}
            <a href="/materials/custody" className="mr-auto font-bold underline">{tx('عرض', 'View')}</a>
          </div>
        )}
      </section>

      {/* ── Performance Report ── */}
      <section className="rounded-[20px] border border-[#DADBD9] bg-white p-5">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#2A6364]/10">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-[#2A6364]" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18"/><path d="M18 9l-5-5-5 5"/><path d="M18 9v7"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[16px] font-extrabold text-[#2A2A2A]">{tx('تقرير أدائي', 'My Performance')}</h2>
              <div className="text-[11px] text-[#B5BDBE]">{tx('آخر 6 أشهر', 'Last 6 months')}</div>
            </div>
          </div>
          <a href="/materials/requests" className="text-[12px] font-semibold text-[#2A6364] hover:underline">{tx('تفاصيل الطلبات', 'Request Details')}</a>
        </div>

        {perfLoading ? (
          <div className="grid gap-3 sm:grid-cols-4">
            {[1,2,3,4].map((i) => <div key={i} className="h-20 animate-pulse rounded-[14px] bg-[#F0F0F0]" />)}
          </div>
        ) : perf ? (
          <>
            {/* KPI row */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiChip label={tx('إجمالي الطلبات', 'Total Requests')} value={perf.totalRequests} color="#2A6364" bg="#eef5f4" />
              <KpiChip label={tx('نسبة التلبية', 'Fulfillment Rate')} value={`${perf.fulfillmentRate}%`} color={perf.fulfillmentRate >= 80 ? '#1e6b4c' : perf.fulfillmentRate >= 50 ? '#8a6a37' : '#73384B'} bg={perf.fulfillmentRate >= 80 ? '#e8f5ef' : perf.fulfillmentRate >= 50 ? '#f7f1e4' : '#f4e7eb'} />
              <KpiChip label={tx('وحدات مطلوبة', 'Units Requested')} value={perf.totalUnitsRequested} color="#1b4f68" bg="#e7eff5" />
              <KpiChip label={tx('احتياجات مسندة', 'Assigned Needs')} value={perf.trainerNeedsAssigned} color="#73384B" bg="#f4e7eb" />
            </div>

            {/* Charts row */}
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Request status donut */}
              <div className="rounded-[16px] border border-[#DADBD9] bg-[#F9F9F9] p-4">
                <div className="mb-3 text-[13px] font-extrabold text-[#2A2A2A]">{tx('حالة الطلبات', 'Request Status')}</div>
                <div className="flex items-center gap-5">
                  <Donut
                    size={130}
                    stroke={20}
                    label={tx('طلب', 'req')}
                    value={perf.totalRequests}
                    segments={[
                      { color: '#2A6364', value: perf.requestsByStatus.issued },
                      { color: '#4F8F7A', value: perf.requestsByStatus.returned },
                      { color: '#C7B08C', value: perf.requestsByStatus.pending },
                      { color: '#73384B', value: perf.requestsByStatus.rejected },
                    ]}
                  />
                  <div className="flex flex-1 flex-col gap-2">
                    {[
                      { label: tx('مصروفة', 'Issued'), value: perf.requestsByStatus.issued, color: '#2A6364', bg: '#eef5f4' },
                      { label: tx('مرتجعة', 'Returned'), value: perf.requestsByStatus.returned, color: '#4F8F7A', bg: '#edf4f0' },
                      { label: tx('معلقة', 'Pending'), value: perf.requestsByStatus.pending, color: '#8a6a37', bg: '#f7f1e4' },
                      { label: tx('مرفوضة', 'Rejected'), value: perf.requestsByStatus.rejected, color: '#73384B', bg: '#f4e7eb' },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center justify-between rounded-[8px] px-2.5 py-1" style={{ backgroundColor: s.bg }}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                        </div>
                        <span className="text-[13px] font-extrabold" style={{ color: s.color }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Monthly trend bar chart */}
              <div className="rounded-[16px] border border-[#DADBD9] bg-[#F9F9F9] p-4">
                <div className="mb-3 text-[13px] font-extrabold text-[#2A2A2A]">{tx('الطلبات الشهرية', 'Monthly Requests')}</div>
                <BarChart data={perf.monthlyTrend.map((m) => ({ month: m.month, count: m.count }))} />
              </div>
            </div>

            {/* Custody + Returns row */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {/* Custody health */}
              <div className="rounded-[16px] border border-[#DADBD9] bg-[#F9F9F9] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#2A6364]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2 4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z"/>
                  </svg>
                  <span className="text-[13px] font-extrabold text-[#2A2A2A]">{tx('حالة العهدة', 'Custody Status')}</span>
                </div>
                <div className="flex gap-3">
                  {[
                    { label: tx('نشطة', 'Active'), value: perf.custody.active, color: '#2A6364', bg: '#eef5f4' },
                    { label: tx('متأخرة', 'Overdue'), value: perf.custody.overdue, color: '#73384B', bg: '#f4e7eb' },
                    { label: tx('مُعادة', 'Returned'), value: perf.custody.returned, color: '#4F8F7A', bg: '#edf4f0' },
                  ].map((c) => (
                    <div key={c.label} className="flex flex-1 flex-col items-center rounded-[12px] py-3" style={{ backgroundColor: c.bg }}>
                      <div className="text-[22px] font-extrabold" style={{ color: c.color }}>{c.value}</div>
                      <div className="text-[10px] font-semibold" style={{ color: `${c.color}aa` }}>{c.label}</div>
                    </div>
                  ))}
                </div>
                {perf.custody.overdue > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-[8px] border border-[#ecd0d8] bg-[#fff7f8] px-3 py-1.5 text-[11px] text-[#73384B]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                    {perf.custody.overdue} {tx('عهدة تجاوزت تاريخ الإرجاع', 'custody items past return date')}
                    <a href="/materials/custody" className="mr-auto font-bold underline">{tx('عرض', 'View')}</a>
                  </div>
                )}
              </div>

              {/* Returns health */}
              <div className="rounded-[16px] border border-[#DADBD9] bg-[#F9F9F9] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#1b4f68]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 9H5V5"/><path d="M5 9C6.8 6.6 9 5.5 12 5.5c4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4"/>
                  </svg>
                  <span className="text-[13px] font-extrabold text-[#2A2A2A]">{tx('طلبات الإرجاع', 'Return Requests')}</span>
                </div>
                <div className="flex gap-3">
                  {[
                    { label: tx('بانتظار', 'Pending'), value: perf.returns.pending, color: '#8a6a37', bg: '#f7f1e4' },
                    { label: tx('مقبولة', 'Approved'), value: perf.returns.approved, color: '#1e6b4c', bg: '#e8f5ef' },
                    { label: tx('مرفوضة', 'Rejected'), value: perf.returns.rejected, color: '#73384B', bg: '#f4e7eb' },
                  ].map((c) => (
                    <div key={c.label} className="flex flex-1 flex-col items-center rounded-[12px] py-3" style={{ backgroundColor: c.bg }}>
                      <div className="text-[22px] font-extrabold" style={{ color: c.color }}>{c.value}</div>
                      <div className="text-[10px] font-semibold" style={{ color: `${c.color}aa` }}>{c.label}</div>
                    </div>
                  ))}
                </div>
                <a href="/materials/returns"
                  className="mt-2 flex h-8 w-full items-center justify-center gap-1 rounded-[8px] border border-[#DADBD9] text-[11px] font-semibold text-[#1b4f68] transition hover:bg-white">
                  {tx('عرض المرتجعات', 'View Returns')}
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </a>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-32 items-center justify-center text-[13px] text-[#B5BDBE]">{tx('تعذر تحميل بيانات الأداء', 'Unable to load performance data')}</div>
        )}
      </section>

      {/* Modals */}
      {showStore && (
        <RequestStoreModal
          onClose={() => setShowStore(false)}
          onSuccess={(code) => { setShowStore(false); setSuccessCode(code); }}
        />
      )}
      {successCode && (
        <RequestSuccess code={successCode} onClose={() => setSuccessCode('')} />
      )}
    </div>
  );
}
