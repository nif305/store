'use client';

import { useEffect, useMemo, useState } from 'react';

type Booking = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  requestedLayout?: string | null;
  requestedPlan?: { roomId: string; layout?: string; startDate?: string; endDate?: string }[] | null;
  requestedRoom?: { name: string; type: string; capacity: number } | null;
  approvedRoom?: { name: string; type: string; capacity: number } | null;
  trainerNeed: { code: string; courseName: string; trainerName: string; traineeCount: number; assignedTo?: { fullName: string } | null };
};

const statusLabel: Record<string, string> = {
  REQUESTED: 'بانتظار الاعتماد',
  APPROVED: 'محجوزة',
  ALTERNATIVE_PROPOSED: 'بديل مقترح',
  CANCELLED: 'ملغية',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ar-SA');
}

export default function RoomsSchedulePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  async function load() {
    setError('');
    const response = await fetch('/api/rooms-admin?mode=bookings', { cache: 'no-store', credentials: 'include' });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(json?.error || 'تعذر تحميل جدول القاعات');
      return;
    }
    setBookings(Array.isArray(json.bookings) ? json.bookings : []);
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => bookings.filter((booking) => filter === 'all' || booking.status === filter), [bookings, filter]);
  const approved = bookings.filter((booking) => booking.status === 'APPROVED').length;
  const requested = bookings.filter((booking) => booking.status === 'REQUESTED').length;

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-[8px] border border-[#dce6e3] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[24px] font-extrabold text-[#223738]">جدول القاعات</h1>
            <p className="mt-2 text-[13px] text-[#71817f]">عرض موحد لحجوزات القاعات حتى يعرف المنسقون القاعات المحجوزة والمتاحة قبل اعتماد أي طلب.</p>
          </div>
          <button onClick={load} className="rounded-[8px] border border-[#dce6e3] px-4 py-2 text-[13px] font-bold text-[#2A6364]">تحديث</button>
        </div>
      </section>
      {error ? <div className="rounded-[8px] bg-[#fff1f3] px-4 py-3 text-[13px] font-bold text-[#7c1e3e]">{error}</div> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="كل طلبات القاعات" value={bookings.length} />
        <Stat label="محجوزة" value={approved} />
        <Stat label="بانتظار الاعتماد" value={requested} />
      </div>
      <section className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {[['all', 'الكل'], ['REQUESTED', 'بانتظار الاعتماد'], ['APPROVED', 'محجوزة'], ['CANCELLED', 'ملغية']].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`rounded-[999px] border px-4 py-2 text-[13px] ${filter === key ? 'border-[#2A6364] bg-[#2A6364] text-white' : 'border-[#dce6e3] bg-white text-[#536866]'}`}>{label}</button>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((booking) => {
            const room = booking.approvedRoom || booking.requestedRoom;
            return (
              <article key={booking.id} className="rounded-[8px] border border-[#edf1f1] bg-[#fbfcfc] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[18px] font-extrabold text-[#223738]">{room?.name || 'قاعة غير محددة'}</div>
                    <div className="mt-1 text-[12px] text-[#71817f]">{room?.type} - سعة {room?.capacity}</div>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#2A6364]">{statusLabel[booking.status] || booking.status}</span>
                </div>
                <div className="mt-3 grid gap-2 text-[13px] text-[#536866] md:grid-cols-2">
                  <div>الدورة: {booking.trainerNeed.courseName}</div>
                  <div>المدرب: {booking.trainerNeed.trainerName}</div>
                  <div>من: {formatDate(booking.startDate)}</div>
                  <div>إلى: {formatDate(booking.endDate)}</div>
                  <div>المتدربون: {booking.trainerNeed.traineeCount}</div>
                  <div>المسند إليه: {booking.trainerNeed.assignedTo?.fullName || 'غير مسند'}</div>
                </div>
                {booking.requestedPlan?.length ? (
                  <div className="mt-3 rounded-[8px] border border-[#edf1f1] bg-white px-3 py-2 text-[12px] leading-6 text-[#536866]">
                    {booking.requestedPlan.map((plan, index) => (
                      <div key={`${plan.roomId}-${index}`}>فترة {index + 1}: من {formatDate(plan.startDate || booking.startDate)} إلى {formatDate(plan.endDate || booking.endDate)} - {plan.layout || 'بدون تفضيل محدد'}</div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] border border-[#dce6e3] bg-white p-4">
      <div className="text-[12px] text-[#71817f]">{label}</div>
      <div className="mt-2 text-[28px] font-extrabold text-[#2A6364]">{value}</div>
    </div>
  );
}
