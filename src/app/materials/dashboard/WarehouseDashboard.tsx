'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';

/* ─── Types ─── */
type PendingRequest = {
  id: string; code: string; purpose: string; createdAt: string;
  requester?: { fullName?: string; department?: string } | null;
  items: { quantity: number }[];
};
type PendingReturn = {
  id: string; code: string; createdAt: string; returnType?: string | null;
  custody?: { quantity?: number | null; item?: { name?: string } | null; user?: { fullName?: string } | null } | null;
};
type AuditEntry = {
  id: string; action: string; entity: string; entityId?: string | null;
  createdAt: string; userName: string;
};
type Summary = {
  pendingRequests: number; pendingRequestsList: PendingRequest[];
  pendingReturns: number; pendingReturnsList: PendingReturn[];
  lowStock: number; outOfStock: number; totalItems: number;
  activeCustody: number; overdueCustody: number;
  issuedThisMonth: number; returnsThisMonth: number;
  monthlyTrend: { month: string; count: number }[];
  auditLogs: AuditEntry[];
};

/* ─── Mini bar chart ─── */
function MiniBar({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-16 items-end gap-1">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
          {d.count > 0 && <div className="text-[8px] font-bold text-white/60">{d.count}</div>}
          <div className="w-full rounded-t-[3px]"
            style={{ height: `${Math.max((d.count / max) * 44, d.count > 0 ? 4 : 2)}px`, backgroundColor: d.count > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)' }} />
          <div className="text-[8px] text-white/40">{d.month.slice(0, 3)}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Confirm modal ─── */
function ConfirmModal({ open, title, message, confirmLabel, confirmColor, onConfirm, onClose, loading }: {
  open: boolean; title: string; message: string; confirmLabel: string;
  confirmColor: string; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="w-full max-w-sm rounded-[20px] bg-white p-5 shadow-2xl">
        <h3 className="text-[16px] font-extrabold text-[#2A2A2A]">{title}</h3>
        <p className="mt-2 text-[13px] text-[#5A5A5A]">{message}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} disabled={loading}
            className="flex-1 rounded-[10px] border border-[#DADBD9] py-2.5 text-[13px] font-semibold text-[#5A5A5A] hover:bg-[#F9F9F9]">
            إلغاء
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 rounded-[10px] py-2.5 text-[13px] font-bold text-white transition"
            style={{ backgroundColor: confirmColor }}>
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  return `منذ ${Math.floor(h / 24)} ي`;
}

/* ══════════════════════════════════════
   Warehouse Dashboard
══════════════════════════════════════ */
export function WarehouseDashboard() {
  const { user } = useAuth();
  const { language } = useI18n();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirm, setConfirm] = useState<{ type: 'issue' | 'reject'; request: PendingRequest } | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const greetHour = new Date().getHours();
  const greeting = language === 'en'
    ? (greetHour < 12 ? 'Good morning' : greetHour < 17 ? 'Good afternoon' : 'Good evening')
    : (greetHour < 12 ? 'صباح الخير' : greetHour < 17 ? 'مساء الخير' : 'مساء النور');

  const refresh = () => {
    setLoading(true);
    fetch('/api/warehouse/summary', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setData(d))
      .catch(() => null)
      .finally(() => { setLoading(false); setLastRefresh(Date.now()); });
  };

  useEffect(() => { refresh(); }, []);

  const handleIssue = async () => {
    if (!confirm) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/requests/${confirm.request.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-active-role': 'warehouse' },
        body: JSON.stringify({ action: 'issue', notes: '' }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j?.error || 'تعذر الصرف'); return; }
      setConfirm(null);
      refresh();
    } finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!confirm) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/requests/${confirm.request.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-active-role': 'warehouse' },
        body: JSON.stringify({ action: 'reject', reason: rejectNote || 'تم الرفض من المستودع', notes: rejectNote }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j?.error || 'تعذر الرفض'); return; }
      setConfirm(null); setRejectNote('');
      refresh();
    } finally { setActionLoading(false); }
  };

  const urgentCount = (data?.pendingRequests ?? 0) + (data?.pendingReturns ?? 0) + (data?.overdueCustody ?? 0);

  return (
    <div className="space-y-4" dir="rtl">

      {/* ══ Hero header ══ */}
      <section className="overflow-hidden rounded-[22px] bg-gradient-to-l from-[#0d2b35] via-[#1a3c4a] to-[#2A6364] shadow-[0_16px_48px_rgba(0,0,0,0.25)]">
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <span className="text-[11px] font-semibold text-white/50">مركز عمليات المستودع</span>
              </div>
              <h1 className="mt-2 text-[24px] font-extrabold text-white">
                {user?.fullName?.split(' ').slice(0, 2).join(' ') || 'مسؤول المستودع'}
              </h1>
              <div className="mt-0.5 text-[12px] text-white/50">{greeting} — {new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button onClick={refresh}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
              {urgentCount > 0 && (
                <div className="rounded-full bg-[#C7B08C] px-3 py-1 text-[11px] font-bold text-[#3a2a10]">
                  {urgentCount} إجراء مطلوب
                </div>
              )}
            </div>
          </div>

          {/* KPI row */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'طلبات للصرف', value: data?.pendingRequests ?? 0, urgent: (data?.pendingRequests ?? 0) > 0, href: '/materials/requests', icon: (
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/></svg>
              )},
              { label: 'مرتجعات للتوثيق', value: data?.pendingReturns ?? 0, urgent: (data?.pendingReturns ?? 0) > 0, href: '/materials/returns', icon: (
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 9H5V5"/><path d="M5 9C6.8 6.6 9 5.5 12 5.5c4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4"/></svg>
              )},
              { label: 'نافد من المخزون', value: data?.outOfStock ?? 0, urgent: (data?.outOfStock ?? 0) > 0, href: '/materials/inventory', icon: (
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              )},
              { label: 'عهد متأخرة', value: data?.overdueCustody ?? 0, urgent: (data?.overdueCustody ?? 0) > 0, href: '/materials/custody', icon: (
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
              )},
            ].map((kpi) => (
              <a key={kpi.label} href={kpi.href}
                className={`rounded-[14px] border px-3 py-3 transition hover:scale-[1.02] ${kpi.urgent ? 'border-[#C7B08C]/50 bg-[#C7B08C]/15' : 'border-white/10 bg-white/8'}`}>
                <div className="flex items-center gap-2">
                  <span className={kpi.urgent ? 'text-[#C7B08C]' : 'text-white/50'}>{kpi.icon}</span>
                  <span className="text-[10px] font-semibold text-white/60">{kpi.label}</span>
                </div>
                <div className={`mt-1.5 text-[26px] font-extrabold ${kpi.urgent ? 'text-[#C7B08C]' : 'text-white'}`}>{kpi.value}</div>
              </a>
            ))}
          </div>
        </div>

        {/* Monthly trend strip */}
        {data?.monthlyTrend && (
          <div className="border-t border-white/10 px-5 pb-4 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white/40">طلبات مصروفة — آخر 6 أشهر</span>
              <span className="text-[11px] text-white/40">هذا الشهر: <strong className="text-white/70">{data.issuedThisMonth}</strong></span>
            </div>
            <MiniBar data={data.monthlyTrend} />
          </div>
        )}
      </section>

      {/* ══ Quick actions ══ */}
      <section className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          { label: 'قائمة الطلبات', href: '/materials/requests', color: '#2A6364', bg: '#eef5f4', icon: <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><path d="M9 12h6M9 16h4"/></svg> },
          { label: 'المرتجعات', href: '/materials/returns', color: '#1b4f68', bg: '#e7eff5', icon: <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 9H5V5"/><path d="M5 9C6.8 6.6 9 5.5 12 5.5c4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4"/></svg> },
          { label: 'المخزون', href: '/materials/inventory', color: '#4F8F7A', bg: '#edf4f0', icon: <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/></svg> },
          { label: 'العهد', href: '/materials/custody', color: '#8a6a37', bg: '#f7f1e4', icon: <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z"/></svg> },
          { label: 'احتياجات المدربين', href: '/materials/trainer-needs', color: '#73384B', bg: '#f4e7eb', icon: <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3.5 3 8.5 3 12 0v-5"/></svg> },
          { label: 'المراسلات', href: '/materials/messages', color: '#2E6F8E', bg: '#e7eff5', icon: <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
        ].map((action) => (
          <a key={action.label} href={action.href}
            className="flex flex-col items-center gap-2 rounded-[14px] border border-[#DADBD9] bg-white py-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ backgroundColor: action.bg, color: action.color }}>
              {action.icon}
            </div>
            <span className="text-center text-[11px] font-bold text-[#2A2A2A] leading-tight px-1">{action.label}</span>
          </a>
        ))}
      </section>

      {/* ══ Main operations area ══ */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Pending requests queue */}
        <section className="rounded-[20px] border border-[#DADBD9] bg-white">
          <div className="flex items-center justify-between border-b border-[#DADBD9] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${(data?.pendingRequests ?? 0) > 0 ? 'bg-[#C7B08C]/20' : 'bg-[#F9F9F9]'}`}>
                <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 ${(data?.pendingRequests ?? 0) > 0 ? 'text-[#8a6a37]' : 'text-[#B5BDBE]'}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/>
                </svg>
              </div>
              <div>
                <div className="text-[14px] font-extrabold text-[#2A2A2A]">طلبات بانتظار الصرف</div>
                <div className="text-[11px] text-[#B5BDBE]">مرتبة من الأقدم</div>
              </div>
            </div>
            {(data?.pendingRequests ?? 0) > 0 && (
              <span className="rounded-full bg-[#f7f1e4] px-2.5 py-1 text-[11px] font-bold text-[#8a6a37]">
                {data?.pendingRequests} طلب
              </span>
            )}
          </div>

          <div className="divide-y divide-[#F0F0F0]">
            {loading ? (
              [1,2,3].map((i) => <div key={i} className="h-16 animate-pulse bg-[#F9F9F9] m-3 rounded-[10px]" />)
            ) : !data?.pendingRequestsList?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef5f4]">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-[#2A6364]" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <p className="mt-2 text-[13px] font-semibold text-[#4F8F7A]">لا توجد طلبات معلقة</p>
              </div>
            ) : (
              data.pendingRequestsList.map((req) => {
                const totalUnits = req.items.reduce((s, i) => s + (i.quantity || 0), 0);
                return (
                  <div key={req.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#2A6364]">{req.code}</span>
                        <span className="text-[10px] text-[#B5BDBE]">·</span>
                        <span className="text-[11px] text-[#B5BDBE]">{formatTimeAgo(req.createdAt)}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[13px] font-semibold text-[#2A2A2A]">{req.purpose}</div>
                      <div className="mt-0.5 text-[11px] text-[#B5BDBE]">
                        {req.requester?.fullName || '—'} · {req.items.length} صنف · {totalUnits} وحدة
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => setConfirm({ type: 'issue', request: req })}
                        className="rounded-[8px] bg-[#2A6364] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1e5152]">
                        صرف
                      </button>
                      <button
                        onClick={() => { setConfirm({ type: 'reject', request: req }); setRejectNote(''); }}
                        className="rounded-[8px] bg-[#f4e7eb] px-3 py-1.5 text-[11px] font-bold text-[#73384B] hover:bg-[#ecd0d8]">
                        رفض
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {(data?.pendingRequests ?? 0) > 6 && (
            <div className="border-t border-[#F0F0F0] px-4 py-2.5">
              <a href="/materials/requests" className="text-[12px] font-semibold text-[#2A6364] hover:underline">
                عرض جميع الطلبات ({data?.pendingRequests}) ←
              </a>
            </div>
          )}
        </section>

        {/* Returns queue */}
        <section className="rounded-[20px] border border-[#DADBD9] bg-white">
          <div className="flex items-center justify-between border-b border-[#DADBD9] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${(data?.pendingReturns ?? 0) > 0 ? 'bg-[#e7eff5]' : 'bg-[#F9F9F9]'}`}>
                <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 ${(data?.pendingReturns ?? 0) > 0 ? 'text-[#1b4f68]' : 'text-[#B5BDBE]'}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 9H5V5"/><path d="M5 9C6.8 6.6 9 5.5 12 5.5c4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4"/>
                </svg>
              </div>
              <div>
                <div className="text-[14px] font-extrabold text-[#2A2A2A]">مرتجعات بانتظار التوثيق</div>
                <div className="text-[11px] text-[#B5BDBE]">تحتاج فحص وتسجيل الحالة</div>
              </div>
            </div>
            {(data?.pendingReturns ?? 0) > 0 && (
              <span className="rounded-full bg-[#e7eff5] px-2.5 py-1 text-[11px] font-bold text-[#1b4f68]">
                {data?.pendingReturns}
              </span>
            )}
          </div>

          <div className="divide-y divide-[#F0F0F0]">
            {loading ? (
              [1,2,3].map((i) => <div key={i} className="h-16 animate-pulse bg-[#F9F9F9] m-3 rounded-[10px]" />)
            ) : !data?.pendingReturnsList?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e7eff5]">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-[#1b4f68]" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <p className="mt-2 text-[13px] font-semibold text-[#1b4f68]">لا توجد مرتجعات معلقة</p>
              </div>
            ) : (
              data.pendingReturnsList.map((ret) => {
                const condLabel = ret.returnType === 'GOOD' ? 'سليمة' : ret.returnType === 'PARTIAL_DAMAGE' ? 'تلف جزئي' : ret.returnType === 'TOTAL_DAMAGE' ? 'تلف كلي' : '—';
                const condColor = ret.returnType === 'GOOD' ? '#1e6b4c' : '#73384B';
                return (
                  <div key={ret.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#1b4f68]">{ret.code}</span>
                        <span className="text-[10px] text-[#B5BDBE]">·</span>
                        <span className="text-[11px] text-[#B5BDBE]">{formatTimeAgo(ret.createdAt)}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[13px] font-semibold text-[#2A2A2A]">
                        {ret.custody?.item?.name || '—'}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#B5BDBE]">
                        <span>{ret.custody?.user?.fullName || '—'}</span>
                        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ color: condColor, backgroundColor: `${condColor}18` }}>{condLabel}</span>
                      </div>
                    </div>
                    <a href="/materials/returns"
                      className="shrink-0 rounded-[8px] bg-[#e7eff5] px-3 py-1.5 text-[11px] font-bold text-[#1b4f68] hover:bg-[#b8d4e4]">
                      معالجة
                    </a>
                  </div>
                );
              })
            )}
          </div>

          {(data?.pendingReturns ?? 0) > 5 && (
            <div className="border-t border-[#F0F0F0] px-4 py-2.5">
              <a href="/materials/returns" className="text-[12px] font-semibold text-[#1b4f68] hover:underline">
                عرض جميع المرتجعات ({data?.pendingReturns}) ←
              </a>
            </div>
          )}
        </section>
      </div>

      {/* ══ Inventory + Custody health ══ */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Inventory */}
        <div className="col-span-2 rounded-[20px] border border-[#DADBD9] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#edf4f0]">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#4F8F7A]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                  <path d="M3.3 7 12 12l8.7-5M12 22V12"/>
                </svg>
              </div>
              <span className="text-[14px] font-extrabold text-[#2A2A2A]">صحة المخزون</span>
            </div>
            <a href="/materials/inventory" className="text-[12px] font-semibold text-[#2A6364] hover:underline">إدارة المخزون</a>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'إجمالي الأصناف', value: data?.totalItems ?? 0, color: '#2A6364', bg: '#eef5f4' },
              { label: 'منخفض المخزون', value: data?.lowStock ?? 0, color: '#8a6a37', bg: '#f7f1e4', urgent: (data?.lowStock ?? 0) > 0 },
              { label: 'نافد المخزون', value: data?.outOfStock ?? 0, color: '#73384B', bg: '#f4e7eb', urgent: (data?.outOfStock ?? 0) > 0 },
            ].map((s) => (
              <div key={s.label} className={`rounded-[14px] p-3 text-center transition ${s.urgent ? 'ring-1 ring-current' : ''}`}
                style={{ backgroundColor: s.bg }}>
                <div className="text-[26px] font-extrabold" style={{ color: s.color }}>{s.value}</div>
                <div className="mt-0.5 text-[11px] font-semibold" style={{ color: `${s.color}bb` }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Stock bar */}
          {(data?.totalItems ?? 0) > 0 && (
            <div className="mt-4">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-[#F0F0F0]">
                {[
                  { val: (data?.totalItems ?? 0) - (data?.lowStock ?? 0) - (data?.outOfStock ?? 0), color: '#4F8F7A' },
                  { val: data?.lowStock ?? 0, color: '#C7B08C' },
                  { val: data?.outOfStock ?? 0, color: '#73384B' },
                ].map((seg, i) => (
                  <div key={i} className="h-full transition-all" style={{ width: `${(seg.val / (data?.totalItems ?? 1)) * 100}%`, backgroundColor: seg.color }} />
                ))}
              </div>
              <div className="mt-1.5 flex gap-3 text-[10px] text-[#B5BDBE]">
                <span><span style={{ color: '#4F8F7A' }}>●</span> متاح</span>
                <span><span style={{ color: '#C7B08C' }}>●</span> منخفض</span>
                <span><span style={{ color: '#73384B' }}>●</span> نافد</span>
              </div>
            </div>
          )}
        </div>

        {/* Custody health */}
        <div className="rounded-[20px] border border-[#DADBD9] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#f7f1e4]">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#8a6a37]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z"/>
                </svg>
              </div>
              <span className="text-[14px] font-extrabold text-[#2A2A2A]">العهد</span>
            </div>
            <a href="/materials/custody" className="text-[12px] font-semibold text-[#2A6364] hover:underline">عرض</a>
          </div>
          <div className="space-y-2">
            {[
              { label: 'عهد نشطة', value: data?.activeCustody ?? 0, color: '#2A6364', bg: '#eef5f4' },
              { label: 'متأخرة', value: data?.overdueCustody ?? 0, color: '#73384B', bg: '#f4e7eb', urgent: (data?.overdueCustody ?? 0) > 0 },
              { label: 'صُرفت هذا الشهر', value: data?.issuedThisMonth ?? 0, color: '#4F8F7A', bg: '#edf4f0' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between rounded-[10px] px-3 py-2.5" style={{ backgroundColor: s.bg }}>
                <span className="text-[12px] font-semibold" style={{ color: `${s.color}cc` }}>{s.label}</span>
                <span className="text-[20px] font-extrabold" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
          {(data?.overdueCustody ?? 0) > 0 && (
            <div className="mt-3 flex items-center gap-1.5 rounded-[8px] bg-[#fff7f8] border border-[#ecd0d8] px-2.5 py-2 text-[11px] text-[#73384B]">
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              {data?.overdueCustody} عهدة تجاوزت موعد الإرجاع
            </div>
          )}
        </div>
      </div>

      {/* ══ Audit log ══ */}
      <section className="rounded-[20px] border border-[#DADBD9] bg-white">
        <div className="flex items-center justify-between border-b border-[#DADBD9] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#F9F9F9]">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#B5BDBE]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
              </svg>
            </div>
            <span className="text-[14px] font-extrabold text-[#2A2A2A]">سجل العمليات الأخيرة</span>
          </div>
          <span className="text-[11px] text-[#B5BDBE]">تحديث: {new Date(lastRefresh).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[1,2,3].map((i) => <div key={i} className="h-10 animate-pulse rounded-[8px] bg-[#F0F0F0]" />)}
          </div>
        ) : !data?.auditLogs?.length ? (
          <div className="py-10 text-center text-[13px] text-[#B5BDBE]">لا توجد عمليات مسجلة</div>
        ) : (
          <div className="divide-y divide-[#F0F0F0]">
            {data.auditLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#FAFAFA]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef5f4]">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-[#2A6364]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#2A2A2A]">{log.action}</span>
                    <span className="rounded-full bg-[#F0F0F0] px-2 py-0.5 text-[10px] text-[#B5BDBE]">{log.entity}</span>
                    {log.entityId && <span className="font-mono text-[10px] text-[#B5BDBE]">{log.entityId.slice(0, 12)}</span>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#B5BDBE]">{log.userName}</div>
                </div>
                <span className="shrink-0 text-[11px] text-[#B5BDBE]">{formatTimeAgo(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Confirm modals */}
      <ConfirmModal
        open={confirm?.type === 'issue'}
        title="تأكيد صرف المواد"
        message={`هل تريد صرف الطلب "${confirm?.request.code}" لـ "${confirm?.request.requester?.fullName || '—'}"؟`}
        confirmLabel="صرف الآن"
        confirmColor="#2A6364"
        onConfirm={handleIssue}
        onClose={() => setConfirm(null)}
        loading={actionLoading}
      />

      {confirm?.type === 'reject' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
          <div className="w-full max-w-sm rounded-[20px] bg-white p-5 shadow-2xl">
            <h3 className="text-[16px] font-extrabold text-[#2A2A2A]">رفض الطلب</h3>
            <p className="mt-1 text-[12px] text-[#B5BDBE]">{confirm.request.code} · {confirm.request.requester?.fullName}</p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="سبب الرفض (اختياري)"
              rows={3}
              className="mt-3 w-full resize-none rounded-[10px] border border-[#DADBD9] px-3 py-2 text-[13px] outline-none focus:border-[#73384B]/40"
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirm(null)} disabled={actionLoading}
                className="flex-1 rounded-[10px] border border-[#DADBD9] py-2.5 text-[13px] font-semibold text-[#5A5A5A]">
                إلغاء
              </button>
              <button onClick={handleReject} disabled={actionLoading}
                className="flex-1 rounded-[10px] bg-[#73384B] py-2.5 text-[13px] font-bold text-white hover:bg-[#5c2a3a]">
                {actionLoading ? '...' : 'تأكيد الرفض'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
