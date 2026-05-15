'use client';

import { useEffect, useMemo, useState } from 'react';

type Room = {
  id: string;
  name: string;
  type: string;
  capacity: number;
  location?: string | null;
  description?: string | null;
  equipment: string[];
  layoutOptions: string[];
  imageUrl?: string | null;
  isVisible: boolean;
  internalNotes?: string | null;
};

export default function RoomsAdminPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [newRoom, setNewRoom] = useState({ name: '', type: 'قاعة تدريبية', capacity: '20' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = useMemo(() => rooms.find((room) => room.id === selectedId) || rooms[0], [rooms, selectedId]);

  async function load() {
    setError('');
    const response = await fetch('/api/rooms-admin', { cache: 'no-store', credentials: 'include' });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(json?.error || 'تعذر تحميل القاعات');
      return;
    }
    setRooms(Array.isArray(json.rooms) ? json.rooms : []);
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
    const maxWidth = 1200;
    const scale = Math.min(1, maxWidth / image.width);
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  }

  function updateSelected(patch: Partial<Room>) {
    if (!selected) return;
    const next = { ...selected, ...patch };
    setRooms((prev) => prev.map((room) => (room.id === selected.id ? next : room)));
  }

  async function saveRoom(room: Room) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/rooms-admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(room),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'تعذر حفظ القاعة');
      await load();
      setSelectedId(room.id);
    } catch (err: any) {
      setError(err?.message || 'تعذر حفظ القاعة');
    } finally {
      setBusy(false);
    }
  }

  async function createRoom(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/rooms-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...newRoom, capacity: Number(newRoom.capacity || 20) }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || 'تعذر إضافة القاعة');
      setNewRoom({ name: '', type: 'قاعة تدريبية', capacity: '20' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'تعذر إضافة القاعة');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
        <h1 className="text-[24px] font-extrabold text-[#223738]">إدارة القاعات</h1>
        <p className="mt-2 text-[13px] text-[#71817f]">إدارة صور القاعات وسعتها وتجهيزاتها وظهورها في مساعد تجهيز الدورة.</p>
      </section>
      {error ? <div className="rounded-[8px] bg-[#fff1f3] px-4 py-3 text-[13px] font-bold text-[#7c1e3e]">{error}</div> : null}
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <section className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
          <div className="mb-3 font-extrabold">القاعات</div>
          <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto">
            {rooms.map((room) => (
              <button key={room.id} type="button" onClick={() => setSelectedId(room.id)} className={`w-full rounded-[8px] border p-3 text-right ${selected?.id === room.id ? 'border-[#2A6364] bg-[#eef6f5]' : 'border-[#dce6e3] bg-white'}`}>
                <div className="font-bold">{room.name}</div>
                <div className="mt-1 text-[12px] text-[#71817f]">{room.type} - سعة {room.capacity} - {room.isVisible ? 'ظاهرة' : 'مخفية'}</div>
              </button>
            ))}
          </div>
        </section>
        <section className="space-y-5">
          {selected ? (
            <div className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
              <h2 className="text-[19px] font-extrabold">تعديل قاعة</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
                <div className="overflow-hidden rounded-[8px] border border-[#dce6e3] bg-[#eef4f3]">
                  <div className="flex aspect-[16/10] items-center justify-center">{selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} className="h-full w-full object-cover" /> : <span className="text-[#71817f]">صورة القاعة</span>}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="اسم القاعة" value={selected.name} onChange={(value) => updateSelected({ name: value })} />
                  <Field label="النوع" value={selected.type} onChange={(value) => updateSelected({ type: value })} />
                  <Field label="السعة" type="number" value={String(selected.capacity)} onChange={(value) => updateSelected({ capacity: Number(value || 1) })} />
                  <Field label="الموقع" value={selected.location || ''} onChange={(value) => updateSelected({ location: value })} />
                  <Field label="التجهيزات - مفصولة بفواصل" value={(selected.equipment || []).join(', ')} onChange={(value) => updateSelected({ equipment: value.split(',').map((x) => x.trim()).filter(Boolean) })} />
                  <Field label="أنماط الترتيب - مفصولة بفواصل" value={(selected.layoutOptions || []).join(', ')} onChange={(value) => updateSelected({ layoutOptions: value.split(',').map((x) => x.trim()).filter(Boolean) })} />
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-[12px] font-bold text-[#536866]">رفع صورة القاعة</span>
                    <input type="file" accept="image/*" onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (file) updateSelected({ imageUrl: await fileToDataUrl(file) });
                    }} className="w-full rounded-[8px] border border-[#dce6e3] p-2 text-[13px]" />
                  </label>
                  <label className="flex items-center gap-2 rounded-[8px] border border-[#dce6e3] px-3 py-3 text-[13px] font-bold">
                    <input type="checkbox" checked={selected.isVisible} onChange={(event) => updateSelected({ isVisible: event.target.checked })} />
                    ظاهرة للمدربين
                  </label>
                </div>
              </div>
              <button type="button" disabled={busy} onClick={() => saveRoom(selected)} className="mt-4 rounded-[8px] bg-[#2A6364] px-5 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-60">حفظ القاعة</button>
            </div>
          ) : null}
          <form onSubmit={createRoom} className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
            <h2 className="text-[18px] font-extrabold">إضافة قاعة جديدة</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Field label="اسم القاعة" value={newRoom.name} onChange={(value) => setNewRoom((prev) => ({ ...prev, name: value }))} />
              <Field label="النوع" value={newRoom.type} onChange={(value) => setNewRoom((prev) => ({ ...prev, type: value }))} />
              <Field label="السعة" type="number" value={newRoom.capacity} onChange={(value) => setNewRoom((prev) => ({ ...prev, capacity: value }))} />
            </div>
            <button disabled={busy} className="mt-4 rounded-[8px] bg-[#2A6364] px-5 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-60">إضافة</button>
          </form>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-[#536866]">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-[8px] border border-[#dce6e3] px-3 outline-none focus:border-[#2A6364]" />
    </label>
  );
}
