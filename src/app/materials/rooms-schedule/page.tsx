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

const statusColor: Record<string, { color: string; bg: string }> = {
  REQUESTED: { color: '#8a6a37', bg: '#f7f1e4' },
  APPROVED: { color: '#1e6b4c', bg: '#e8f5ef' },
  ALTERNATIVE_PROPOSED: { color: '#1b4f68', bg: '#e7eff5' },
  CANCELLED: { color: '#73384B', bg: '#f4e7eb' },
};

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
}

export default function RoomsSchedulePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    const response = await fetch('/api/rooms-admin?mode=bookings', { cache: 'no-store', credentials: 'include' });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) { setError(json?.error || 'تعذر تحميل جدول القاعات'); setLoading(false); return; }
    setBookings(Array.isArray(json.bookings) ? json.bookings : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => bookings.filter((b) => filter === 'all' || b.status === filter), [bookings, filter]);
  const approved = bookings.filter((b) => b.status === 'APPROVED').length;
  const requested = bookings.filter((b) => b.status === 'REQUESTED').length;
  const cancelled = bookings.filter((b) => b.status === 'CANCELLED').length;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <section className="overflow-hidden rounded-[20px] bg-gradient-to-l from-[#1b3d5c] to-[#2E6F8E] p-5 text-white shadow-[0_12px_32px_rgba(46,111,142,0.25)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/15">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <h1 className="text-[22px] font-extrabold">جدول القاعات</h1>
          </div>
          <button onClick={load}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: 'إجمالي الحجوزات', value: bookings.length },
            { label: 'محجوزة', value: approved },
            { label: 'بانتظار الاعتماد', value: requested },
            { label: 'ملغية', value: cancelled },
          ].map((s) => (
            <div key={s.label} className="rounded-[14px] border border-white/10 bg-white/10 px-3 py-3 backdrop-blur-sm">
              <div className="text-[11px] text-white/60">{s.label}</div>
              <div className="mt-1 text-[24px] font-extrabold">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-[12px] border border-[#ecd0d8] bg-[#fff7f8] px-4 py-3 text-[13px] text-[#73384B]">{error}</div>
      )}

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {([['all', 'الكل'], ['REQUESTED', 'بانتظار الاعتماد'], ['APPROVED', 'محجوزة'], ['ALTERNATIVE_PROPOSED', 'بديل مقترح'], ['CANCELLED', 'ملغية']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`shrink-0 rounded-full border px-4 py-2 text-[12px] font-bold transition ${filter === key ? 'border-[#2E6F8E] bg-[#2E6F8E] text-white' : 'border-[#DADBD9] bg-white text-[#5A5A5A] hover:border-[#2E6F8E]/30'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[1,2,3,4].map((i) => <div key={i} className="h-40 animate-pulse rounded-[16px] bg-[#F0F0F0]" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-[#DADBD9] bg-white py-16 text-center">
          <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12 text-[#DADBD9]" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p className="mt-3 text-[13px] text-[#B5BDBE]">لا توجد حجوزات</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((booking) => {
            const room = booking.approvedRoom || booking.requestedRoom;
            const sc = statusColor[booking.status] || { color: '#5A5A5A', bg: '#F0F0F0' };
            return (
              <article key={booking.id} className="overflow-hidden rounded-[16px] border border-[#DADBD9] bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-[#DADBD9] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ backgroundColor: sc.bg }}>
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke={sc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="text-[15px] font-extrabold text-[#2A2A2A]">{room?.name || 'قاعة غير محددة'}</div>
                      <div className="text-[11px] text-[#B5BDBE]">{room?.type} · سعة {room?.capacity}</div>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: sc.bg, color: sc.color }}>
                    {statusLabel[booking.status] || booking.status}
                  </span>
                </div>

                <div className="p-4">
                  <div className="mb-2 text-[13px] font-bold text-[#2A2A2A] leading-snug">{booking.trainerNeed.courseName}</div>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    {[
                      ['المدرب', booking.trainerNeed.trainerName],
                      ['المتدربون', `${booking.trainerNeed.traineeCount} متدرب`],
                      ['من', formatDate(booking.startDate)],
                      ['إلى', formatDate(booking.endDate)],
                      ['المسند إليه', booking.trainerNeed.assignedTo?.fullName || '—'],
                      ['رمز الطلب', booking.trainerNeed.code],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-[8px] bg-[#F9F9F9] px-2.5 py-1.5">
                        <div className="text-[10px] text-[#B5BDBE]">{k}</div>
                        <div className="font-semibold text-[#2A2A2A]">{v}</div>
                      </div>
                    ))}
                  </div>

                  {booking.requestedPlan && booking.requestedPlan.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {booking.requestedPlan.map((plan, index) => (
                        <div key={`${plan.roomId}-${index}`} className="flex items-center gap-2 rounded-[8px] bg-[#eef5f4] px-2.5 py-1.5 text-[11px]">
                          <span className="font-bold text-[#2A6364]">فترة {index + 1}:</span>
                          <span className="text-[#5A5A5A]">{formatDate(plan.startDate)} – {formatDate(plan.endDate)}</span>
                          {plan.layout && <span className="text-[#B5BDBE]">· {plan.layout}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
