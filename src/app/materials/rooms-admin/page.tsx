'use client';

import { useEffect, useMemo, useState } from 'react';

/* ─── Types ─── */
type Room = {
  id: string; name: string; type: string;
  capacity: number;     // السعة الأساسية
  maxCapacity?: number | null; // السعة القصوى
  location?: string | null; description?: string | null;
  equipment: string[]; layoutOptions: string[];
  imageUrl?: string | null; isVisible: boolean; internalNotes?: string | null;
  sortOrder?: number;
};

/* ─── Predefined chips ─── */
const LAYOUT_CHIPS = [
  'طاولات دائرية', 'طاولات مدرجة', 'طاولات مستطيلة', 'صفوف تدريبية',
  'شكل حرف U', 'ورش عمل كبيرة', 'ورش عمل تطبيقية', 'معمل حاسب آلي',
  'معمل GIS', 'معمل درونز', 'معمل محاكاة تحقيق', 'معمل VR', 'تدريب تطبيقي',
  'محاكاة', 'نشاط جماعي', 'فضاء مفتوح',
];
const EQUIPMENT_CHIPS = [
  'شاشة عرض', 'شاشة عرض كبيرة', 'بروجكتر', 'سبورة', 'سبورة ذكية',
  'أجهزة حاسب آلي', 'شبكة إنترنت', 'شبكة سريعة', 'شبكة مخصصة',
  'نظام صوتيات', 'ميكروفون لاسلكي', 'تكييف', 'معدات تدريب متخصصة',
  'معدات رياضية', 'أجهزة عالية الأداء', 'معدات تخصصية',
];
const ROOM_TYPES = [
  'قاعة اجتماعات', 'معمل حاسب آلي', 'قاعة تدريبية',
  'مركز خارجي', 'نشاط رياضي', 'قاعة محاكاة', 'قاعة مرنة',
];
const LOCATIONS = [
  'مبنى وكالة التدريب', 'مبنى وكالة التدريب — الطابق الثالث',
  'مبنى وكالة التدريب — الطابق الرابع', 'خارج مبنى وكالة التدريب',
];

/* ─── Category grouping ─── */
function getCategory(room: Room): string {
  if (room.type === 'قاعة اجتماعات') return 'قاعات الاجتماعات';
  if (room.type === 'معمل حاسب آلي') return 'المعامل';
  if (room.type === 'قاعة تدريبية') return 'القاعات التدريبية';
  if (room.location?.includes('خارج') || room.type === 'مركز خارجي' || room.type === 'نشاط رياضي') return 'مراكز خارجية';
  return 'أخرى';
}

const CATEGORY_ORDER = ['القاعات التدريبية', 'المعامل', 'قاعات الاجتماعات', 'مراكز خارجية', 'أخرى'];
const CATEGORY_COLORS: Record<string, string> = {
  'القاعات التدريبية': 'bg-[#eef5f4] text-[#2A6364] border-[#2A6364]/20',
  'المعامل':           'bg-[#e7eff5] text-[#2E6F8E] border-[#2E6F8E]/20',
  'قاعات الاجتماعات': 'bg-[#f7f1e4] text-[#6B5A4A] border-[#6B5A4A]/20',
  'مراكز خارجية':     'bg-[#f4e7eb] text-[#73384B] border-[#73384B]/20',
  'أخرى':             'bg-[#f3f5f5] text-[#5A5A5A] border-[#DADBD9]',
};

/* ─── Chip toggle helper ─── */
function toggleChip(list: string[], item: string) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/* ─── Image helper ─── */
async function fileToDataUrl(file: File): Promise<string> {
  const image = document.createElement('img');
  const reader = new FileReader();
  const loaded = new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
  });
  reader.readAsDataURL(file);
  image.src = await loaded;
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
  const canvas = document.createElement('canvas');
  const maxW = 1200;
  const scale = Math.min(1, maxW / image.width);
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

/* ═══════════════════════════════════════
   BULK IMAGE UPLOAD MODAL FOR ROOMS
═══════════════════════════════════════ */
type BulkRoomMatch = { file: File; dataUrl: string | null; roomId: string | null; confidence: number; converting: boolean };

function nbRoom(text: string) {
  return text.toLowerCase().replace(/\.[^.]+$/, '').replace(/[-_\.]/g, ' ')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ').trim();
}

function scoreRoom(filename: string, room: Room): number {
  const fn = nbRoom(filename); const nm = nbRoom(room.name);
  if (fn === nm) return 100;
  if (nm.includes(fn) || fn.includes(nm)) return 85;
  const fnW = fn.split(' ').filter((w) => w.length > 0);
  const nmW = nm.split(' ').filter((w) => w.length > 0);
  const hits = fnW.filter((w) => nmW.some((nw) => nw === w || nw.startsWith(w) || w.startsWith(nw))).length;
  if (hits > 0) return Math.max(15, Math.round((hits / Math.max(fnW.length, nmW.length)) * 75));
  return 0;
}

function BulkRoomModal({ rooms, onClose, onDone }: { rooms: Room[]; onClose: () => void; onDone: () => void }) {
  const [matches, setMatches] = useState<BulkRoomMatch[]>([]);
  const [step, setStep] = useState<'select' | 'review' | 'saving' | 'done'>('select');
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [search, setSearch] = useState<Record<number, string>>({});

  async function processFiles(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    const init: BulkRoomMatch[] = imgs.map((file) => {
      const ranked = rooms.map((r) => ({ r, s: scoreRoom(file.name, r) })).sort((a, b) => b.s - a.s);
      return { file, dataUrl: null, roomId: ranked[0]?.s >= 20 ? ranked[0].r.id : null, confidence: ranked[0]?.s ?? 0, converting: true };
    });
    setMatches(init); setStep('review');
    for (let i = 0; i < imgs.length; i++) {
      try {
        const dataUrl = await fileToDataUrl(imgs[i]);
        setMatches((p) => p.map((m, idx) => idx === i ? { ...m, dataUrl, converting: false } : m));
      } catch { setMatches((p) => p.map((m, idx) => idx === i ? { ...m, converting: false } : m)); }
    }
  }

  async function saveAll() {
    const toSave = matches.filter((m) => m.roomId && m.dataUrl);
    setProgress({ done: 0, total: toSave.length, errors: 0 }); setStep('saving');
    for (const match of toSave) {
      const room = rooms.find((r) => r.id === match.roomId); if (!room) continue;
      try {
        await fetch('/api/rooms-admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ id: room.id, name: room.name, type: room.type, capacity: room.capacity, imageUrl: match.dataUrl }) });
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      } catch { setProgress((p) => ({ ...p, done: p.done + 1, errors: p.errors + 1 })); }
    }
    onDone(); setStep('done');
  }

  const readyCount = matches.filter((m) => !m.converting && m.roomId).length;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="relative flex max-h-[88vh] w-full max-w-[860px] flex-col rounded-[20px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#DADBD9] px-5 py-4">
          <div>
            <h2 className="text-[17px] font-extrabold text-[#2A2A2A]">رفع صور القاعات دفعياً</h2>
            <p className="mt-0.5 text-[11px] text-[#B5BDBE]">سمّ الصورة باسم القاعة</p>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F9F9F9] text-[#5A5A5A] hover:bg-[#DADBD9]">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === 'select' && (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-[#DADBD9] py-16 hover:border-[#2A6364]/40 hover:bg-[#F9F9F9]">
              <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-[#B5BDBE]" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <p className="mt-3 text-[14px] font-bold text-[#5A5A5A]">اسحب صور القاعات أو اضغط للاختيار</p>
              <p className="mt-1 text-[11px] text-[#B5BDBE]">سمّ كل ملف باسم القاعة</p>
              <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => processFiles(Array.from(e.target.files || []))} />
            </label>
          )}
          {step === 'review' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px] text-[#5A5A5A]">
                <span><span className="font-bold text-[#2A6364]">{matches.length}</span> ملف · <span className="font-bold text-[#4F8F7A]">{readyCount}</span> جاهز</span>
                <button onClick={() => { setMatches([]); setStep('select'); }} className="text-[#2A6364] underline">اختيار مختلف</button>
              </div>
              {matches.map((m, idx) => {
                const matched = rooms.find((r) => r.id === m.roomId);
                const q = (search[idx] || '').toLowerCase();
                const filtered = q ? rooms.filter((r) => r.name.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)) : rooms;
                return (
                  <div key={idx} className={`flex items-center gap-3 rounded-[10px] border p-2.5 ${matched ? 'border-[#cce6d7] bg-[#f8fdfb]' : 'border-[#e8ddbf] bg-[#fffbf0]'}`}>
                    <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-[#F9F9F9]">
                      {m.converting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#DADBD9] border-t-[#2A6364]" /> :
                       m.dataUrl ? <img src={m.dataUrl} alt="" className="h-full w-full object-cover" /> :
                       <span className="text-[9px] text-[#B5BDBE]">—</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="truncate text-[11px] font-bold text-[#2A2A2A]">{m.file.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${m.confidence >= 80 ? 'bg-[#eef8f2] text-[#4F8F7A]' : m.confidence >= 40 ? 'bg-[#fffbf0] text-[#8a6a37]' : 'bg-[#F9F9F9] text-[#B5BDBE]'}`}>
                          {m.confidence > 0 ? `${m.confidence}%` : 'بدون تطابق'}
                        </span>
                      </div>
                      {matched ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-[#4F8F7A]">→ {matched.name}</span>
                          <button onClick={() => setMatches((p) => p.map((mm, i) => i === idx ? { ...mm, roomId: null } : mm))} className="text-[10px] text-[#73384B] underline">تغيير</button>
                        </div>
                      ) : (
                        <div className="mt-1 flex gap-1.5">
                          <input value={search[idx] || ''} onChange={(e) => setSearch((p) => ({ ...p, [idx]: e.target.value }))} placeholder="بحث..." className="h-7 w-24 rounded-[6px] border border-[#DADBD9] px-2 text-[11px] outline-none focus:border-[#2A6364]/40" />
                          <select value="" onChange={(e) => { if (e.target.value) setMatches((p) => p.map((mm, i) => i === idx ? { ...mm, roomId: e.target.value, confidence: 90 } : mm)); }} className="h-7 max-w-[220px] flex-1 rounded-[6px] border border-[#DADBD9] bg-white px-1 text-[11px] outline-none">
                            <option value="">— اختر القاعة —</option>
                            {filtered.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setMatches((p) => p.filter((_, i) => i !== idx))} className="text-[#B5BDBE] hover:text-[#73384B]">✕</button>
                  </div>
                );
              })}
            </div>
          )}
          {(step === 'saving' || step === 'done') && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              {step === 'saving' ? (
                <>
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#DADBD9] border-t-[#2A6364]" />
                  <p className="mt-3 font-bold text-[#2A2A2A]">جاري الحفظ... {progress.done}/{progress.total}</p>
                  <div className="mt-3 h-2 w-64 overflow-hidden rounded-full bg-[#DADBD9]">
                    <div className="h-2 rounded-full bg-[#2A6364] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eef5f4]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-[#2A6364]" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </div>
                  <p className="mt-3 text-[17px] font-extrabold text-[#2A2A2A]">تم حفظ الصور!</p>
                  <p className="mt-1 text-[12px] text-[#B5BDBE]">{progress.done - progress.errors} صورة محفوظة</p>
                </>
              )}
            </div>
          )}
        </div>
        {step === 'review' && (
          <div className="flex items-center justify-between border-t border-[#DADBD9] px-5 py-3">
            <span className="text-[11px] text-[#B5BDBE]">{readyCount} جاهز للحفظ</span>
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-[8px] border border-[#DADBD9] px-4 py-2 text-[12px] font-semibold text-[#5A5A5A] hover:bg-[#F9F9F9]">إلغاء</button>
              <button disabled={readyCount === 0} onClick={saveAll} className="rounded-[8px] bg-[#2A6364] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-40">حفظ {readyCount} صورة</button>
            </div>
          </div>
        )}
        {step === 'done' && <div className="flex justify-center border-t border-[#DADBD9] px-5 py-3"><button onClick={onClose} className="rounded-[8px] bg-[#2A6364] px-5 py-2 text-[13px] font-bold text-white">إغلاق</button></div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════ */
export default function RoomsAdminPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', type: 'قاعة تدريبية', capacity: '20', location: 'مبنى وكالة التدريب' });

  const selected = useMemo(() => rooms.find((r) => r.id === selectedId) || null, [rooms, selectedId]);

  const grouped = useMemo(() => {
    const map = new Map<string, Room[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const room of rooms) {
      const cat = getCategory(room);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(room);
    }
    return Array.from(map.entries()).filter(([, rs]) => rs.length > 0);
  }, [rooms]);

  async function load() {
    setError('');
    const res = await fetch('/api/rooms-admin', { cache: 'no-store', credentials: 'include' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.error || 'تعذر تحميل القاعات'); return; }
    const data: Room[] = Array.isArray(json.rooms) ? json.rooms : [];
    setRooms(data.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)));
  }

  useEffect(() => { load(); }, []);

  async function saveRoom() {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/rooms-admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(selected) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'تعذر حفظ القاعة');
      await load(); setSelectedId(selected.id); showNotice('تم حفظ القاعة ✓');
    } catch (e: any) { setError(e?.message || 'تعذر حفظ القاعة'); }
    finally { setBusy(false); }
  }

  async function deleteRoom(id: string) {
    if (!confirm('حذف هذه القاعة؟ إذا كان لها حجوزات ستُخفى فقط.')) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/rooms-admin?id=${id}`, { method: 'DELETE', credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'تعذر الحذف');
      setSelectedId(''); await load(); showNotice('تم حذف/إخفاء القاعة ✓');
    } catch (e: any) { setError(e?.message || 'تعذر الحذف'); }
    finally { setBusy(false); }
  }

  async function createRoom(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch('/api/rooms-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ ...newRoom, capacity: Number(newRoom.capacity || 20) }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'تعذر الإضافة');
      setNewRoom({ name: '', type: 'قاعة تدريبية', capacity: '20', location: 'مبنى وكالة التدريب' });
      setShowNew(false); await load(); showNotice('تمت إضافة القاعة ✓');
    } catch (e: any) { setError(e?.message || 'تعذر الإضافة'); }
    finally { setBusy(false); }
  }

  async function seedReal() {
    if (!confirm('هذا سيضيف/يحدث القاعات الحقيقية للمبنى. هل تريد المتابعة؟')) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/rooms-admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action: 'seed-real-rooms' }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'تعذر الاستيراد');
      await load(); showNotice(`تم — ${json.created} قاعة جديدة، ${json.updated} محدّثة ✓`);
    } catch (e: any) { setError(e?.message || 'تعذر الاستيراد'); }
    finally { setBusy(false); }
  }

  function updateSelected(patch: Partial<Room>) {
    if (!selected) return;
    setRooms((prev) => prev.map((r) => r.id === selected.id ? { ...r, ...patch } : r));
  }

  function showNotice(msg: string) {
    setNotice(msg); setTimeout(() => setNotice(''), 3500);
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <section className="overflow-hidden rounded-[16px] border border-[#DADBD9] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold text-[#2A2A2A]">إدارة القاعات التدريبية</h1>
            <p className="mt-1 text-[12px] text-[#B5BDBE]">{rooms.length} قاعة — {rooms.filter((r) => r.isVisible).length} ظاهرة للمدربين</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={seedReal} disabled={busy} className="flex items-center gap-1.5 rounded-[10px] border border-[#DADBD9] bg-[#F9F9F9] px-4 py-2.5 text-[12px] font-bold text-[#5A5A5A] hover:border-[#2A6364]/30 hover:text-[#2A6364] disabled:opacity-50">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" /></svg>
              استيراد القاعات الحقيقية
            </button>
            <button onClick={() => setShowBulk(true)} className="flex items-center gap-1.5 rounded-[10px] border border-[#2A6364]/30 bg-[#eef5f4] px-4 py-2.5 text-[12px] font-bold text-[#2A6364]">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
              رفع صور دفعي
            </button>
            <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-1.5 rounded-[10px] bg-[#2A6364] px-4 py-2.5 text-[12px] font-bold text-white hover:bg-[#1e5152]">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              إضافة قاعة
            </button>
          </div>
        </div>
        {(notice || error) && (
          <div className={`mt-3 rounded-[8px] px-4 py-2 text-[12px] font-bold ${error ? 'bg-[#fff1f3] text-[#73384B]' : 'bg-[#eef8f2] text-[#1e6b4c]'}`}>
            {error || notice}
          </div>
        )}
      </section>

      {/* New room form */}
      {showNew && (
        <form onSubmit={createRoom} className="rounded-[16px] border border-[#DADBD9] bg-white p-5">
          <h2 className="mb-3 text-[16px] font-extrabold text-[#2A2A2A]">إضافة قاعة جديدة</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <F label="اسم القاعة *" value={newRoom.name} onChange={(v) => setNewRoom((p) => ({ ...p, name: v }))} />
            <div>
              <span className="mb-1 block text-[11px] font-bold text-[#5A5A5A]">النوع</span>
              <select value={newRoom.type} onChange={(e) => setNewRoom((p) => ({ ...p, type: e.target.value }))} className="h-9 w-full rounded-[8px] border border-[#DADBD9] bg-white px-2 text-[13px] outline-none">
                {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <F label="السعة" type="number" value={newRoom.capacity} onChange={(v) => setNewRoom((p) => ({ ...p, capacity: v }))} />
            <div>
              <span className="mb-1 block text-[11px] font-bold text-[#5A5A5A]">الموقع</span>
              <select value={newRoom.location} onChange={(e) => setNewRoom((p) => ({ ...p, location: e.target.value }))} className="h-9 w-full rounded-[8px] border border-[#DADBD9] bg-white px-2 text-[13px] outline-none">
                {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={busy || !newRoom.name} className="rounded-[8px] bg-[#2A6364] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-40">إضافة</button>
            <button type="button" onClick={() => setShowNew(false)} className="rounded-[8px] border border-[#DADBD9] px-4 py-2 text-[12px] text-[#5A5A5A]">إلغاء</button>
          </div>
        </form>
      )}

      {/* Main grid */}
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        {/* Room list grouped by category */}
        <aside className="rounded-[16px] border border-[#DADBD9] bg-white">
          <div className="border-b border-[#DADBD9] px-4 py-3">
            <div className="text-[13px] font-extrabold text-[#2A2A2A]">القاعات</div>
          </div>
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-3 space-y-3">
            {grouped.map(([cat, catRooms]) => (
              <div key={cat}>
                <div className={`mb-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${CATEGORY_COLORS[cat] || CATEGORY_COLORS['أخرى']}`}>
                  {cat} ({catRooms.length})
                </div>
                <div className="space-y-1">
                  {catRooms.map((room) => (
                    <button key={room.id} onClick={() => setSelectedId(room.id)}
                      className={`flex w-full items-center gap-2.5 rounded-[10px] border p-2.5 text-right transition ${selectedId === room.id ? 'border-[#2A6364]/40 bg-[#eef5f4]' : 'border-transparent hover:border-[#DADBD9] hover:bg-[#F9F9F9]'}`}>
                      <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[#F9F9F9]">
                        {room.imageUrl ? <img src={room.imageUrl} alt={room.name} className="h-full w-full object-cover" /> :
                          <span className="text-[10px] text-[#DADBD9]">صورة</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-bold text-[#2A2A2A]">{room.name}</div>
                        <div className="text-[10px] text-[#B5BDBE]">
                          {room.maxCapacity && room.maxCapacity !== room.capacity
                            ? `${room.capacity}–${room.maxCapacity}`
                            : room.capacity > 0 ? room.capacity : '—'} متدرب
                          {' · '}{room.isVisible ? 'ظاهرة' : 'مخفية'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Editor */}
        {selected ? (
          <section className="rounded-[16px] border border-[#DADBD9] bg-white">
            <div className="flex items-center justify-between border-b border-[#DADBD9] px-5 py-4">
              <h2 className="text-[16px] font-extrabold text-[#2A2A2A]">{selected.name}</h2>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${CATEGORY_COLORS[getCategory(selected)] || CATEGORY_COLORS['أخرى']}`}>{getCategory(selected)}</span>
            </div>
            <div className="p-5 space-y-5">
              {/* Image + basic info */}
              <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                {/* Image */}
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-[12px] border border-[#DADBD9] bg-[#F9F9F9] aspect-[4/3]">
                    {selected.imageUrl
                      ? <img src={selected.imageUrl} alt={selected.name} className="h-full w-full object-cover" />
                      : <div className="flex h-full w-full items-center justify-center text-[12px] text-[#B5BDBE]">لا توجد صورة</div>}
                  </div>
                  <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-[#DADBD9] py-2.5 text-[11px] text-[#5A5A5A] hover:border-[#2A6364]/40 hover:text-[#2A6364]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                    رفع صورة
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) updateSelected({ imageUrl: await fileToDataUrl(f) }); }} />
                  </label>
                  {selected.imageUrl && (
                    <button onClick={() => updateSelected({ imageUrl: null })} className="w-full rounded-[8px] border border-[#DADBD9] py-1.5 text-[11px] text-[#73384B] hover:bg-[#fff1f3]">حذف الصورة</button>
                  )}
                </div>

                {/* Fields */}
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <F label="اسم القاعة" value={selected.name} onChange={(v) => updateSelected({ name: v })} />
                    <div>
                      <span className="mb-1 block text-[11px] font-bold text-[#5A5A5A]">النوع</span>
                      <select value={selected.type} onChange={(e) => updateSelected({ type: e.target.value })} className="h-9 w-full rounded-[8px] border border-[#DADBD9] bg-white px-2 text-[13px] outline-none focus:border-[#2A6364]/40">
                        {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
                        {!ROOM_TYPES.includes(selected.type) && <option>{selected.type}</option>}
                      </select>
                    </div>
                    <F label="السعة الأساسية" type="number" value={String(selected.capacity)} onChange={(v) => updateSelected({ capacity: Number(v || 1) })} />
                    <F label="السعة القصوى" type="number" value={String(selected.maxCapacity ?? selected.capacity)} onChange={(v) => updateSelected({ maxCapacity: Number(v || selected.capacity) })} />
                    <div>
                      <span className="mb-1 block text-[11px] font-bold text-[#5A5A5A]">الموقع</span>
                      <select value={selected.location || ''} onChange={(e) => updateSelected({ location: e.target.value })} className="h-9 w-full rounded-[8px] border border-[#DADBD9] bg-white px-2 text-[13px] outline-none focus:border-[#2A6364]/40">
                        <option value="">— غير محدد —</option>
                        {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                        {selected.location && !LOCATIONS.includes(selected.location) && <option>{selected.location}</option>}
                      </select>
                    </div>
                  </div>
                  {/* Description */}
                  <div>
                    <span className="mb-1 block text-[11px] font-bold text-[#5A5A5A]">وصف القاعة</span>
                    <textarea value={selected.description || ''} onChange={(e) => updateSelected({ description: e.target.value })} rows={2}
                      className="w-full rounded-[8px] border border-[#DADBD9] px-3 py-2 text-[13px] outline-none focus:border-[#2A6364]/40 resize-none"
                      placeholder="وصف مختصر للقاعة وميزاتها..." />
                  </div>
                </div>
              </div>

              {/* Layout options chips */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-[#2A2A2A]">أنماط الترتيب المتاحة</span>
                  <span className="text-[10px] text-[#B5BDBE]">اضغط لإضافة أو إزالة</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {LAYOUT_CHIPS.map((chip) => {
                    const on = selected.layoutOptions.includes(chip);
                    return (
                      <button key={chip} type="button" onClick={() => updateSelected({ layoutOptions: toggleChip(selected.layoutOptions, chip) })}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${on ? 'border-[#2A6364]/40 bg-[#2A6364] text-white' : 'border-[#DADBD9] bg-white text-[#5A5A5A] hover:border-[#2A6364]/30'}`}>
                        {chip}
                      </button>
                    );
                  })}
                </div>
                {/* Custom layout input */}
                <div className="mt-2 flex gap-2">
                  <input id={`layout-custom-${selected.id}`} placeholder="إضافة خيار مخصص..." className="h-8 flex-1 rounded-[8px] border border-[#DADBD9] px-2 text-[12px] outline-none focus:border-[#2A6364]/40" />
                  <button type="button" onClick={() => {
                    const el = document.getElementById(`layout-custom-${selected.id}`) as HTMLInputElement;
                    const val = el?.value.trim();
                    if (val && !selected.layoutOptions.includes(val)) { updateSelected({ layoutOptions: [...selected.layoutOptions, val] }); if (el) el.value = ''; }
                  }} className="rounded-[8px] border border-[#DADBD9] px-3 text-[11px] text-[#2A6364] hover:bg-[#eef5f4]">إضافة</button>
                </div>
                {selected.layoutOptions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.layoutOptions.map((opt) => (
                      <span key={opt} className="flex items-center gap-1 rounded-full border border-[#2A6364]/30 bg-[#eef5f4] px-2.5 py-0.5 text-[11px] text-[#2A6364]">
                        {opt}
                        <button onClick={() => updateSelected({ layoutOptions: selected.layoutOptions.filter((x) => x !== opt) })} className="text-[#73384B] hover:font-bold">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Equipment chips */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-[#2A2A2A]">التجهيزات</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EQUIPMENT_CHIPS.map((chip) => {
                    const on = selected.equipment.includes(chip);
                    return (
                      <button key={chip} type="button" onClick={() => updateSelected({ equipment: toggleChip(selected.equipment, chip) })}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${on ? 'border-[#2E6F8E]/40 bg-[#2E6F8E] text-white' : 'border-[#DADBD9] bg-white text-[#5A5A5A] hover:border-[#2E6F8E]/30'}`}>
                        {chip}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-2">
                  <input id={`equip-custom-${selected.id}`} placeholder="تجهيز مخصص..." className="h-8 flex-1 rounded-[8px] border border-[#DADBD9] px-2 text-[12px] outline-none focus:border-[#2E6F8E]/40" />
                  <button type="button" onClick={() => {
                    const el = document.getElementById(`equip-custom-${selected.id}`) as HTMLInputElement;
                    const val = el?.value.trim();
                    if (val && !selected.equipment.includes(val)) { updateSelected({ equipment: [...selected.equipment, val] }); if (el) el.value = ''; }
                  }} className="rounded-[8px] border border-[#DADBD9] px-3 text-[11px] text-[#2E6F8E] hover:bg-[#e7eff5]">إضافة</button>
                </div>
                {selected.equipment.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.equipment.map((eq) => (
                      <span key={eq} className="flex items-center gap-1 rounded-full border border-[#2E6F8E]/30 bg-[#e7eff5] px-2.5 py-0.5 text-[11px] text-[#2E6F8E]">
                        {eq}
                        <button onClick={() => updateSelected({ equipment: selected.equipment.filter((x) => x !== eq) })} className="text-[#73384B] hover:font-bold">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Internal notes */}
              <div>
                <span className="mb-1 block text-[11px] font-bold text-[#5A5A5A]">ملاحظات داخلية (للمنسق فقط)</span>
                <textarea value={selected.internalNotes || ''} onChange={(e) => updateSelected({ internalNotes: e.target.value })} rows={2}
                  className="w-full rounded-[8px] border border-[#DADBD9] px-3 py-2 text-[13px] outline-none focus:border-[#2A6364]/40 resize-none"
                  placeholder="ملاحظات داخلية لا تظهر للمدربين..." />
              </div>

              {/* Visibility + actions */}
              <div className="flex items-center justify-between gap-3 border-t border-[#DADBD9] pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selected.isVisible} onChange={(e) => updateSelected({ isVisible: e.target.checked })} className="h-4 w-4 accent-[#2A6364]" />
                  <span className="text-[13px] font-semibold text-[#2A2A2A]">ظاهرة للمدربين في المتجر</span>
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => deleteRoom(selected.id)} disabled={busy}
                    className="rounded-[8px] border border-[#73384B]/30 px-4 py-2 text-[12px] font-bold text-[#73384B] hover:bg-[#fff1f3] disabled:opacity-40">
                    حذف
                  </button>
                  <button type="button" onClick={saveRoom} disabled={busy}
                    className="rounded-[8px] bg-[#2A6364] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#1e5152] disabled:opacity-40">
                    {busy ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[#DADBD9] py-20 text-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-[#DADBD9]" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M5 21V7l7-4 7 4v14" /><path d="M9 21v-4h6v4" />
            </svg>
            <p className="mt-3 text-[13px] text-[#B5BDBE]">اختر قاعة من القائمة لتعديلها</p>
          </div>
        )}
      </div>

      {showBulk && <BulkRoomModal rooms={rooms} onClose={() => setShowBulk(false)} onDone={async () => { await load(); setShowBulk(false); showNotice('تم حفظ الصور ✓'); }} />}
    </div>
  );
}

function F({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-[#5A5A5A]">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-[8px] border border-[#DADBD9] px-3 text-[13px] outline-none focus:border-[#2A6364]/40" />
    </label>
  );
}
