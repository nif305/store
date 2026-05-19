'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

/* ══════════════════════════════════════
   Types
══════════════════════════════════════ */
type Analytics = {
  inventory: { total: number; available: number; lowStock: number; outOfStock: number; returnable: number; consumable: number; totalValue: number };
  requests: { total: number; pending: number; issued: number; returned: number; rejected: number; thisMonth: number; lastMonth: number; growth: number; fulfillmentRate: number };
  returns: { total: number; pending: number; good: number; damaged: number };
  custody: { active: number; overdue: number; returned: number };
  users: { total: number; active: number; managers: number; warehouse: number; employees: number };
  rooms: { total: number; pending: number; approved: number };
  trainerNeeds: { pending: number; converted: number };
  monthlyTrend: { month: string; total: number; issued: number }[];
  topRequesters: { name: string; department: string; count: number }[];
  recentAudit: { id: string; action: string; entity: string; entityId?: string | null; createdAt: string; userName: string; userRole?: string | null }[];
};

/* ── Donut SVG ── */
function Donut({ segments, size = 110, stroke = 16, center }: {
  segments: { color: string; value: number; label: string }[];
  size?: number; stroke?: number;
  center?: { top: string; bottom: string };
}) {
  const r = (size / 2) - (stroke / 2);
  const c = 2 * Math.PI * r;
  const total = Math.max(segments.reduce((s, seg) => s + seg.value, 0), 1);
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EAEAEA" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          if (seg.value === 0) return null;
          const dash = (seg.value / total) * c;
          const el = <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color} strokeWidth={stroke} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} strokeLinecap="round" />;
          offset += dash;
          return el;
        })}
      </svg>
      {center && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-[18px] font-extrabold text-[#2A2A2A]">{center.top}</div>
          <div className="text-[9px] text-[#B5BDBE]">{center.bottom}</div>
        </div>
      )}
    </div>
  );
}

/* ── Dual Bar Chart ── */
function DualBar({ data }: { data: { month: string; total: number; issued: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex h-[100px] items-end gap-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full space-y-0.5">
            <div className="w-full rounded-t-[3px] bg-[#2A6364]/20"
              style={{ height: `${Math.max((d.total / max) * 76, d.total > 0 ? 3 : 2)}px` }} />
            <div className="w-full rounded-b-sm bg-[#2A6364]"
              style={{ height: `${Math.max((d.issued / max) * 76, d.issued > 0 ? 3 : 0)}px` }} />
          </div>
          <div className="text-[8px] text-[#B5BDBE] text-center">{d.month.slice(0,3)}</div>
        </div>
      ))}
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({ label, value, sub, color, bg, href, icon, urgent }: {
  label: string; value: string | number; sub?: string;
  color: string; bg: string; href?: string; urgent?: boolean;
  icon: React.ReactNode;
}) {
  const El = href ? 'a' : 'div';
  return (
    <El href={href as string}
      className={`flex flex-col gap-3 rounded-[16px] border p-4 transition ${href ? 'hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)] cursor-pointer' : ''} ${urgent ? 'border-[#C7B08C]/40' : 'border-[#DADBD9]'}`}
      style={{ backgroundColor: bg }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]" style={{ backgroundColor: `${color}20`, color }}>
          {icon}
        </div>
        {urgent && <span className="h-2 w-2 rounded-full bg-[#C7B08C]" />}
      </div>
      <div>
        <div className="text-[26px] font-extrabold leading-none" style={{ color }}>{value}</div>
        <div className="mt-1 text-[11px] font-semibold" style={{ color: `${color}aa` }}>{label}</div>
        {sub && <div className="mt-0.5 text-[10px]" style={{ color: `${color}66` }}>{sub}</div>}
      </div>
    </El>
  );
}

function formatTimeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} س`;
  return `${Math.floor(h / 24)} ي`;
}

const ACTION_AR: Record<string, string> = {
  CREATE_REQUEST: 'طلب جديد', ISSUE_REQUEST: 'صرف طلب', REJECT_REQUEST: 'رفض طلب',
  CANCEL_REQUEST: 'إلغاء', APPROVE_RETURN: 'قبول مرتجع', REJECT_RETURN: 'رفض مرتجع',
  CREATE_RETURN: 'طلب إرجاع', ASSIGN_CUSTODY: 'تعيين عهدة', RETURN_CUSTODY: 'إعادة عهدة',
  UPDATE_INVENTORY: 'تحديث مخزون', SYNC_INVENTORY: 'مزامنة',
};

/* ══════════════════════════════════════
   Manager Dashboard
══════════════════════════════════════ */
export function ManagerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? 'صباح الخير' : greetHour < 17 ? 'مساء الخير' : 'مساء النور';

  const refresh = () => {
    setLoading(true);
    fetch('/api/manager/analytics', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setData(d); setLastUpdate(Date.now()); } })
      .catch(() => null)
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const inv = data?.inventory;
  const req = data?.requests;
  const ret = data?.returns;
  const cus = data?.custody;

  const inventoryHealthScore = inv
    ? Math.round((inv.available / Math.max(inv.total, 1)) * 100)
    : 0;

  return (
    <div className="space-y-4" dir="rtl">

      {/* ══ HERO ══ */}
      <section className="overflow-hidden rounded-[22px] bg-gradient-to-l from-[#0a1f1a] via-[#102a22] to-[#1a4535] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#C7B08C]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                  </svg>
                </div>
                <span className="text-[11px] font-semibold text-white/40">مركز التحكم والتحليل</span>
              </div>
              <h1 className="mt-2 text-[24px] font-extrabold text-white">
                {greeting}، {user?.fullName?.split(' ').slice(0, 2).join(' ') || 'المدير'}
              </h1>
              <div className="mt-0.5 text-[12px] text-white/40">
                {new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={refresh}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
              <div className="text-[10px] text-white/30">
                {new Date(lastUpdate).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Macro KPIs */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'تلبية الطلبات', value: loading ? '—' : `${req?.fulfillmentRate ?? 0}%`, sub: 'معدل الإنجاز الكلي', accent: '#4ade80' },
              { label: 'طلبات معلقة', value: loading ? '—' : req?.pending ?? 0, sub: 'تحتاج إجراء', accent: '#fbbf24', urgent: (req?.pending ?? 0) > 0 },
              { label: 'عهد متأخرة', value: loading ? '—' : cus?.overdue ?? 0, sub: 'تجاوزت الموعد', accent: '#f87171', urgent: (cus?.overdue ?? 0) > 0 },
              { label: 'صحة المخزون', value: loading ? '—' : `${inventoryHealthScore}%`, sub: `${inv?.available ?? 0} صنف متاح`, accent: '#34d399' },
            ].map((kpi) => (
              <div key={kpi.label} className={`rounded-[16px] border px-4 py-3.5 backdrop-blur-sm ${kpi.urgent ? 'border-[#fbbf24]/30 bg-[#fbbf24]/10' : 'border-white/8 bg-white/6'}`}>
                <div className="text-[22px] font-extrabold" style={{ color: kpi.accent }}>{kpi.value}</div>
                <div className="text-[12px] font-semibold text-white/70">{kpi.label}</div>
                <div className="text-[10px] text-white/35">{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Growth badge */}
          {req && !loading && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold ${req.growth > 0 ? 'bg-green-500/15 text-green-400' : req.growth < 0 ? 'bg-red-400/15 text-red-400' : 'bg-white/8 text-white/40'}`}>
                {req.growth > 0 ? '↑' : req.growth < 0 ? '↓' : '→'}
                {Math.abs(req.growth)}% مقارنةً بالشهر السابق
              </div>
              <div className="text-[11px] text-white/30">{req.thisMonth} طلب هذا الشهر · {req.lastMonth} الشهر الماضي</div>
            </div>
          )}
        </div>

        {/* Quick nav strip */}
        <div className="flex gap-1 overflow-x-auto border-t border-white/8 px-5 py-3" style={{ scrollbarWidth: 'none' }}>
          {[
            { label: 'طلبات المواد', href: '/materials/requests', urgent: (req?.pending ?? 0) > 0 },
            { label: 'المرتجعات', href: '/materials/returns', urgent: (ret?.pending ?? 0) > 0 },
            { label: 'المخزون', href: '/materials/inventory', urgent: (inv?.outOfStock ?? 0) > 0 },
            { label: 'المستخدمون', href: '/materials/users' },
            { label: 'التقارير', href: '/materials/reports' },
            { label: 'سجل التدقيق', href: '/materials/audit-logs' },
            { label: 'احتياجات المدربين', href: '/materials/trainer-needs' },
            { label: 'جدول القاعات', href: '/materials/rooms-schedule' },
          ].map((link) => (
            <a key={link.href} href={link.href}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition hover:bg-white/15 ${link.urgent ? 'border-[#C7B08C]/40 bg-[#C7B08C]/10 text-[#C7B08C]' : 'border-white/15 text-white/60'}`}>
              {link.label}
              {link.urgent && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#C7B08C]" />}
            </a>
          ))}
        </div>
      </section>

      {/* ══ KPI Grid ══ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="إجمالي الطلبات" value={req?.total ?? '—'} sub={`هذا الشهر: ${req?.thisMonth ?? 0}`}
          color="#2A6364" bg="#eef5f4" href="/materials/requests" urgent={false}
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/></svg>} />
        <KpiCard label="مصروفة بنجاح" value={req?.issued ?? '—'} sub={`+ ${req?.returned ?? 0} مُعادة`}
          color="#1e6b4c" bg="#e8f5ef" href="/materials/requests"
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>} />
        <KpiCard label="مرتجعات معلقة" value={ret?.pending ?? '—'} sub={`${ret?.damaged ?? 0} مع تلف`}
          color="#1b4f68" bg="#e7eff5" href="/materials/returns" urgent={(ret?.pending ?? 0) > 0}
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 9H5V5"/><path d="M5 9C6.8 6.6 9 5.5 12 5.5c4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4"/></svg>} />
        <KpiCard label="احتياجات المدربين" value={data?.trainerNeeds.pending ?? '—'} sub={`${data?.trainerNeeds.converted ?? 0} محوّلة`}
          color="#73384B" bg="#f4e7eb" href="/materials/trainer-needs"
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3.5 3 8.5 3 12 0v-5"/></svg>} />
      </div>

      {/* ══ Charts Row ══ */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Inventory Donut */}
        <div className="rounded-[20px] border border-[#DADBD9] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[14px] font-extrabold text-[#2A2A2A]">صحة المخزون</div>
            <a href="/materials/inventory" className="text-[11px] font-semibold text-[#2A6364] hover:underline">تفاصيل</a>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><div className="h-28 w-28 animate-pulse rounded-full bg-[#F0F0F0]" /></div>
          ) : (
            <div className="flex items-center gap-4">
              <Donut
                size={120} stroke={18}
                center={{ top: `${inventoryHealthScore}%`, bottom: 'متاح' }}
                segments={[
                  { color: '#4F8F7A', value: inv?.available ?? 0, label: 'متاح' },
                  { color: '#C7B08C', value: inv?.lowStock ?? 0, label: 'منخفض' },
                  { color: '#73384B', value: inv?.outOfStock ?? 0, label: 'نافد' },
                ]}
              />
              <div className="flex flex-1 flex-col gap-2">
                {[
                  { label: 'متاح', value: inv?.available ?? 0, color: '#4F8F7A', bg: '#edf4f0' },
                  { label: 'منخفض', value: inv?.lowStock ?? 0, color: '#8a6a37', bg: '#f7f1e4' },
                  { label: 'نافد', value: inv?.outOfStock ?? 0, color: '#73384B', bg: '#f4e7eb' },
                  { label: 'مسترجعة', value: inv?.returnable ?? 0, color: '#2A6364', bg: '#eef5f4' },
                  { label: 'مستهلكة', value: inv?.consumable ?? 0, color: '#1b4f68', bg: '#e7eff5' },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between rounded-[8px] px-2.5 py-1.5" style={{ backgroundColor: s.bg }}>
                    <span className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                    <span className="text-[13px] font-extrabold" style={{ color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Request Status Donut */}
        <div className="rounded-[20px] border border-[#DADBD9] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[14px] font-extrabold text-[#2A2A2A]">توزيع الطلبات</div>
            <a href="/materials/requests" className="text-[11px] font-semibold text-[#2A6364] hover:underline">كل الطلبات</a>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><div className="h-28 w-28 animate-pulse rounded-full bg-[#F0F0F0]" /></div>
          ) : (
            <div className="flex items-center gap-4">
              <Donut
                size={120} stroke={18}
                center={{ top: String(req?.total ?? 0), bottom: 'طلب' }}
                segments={[
                  { color: '#2A6364', value: req?.issued ?? 0, label: 'مصروفة' },
                  { color: '#4F8F7A', value: req?.returned ?? 0, label: 'مُعادة' },
                  { color: '#C7B08C', value: req?.pending ?? 0, label: 'معلقة' },
                  { color: '#73384B', value: req?.rejected ?? 0, label: 'مرفوضة' },
                ]}
              />
              <div className="flex flex-1 flex-col gap-2">
                {[
                  { label: 'مصروفة', value: req?.issued ?? 0, color: '#2A6364', bg: '#eef5f4' },
                  { label: 'مُعادة', value: req?.returned ?? 0, color: '#4F8F7A', bg: '#edf4f0' },
                  { label: 'معلقة', value: req?.pending ?? 0, color: '#8a6a37', bg: '#f7f1e4' },
                  { label: 'مرفوضة', value: req?.rejected ?? 0, color: '#73384B', bg: '#f4e7eb' },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between rounded-[8px] px-2.5 py-1.5" style={{ backgroundColor: s.bg }}>
                    <span className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                    <span className="text-[13px] font-extrabold" style={{ color: s.color }}>{s.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-[8px] bg-[#eef5f4] px-2.5 py-1.5">
                  <span className="text-[11px] font-bold text-[#2A6364]">نسبة التلبية</span>
                  <span className="text-[13px] font-extrabold text-[#2A6364]">{req?.fulfillmentRate ?? 0}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Monthly Bar Chart */}
        <div className="rounded-[20px] border border-[#DADBD9] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[14px] font-extrabold text-[#2A2A2A]">الطلبات الشهرية</div>
            <div className="flex items-center gap-3 text-[10px] text-[#B5BDBE]">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#2A6364]/20 align-middle" />إجمالي</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#2A6364] align-middle" />مصروف</span>
            </div>
          </div>
          {loading ? (
            <div className="h-28 animate-pulse rounded-[10px] bg-[#F0F0F0]" />
          ) : (
            <DualBar data={data?.monthlyTrend ?? []} />
          )}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'هذا الشهر', value: req?.thisMonth ?? 0, color: '#2A6364' },
              { label: 'مصروف كلي', value: req?.issued ?? 0, color: '#4F8F7A' },
              { label: 'نمو %', value: `${req?.growth && req.growth > 0 ? '+' : ''}${req?.growth ?? 0}%`, color: (req?.growth ?? 0) >= 0 ? '#1e6b4c' : '#73384B' },
            ].map((s) => (
              <div key={s.label} className="rounded-[10px] bg-[#F9F9F9] p-2 text-center">
                <div className="text-[16px] font-extrabold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[9px] text-[#B5BDBE]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Secondary metrics row ══ */}
      <div className="grid gap-4 sm:grid-cols-3">

        {/* Users panel */}
        <div className="rounded-[20px] border border-[#DADBD9] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#f4e7eb]">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#73384B]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="3"/><path d="M3 21v-2a7 7 0 0 1 11-5.8"/><circle cx="17" cy="15" r="3"/><path d="M21 21v-1a3 3 0 0 0-5.7-1.3"/>
                </svg>
              </div>
              <span className="text-[14px] font-extrabold text-[#2A2A2A]">المستخدمون</span>
            </div>
            <a href="/materials/users" className="text-[11px] font-semibold text-[#2A6364] hover:underline">إدارة</a>
          </div>
          <div className="flex items-center gap-4">
            <Donut size={90} stroke={14}
              center={{ top: String(data?.users.active ?? 0), bottom: 'نشط' }}
              segments={[
                { color: '#73384B', value: data?.users.managers ?? 0, label: 'مدراء' },
                { color: '#2A6364', value: data?.users.warehouse ?? 0, label: 'مخزن' },
                { color: '#2E6F8E', value: data?.users.employees ?? 0, label: 'موظفون' },
              ]}
            />
            <div className="flex flex-1 flex-col gap-1.5">
              {[
                { label: 'مدراء', value: data?.users.managers ?? 0, color: '#73384B', bg: '#f4e7eb' },
                { label: 'مستودع', value: data?.users.warehouse ?? 0, color: '#2A6364', bg: '#eef5f4' },
                { label: 'موظفون', value: data?.users.employees ?? 0, color: '#2E6F8E', bg: '#e7eff5' },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between rounded-[7px] px-2 py-1.5" style={{ backgroundColor: s.bg }}>
                  <span className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                  <span className="text-[12px] font-extrabold" style={{ color: s.color }}>{s.value}</span>
                </div>
              ))}
              <div className="mt-1 text-center text-[10px] text-[#B5BDBE]">
                إجمالي: {data?.users.total ?? 0} · نشط: {data?.users.active ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* Custody + Returns */}
        <div className="rounded-[20px] border border-[#DADBD9] bg-white p-5">
          <div className="mb-4 text-[14px] font-extrabold text-[#2A2A2A]">العهد والمرتجعات</div>
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#B5BDBE]">العهد</div>
            {[
              { label: 'نشطة', value: cus?.active ?? 0, color: '#2A6364', bg: '#eef5f4' },
              { label: 'متأخرة', value: cus?.overdue ?? 0, color: '#73384B', bg: '#f4e7eb', urgent: (cus?.overdue ?? 0) > 0 },
              { label: 'مُعادة', value: cus?.returned ?? 0, color: '#4F8F7A', bg: '#edf4f0' },
            ].map((s) => (
              <div key={s.label} className={`flex items-center justify-between rounded-[9px] px-3 py-2 ${s.urgent ? 'ring-1 ring-[#73384B]/20' : ''}`} style={{ backgroundColor: s.bg }}>
                <span className="text-[12px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                <span className="text-[16px] font-extrabold" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
            <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-[#B5BDBE]">المرتجعات</div>
            {[
              { label: 'بانتظار التوثيق', value: ret?.pending ?? 0, color: '#8a6a37', bg: '#f7f1e4' },
              { label: 'سليمة', value: ret?.good ?? 0, color: '#1e6b4c', bg: '#e8f5ef' },
              { label: 'مع تلف', value: ret?.damaged ?? 0, color: '#73384B', bg: '#f4e7eb' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between rounded-[9px] px-3 py-2" style={{ backgroundColor: s.bg }}>
                <span className="text-[12px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                <span className="text-[16px] font-extrabold" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rooms */}
        <div className="rounded-[20px] border border-[#DADBD9] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[14px] font-extrabold text-[#2A2A2A]">القاعات</div>
            <a href="/materials/rooms-schedule" className="text-[11px] font-semibold text-[#2A6364] hover:underline">الجدول</a>
          </div>
          <Donut size={100} stroke={16}
            center={{ top: String(data?.rooms.total ?? 0), bottom: 'قاعة' }}
            segments={[
              { color: '#1e6b4c', value: data?.rooms.approved ?? 0, label: 'محجوزة' },
              { color: '#C7B08C', value: data?.rooms.pending ?? 0, label: 'بانتظار' },
              { color: '#DADBD9', value: Math.max((data?.rooms.total ?? 0) - (data?.rooms.approved ?? 0) - (data?.rooms.pending ?? 0), 0), label: 'متاحة' },
            ]}
          />
          <div className="mt-3 space-y-2">
            {[
              { label: 'محجوزة', value: data?.rooms.approved ?? 0, color: '#1e6b4c', bg: '#e8f5ef' },
              { label: 'بانتظار الاعتماد', value: data?.rooms.pending ?? 0, color: '#8a6a37', bg: '#f7f1e4' },
              { label: 'إجمالي القاعات', value: data?.rooms.total ?? 0, color: '#2A6364', bg: '#eef5f4' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between rounded-[9px] px-3 py-2" style={{ backgroundColor: s.bg }}>
                <span className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                <span className="text-[15px] font-extrabold" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Bottom Row: Top Requesters + Audit Log ══ */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Top requesters */}
        <div className="rounded-[20px] border border-[#DADBD9] bg-white p-5">
          <div className="mb-4 text-[14px] font-extrabold text-[#2A2A2A]">أكثر الموظفين طلباً (3 أشهر)</div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 animate-pulse rounded-[10px] bg-[#F0F0F0]" />)}</div>
          ) : !data?.topRequesters?.length ? (
            <div className="py-8 text-center text-[13px] text-[#B5BDBE]">لا توجد بيانات</div>
          ) : (
            <div className="space-y-2">
              {data.topRequesters.map((r, i) => (
                <div key={r.name + i} className="flex items-center gap-3 rounded-[12px] bg-[#F9F9F9] px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2A6364] text-[12px] font-extrabold text-white">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-[#2A2A2A] truncate">{r.name}</div>
                    <div className="text-[11px] text-[#B5BDBE] truncate">{r.department}</div>
                  </div>
                  <div className="shrink-0">
                    <span className="rounded-full bg-[#eef5f4] px-2.5 py-1 text-[12px] font-extrabold text-[#2A6364]">
                      {r.count} طلب
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit log */}
        <div className="rounded-[20px] border border-[#DADBD9] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[14px] font-extrabold text-[#2A2A2A]">سجل التدقيق الأخير</div>
            <a href="/materials/audit-logs" className="text-[11px] font-semibold text-[#2A6364] hover:underline">عرض الكل</a>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3,4].map((i) => <div key={i} className="h-10 animate-pulse rounded-[8px] bg-[#F0F0F0]" />)}</div>
          ) : !data?.recentAudit?.length ? (
            <div className="py-8 text-center text-[13px] text-[#B5BDBE]">لا توجد عمليات</div>
          ) : (
            <div className="space-y-1.5">
              {data.recentAudit.slice(0, 8).map((log) => (
                <div key={log.id} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 hover:bg-[#F9F9F9]">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef5f4]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-[#2A6364]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] font-semibold text-[#2A2A2A]">{ACTION_AR[log.action] || log.action}</span>
                    <span className="mx-1.5 text-[10px] text-[#B5BDBE]">·</span>
                    <span className="text-[11px] text-[#B5BDBE]">{log.userName}</span>
                  </div>
                  <span className="shrink-0 text-[10px] text-[#B5BDBE]">{formatTimeAgo(log.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
