'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';

function normalizeArabic(v: string) {
  return (v || '').toLowerCase().trim()
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '').replace(/\s+/g, ' ');
}

function fmt(n: number | undefined | null) {
  return new Intl.NumberFormat('ar-SA').format(n ?? 0);
}

/* ── Shared primitives ── */
function KpiCard({ label, value, sub, color = '#2A6364', icon }: { label: string; value: string | number; sub?: string; color?: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[18px] border border-[#edf2f1] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]" style={{ backgroundColor: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-[#7a8a88]">{label}</div>
        <div className="mt-0.5 text-[22px] font-extrabold leading-none" style={{ color }}>{typeof value === 'number' ? fmt(value) : value}</div>
        {sub && <div className="mt-1 text-[10px] text-[#9aacaa]">{sub}</div>}
      </div>
    </div>
  );
}

function BarRow({ label, value, max, color = '#2A6364', badge }: { label: string; value: number; max: number; color?: string; badge?: React.ReactNode }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <div className="flex items-center gap-2 min-w-0">
          {badge}
          <span className="truncate font-semibold text-[#2a4444]">{label}</span>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: `${color}15`, color }}>{fmt(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#edf3f2]">
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[17px] font-extrabold text-[#223738]">{title}</h2>
        {sub && <p className="mt-0.5 text-[12px] text-[#7a8a88]">{sub}</p>}
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'بانتظار الصرف', APPROVED: 'معتمد', REJECTED: 'مرفوض',
  ISSUED: 'مصروف', RETURNED: 'معاد', DRAFT: 'مسودة',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: '#8a6a37', APPROVED: '#2A6364', REJECTED: '#7c1e3e',
  ISSUED: '#1e6b4c', RETURNED: '#1b4f68', DRAFT: '#9aacaa',
};

/* ── Main page ── */
export default function ReportsPage() {
  const pathname = usePathname();
  const { user } = useAuth();
  const system = pathname?.startsWith('/services') ? 'services' : 'materials';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('year');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/reports/summary?system=${system}&period=${period}`, { cache: 'no-store' })
      .then((r) => r.json().catch(() => null))
      .then((json) => { if (mounted) setData(json && !json.error ? json : null); })
      .catch(() => { if (mounted) setData(null); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [system, period]);

  const q = normalizeArabic(search);
  const filteredTopItems = useMemo(() => (data?.topConsumedItems || []).filter((i: any) => normalizeArabic(`${i.name} ${i.code}`).includes(q)), [data, q]);
  const filteredTopUsers = useMemo(() => (data?.topIssuedUsers || data?.topRequesters || []).filter((i: any) => normalizeArabic(`${i.fullName} ${i.department}`).includes(q)), [data, q]);
  const filteredRecent = useMemo(() => (data?.recentRequests || []).filter((i: any) => normalizeArabic(`${i.code || ''} ${i.requesterName || ''} ${i.department || ''}`).includes(q)), [data, q]);

  if (user?.role !== 'manager') {
    return (
      <div className="rounded-[22px] border border-[#ecd0d8] bg-[#fff7f8] p-8 text-center">
        <div className="text-[#7c1e3e]">غير مصرح لك بالوصول لهذه الصفحة</div>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <section className="overflow-hidden rounded-[20px] bg-gradient-to-l from-[#1c3a2c] to-[#2A6364] p-5 text-white shadow-[0_12px_32px_rgba(42,99,100,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/15">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 20V10M12 20V4M6 20v-6"/>
              </svg>
            </div>
            <div>
              <h1 className="text-[20px] font-extrabold text-white">
                {system === 'services' ? 'تقارير الخدمات' : 'تقارير المواد والمخزون'}
              </h1>
              <div className="text-[11px] text-white/50">لوحة تحليلية شاملة</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..."
                className="h-9 rounded-full border border-white/20 bg-white/10 pr-8 pl-3 text-[12px] text-white placeholder-white/30 outline-none focus:border-white/40 w-40" />
            </div>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}
              className="h-9 rounded-full border border-white/20 bg-white/10 px-3 text-[12px] text-white outline-none focus:border-white/40">
              <option value="year" className="bg-white text-black">من بداية السنة</option>
              <option value="30d" className="bg-white text-black">آخر 30 يوم</option>
              <option value="90d" className="bg-white text-black">آخر 90 يوم</option>
              <option value="all" className="bg-white text-black">كل الفترات</option>
            </select>
          </div>
        </div>
      </section>

      {loading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-20 rounded-[18px]" />)}</div>
          {[1,2,3].map((i) => <Skeleton key={`s${i}`} className="h-64 rounded-[20px]" />)}
        </div>
      ) : system === 'services' ? (
        <ServicesReport data={data} filteredTopUsers={filteredTopUsers} filteredRecent={filteredRecent} filteredDrafts={(data?.externalDrafts || []).filter((i: any) => normalizeArabic(`${i.subject} ${i.recipient}`).includes(q))} />
      ) : (
        <MaterialsReport data={data} filteredTopItems={filteredTopItems} filteredTopUsers={filteredTopUsers} filteredRecent={filteredRecent} />
      )}
    </div>
  );
}

/* ── Materials Report ── */
function MaterialsReport({ data, filteredTopItems, filteredTopUsers, filteredRecent }: { data: any; filteredTopItems: any[]; filteredTopUsers: any[]; filteredRecent: any[] }) {
  const reqMax = Math.max(data.requestsByStatus?.pending || 0, data.requestsByStatus?.issued || 0, data.requestsByStatus?.returned || 0, data.requestsByStatus?.rejected || 0, 1);
  const itemMax = filteredTopItems.length > 0 ? Math.max(...filteredTopItems.map((i: any) => i.quantity)) : 1;
  const userMax = filteredTopUsers.length > 0 ? Math.max(...filteredTopUsers.map((i: any) => i.quantity)) : 1;

  return (
    <>
      {/* KPI row 1 — inventory */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="إجمالي أصناف المخزون" value={data.totalItems} color="#2A6364"
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></svg>} />
        <KpiCard label="صحة المخزون" value={`${data.healthPercentage}%`} color={data.healthPercentage > 70 ? '#1e6b4c' : data.healthPercentage > 40 ? '#8a6a37' : '#7c1e3e'}
          sub={`${data.lowStockItems} منخفض — ${data.outOfStockItems} نافد`}
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z" /><path d="M9 12l2 2 4-4" /></svg>} />
        <KpiCard label="مستهلكة / مسترجعة" value={`${fmt(data.consumableCount)} / ${fmt(data.returnableCount)}`} color="#1b4f68"
          sub="مستهلكة تُخصم عند الصرف — مسترجعة تُولّد عهدة"
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></svg>} />
        <KpiCard label="العهد النشطة" value={data.activeCustody} color="#8a6a37"
          sub={data.overdueCustody > 0 ? `${fmt(data.overdueCustody)} متأخرة التسليم` : 'لا متأخرات'}
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z" /></svg>} />
      </section>

      {/* KPI row 2 — requests */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="طلبات بانتظار الصرف" value={data.requestsByStatus?.pending || 0} color="#8a6a37"
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>} />
        <KpiCard label="طلبات مصروفة" value={data.requestsByStatus?.issued || 0} color="#1e6b4c"
          sub={`${fmt(data.totalIssuedQuantityYTD)} وحدة إجمالاً`}
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>} />
        <KpiCard label="وحدات مستهلكة" value={data.totalConsumedQuantityYTD || 0} color="#7c1e3e"
          sub="مواد مستهلكة تم صرفها في الفترة"
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>} />
        <KpiCard label="وحدات معادة" value={data.totalReturnedQuantityYTD || 0} color="#2A6364"
          sub="مواد مسترجعة رُدّت في الفترة"
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 9H5V5" /><path d="M5 9C6.8 6.6 9 5.5 12 5.5c4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4" /></svg>} />
      </section>

      {/* Inventory health + request flow */}
      <section className="grid gap-4 xl:grid-cols-2">
        {/* Inventory breakdown */}
        <div className="rounded-[20px] border border-[#dce6e3] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
          <SectionHeader title="تصنيف المخزون" sub="توزيع الأصناف حسب الحالة والنوع" />
          <div className="space-y-3">
            <BarRow label="أصناف متاحة" value={data.totalItems - data.lowStockItems - data.outOfStockItems} max={data.totalItems} color="#1e6b4c"
              badge={<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#1e6b4c]" />} />
            <BarRow label="أصناف منخفضة" value={data.lowStockItems} max={data.totalItems} color="#8a6a37"
              badge={<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#8a6a37]" />} />
            <BarRow label="أصناف نافدة" value={data.outOfStockItems} max={data.totalItems} color="#7c1e3e"
              badge={<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#7c1e3e]" />} />
            <div className="my-3 border-t border-[#edf2f1]" />
            <BarRow label="مواد مستهلكة" value={data.consumableCount} max={data.totalItems} color="#b79059"
              badge={<span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#fbf6ea] text-[8px] font-bold text-[#8a6a37]">ص</span>} />
            <BarRow label="مواد مسترجعة" value={data.returnableCount} max={data.totalItems} color="#2A6364"
              badge={<span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#eef5f4] text-[8px] font-bold text-[#2A6364]">ع</span>} />
          </div>

          {/* Donut visual */}
          <div className="mt-5 flex items-center justify-center gap-6">
            <HealthDonut healthy={data.totalItems - data.lowStockItems - data.outOfStockItems} low={data.lowStockItems} out={data.outOfStockItems} total={data.totalItems} />
            <div className="space-y-2">
              {[['متاحة', '#1e6b4c', data.totalItems - data.lowStockItems - data.outOfStockItems], ['منخفضة', '#8a6a37', data.lowStockItems], ['نافدة', '#7c1e3e', data.outOfStockItems]].map(([label, color, val]) => (
                <div key={String(label)} className="flex items-center gap-2 text-[12px]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: String(color) }} />
                  <span className="text-[#4a5e5d]">{label}</span>
                  <span className="font-bold" style={{ color: String(color) }}>{fmt(Number(val))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Request flow */}
        <div className="rounded-[20px] border border-[#dce6e3] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
          <SectionHeader title="تدفق الطلبات" sub="حالات الطلبات في الفترة المحددة" />
          <div className="space-y-3">
            {[
              ['بانتظار الصرف', data.requestsByStatus?.pending || 0, '#8a6a37'],
              ['مصروفة', data.requestsByStatus?.issued || 0, '#1e6b4c'],
              ['معادة', data.requestsByStatus?.returned || 0, '#2A6364'],
              ['مرفوضة', data.requestsByStatus?.rejected || 0, '#7c1e3e'],
            ].map(([label, val, color]) => (
              <BarRow key={String(label)} label={String(label)} value={Number(val)} max={reqMax} color={String(color)}
                badge={<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: String(color) }} />} />
            ))}
          </div>
          {/* Custody overdue alert */}
          {data.overdueCustody > 0 && (
            <div className="mt-5 flex items-start gap-3 rounded-[14px] border border-[#ecd0d8] bg-[#fff7f8] px-4 py-3">
              <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-[#7c1e3e]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
              <div>
                <p className="text-[13px] font-bold text-[#7c1e3e]">{fmt(data.overdueCustody)} عهدة متأخرة التسليم</p>
                <p className="mt-0.5 text-[11px] text-[#9a5065]">يُنصح بمراجعة العهد النشطة والتواصل مع أصحابها</p>
              </div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[14px] border border-[#dce6e3] bg-[#f8fbfb] px-4 py-3 text-center">
              <div className="text-[10px] font-semibold text-[#9aacaa]">إجمالي وحدات صُرفت</div>
              <div className="mt-1 text-[20px] font-extrabold text-[#1e6b4c]">{fmt(data.totalIssuedQuantityYTD)}</div>
            </div>
            <div className="rounded-[14px] border border-[#dce6e3] bg-[#f8fbfb] px-4 py-3 text-center">
              <div className="text-[10px] font-semibold text-[#9aacaa]">وحدات استُهلكت</div>
              <div className="mt-1 text-[20px] font-extrabold text-[#7c1e3e]">{fmt(data.totalConsumedQuantityYTD)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Top consumed items + top users */}
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[20px] border border-[#dce6e3] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
          <SectionHeader title="أكثر المواد استهلاكاً" sub="مرتبة حسب الكميات المصروفة في الفترة" />
          {filteredTopItems.length ? (
            <div className="space-y-3">
              {filteredTopItems.slice(0, 8).map((item: any, idx: number) => (
                <BarRow key={item.itemId} label={item.name} value={item.quantity} max={itemMax} color="#7c1e3e"
                  badge={
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f4e7eb] text-[10px] font-extrabold text-[#7c1e3e]">{idx + 1}</span>
                  } />
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-[13px] text-[#9aacaa]">لا توجد بيانات في هذه الفترة</div>
          )}
        </div>

        <div className="rounded-[20px] border border-[#dce6e3] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
          <SectionHeader title="أكثر المستفيدين صرفاً" sub="مرتبون حسب إجمالي الوحدات المصروفة" />
          {filteredTopUsers.length ? (
            <div className="space-y-3">
              {filteredTopUsers.slice(0, 8).map((item: any, idx: number) => (
                <div key={item.userId} className="flex items-center gap-3 rounded-[12px] border border-[#edf2f1] bg-[#f8fbfb] px-3.5 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2A6364] text-[11px] font-extrabold text-white">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-[#223738]">{item.fullName}</div>
                    <div className="text-[11px] text-[#6d7b78]">{item.department}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#eef5f4] px-2.5 py-0.5 text-[12px] font-extrabold text-[#2A6364]">{fmt(item.quantity)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-[13px] text-[#9aacaa]">لا توجد بيانات في هذه الفترة</div>
          )}
        </div>
      </section>

      {/* Recent requests */}
      <section className="rounded-[20px] border border-[#dce6e3] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
        <SectionHeader title="أحدث طلبات المواد" sub="آخر الطلبات المسجلة في النظام" />
        {filteredRecent.length ? (
          <div className="overflow-hidden rounded-[14px] border border-[#edf2f1]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#f4f8f7] text-[11px] text-[#2A6364]">
                  <th className="px-4 py-2.5 text-right font-bold">رقم الطلب</th>
                  <th className="px-4 py-2.5 text-right font-bold">الموظف</th>
                  <th className="px-4 py-2.5 text-right font-bold">الجهة</th>
                  <th className="px-4 py-2.5 text-center font-bold">البنود</th>
                  <th className="px-4 py-2.5 text-right font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f4f3]">
                {filteredRecent.map((item: any) => (
                  <tr key={item.id} className="hover:bg-[#f8fbfb]">
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-[#eef5f4] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#2A6364]">{item.code}</span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-[#223738]">{item.requesterName}</td>
                    <td className="px-4 py-2.5 text-[#6d7b78]">{item.department}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-[#2A6364]">{item.itemCount}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: `${STATUS_COLORS[item.status] || '#9aacaa'}18`, color: STATUS_COLORS[item.status] || '#9aacaa' }}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center text-[13px] text-[#9aacaa]">لا توجد طلبات مطابقة</div>
        )}
      </section>

      {/* CONSUMABLE vs RETURNABLE info box */}
      <section className="rounded-[20px] border border-[#d9c99f] bg-[#fffbf0] p-5">
        <div className="flex items-start gap-3">
          <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-5 w-5 shrink-0 text-[#8a6a37]" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <div>
            <p className="text-[13px] font-bold text-[#7f6b43]">دليل تصنيف المواد</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-[10px] border border-[#e8ddbf] bg-white px-3 py-2">
                <p className="text-[12px] font-bold text-[#8a6a37]">مواد مستهلكة (CONSUMABLE)</p>
                <p className="mt-0.5 text-[11px] text-[#7f6b43]">أقلام، نوت، ملفات، ورق... تُخصم من المخزون عند الصرف ولا تُعاد. لا عهدة.</p>
              </div>
              <div className="rounded-[10px] border border-[#cce6d7] bg-white px-3 py-2">
                <p className="text-[12px] font-bold text-[#1e6b4c]">مواد مسترجعة (RETURNABLE)</p>
                <p className="mt-0.5 text-[11px] text-[#2f6f4f]">أجهزة، لوحات، معدات... تُولّد عهدة عند الصرف وتُعاد بعد الاستخدام.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ── Services Report (kept minimal) ── */
function ServicesReport({ data, filteredTopUsers, filteredRecent, filteredDrafts }: { data: any; filteredTopUsers: any[]; filteredRecent: any[]; filteredDrafts: any[] }) {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="إجمالي طلبات الخدمات" value={data.totalRequests} color="#2A6364"
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></svg>} />
        <KpiCard label="طلبات نشطة" value={data.activeRequests} color="#1e6b4c"
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>} />
        <KpiCard label="بانتظار المدير" value={data.pendingManager} color="#8a6a37"
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>} />
        <KpiCard label="مسودات خارجية نشطة" value={data.activeDrafts} color="#7c1e3e"
          icon={<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>} />
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[20px] border border-[#dce6e3] p-5 shadow-sm">
          <SectionHeader title="أكثر الجهات رفعاً للطلبات" />
          {filteredTopUsers.length ? filteredTopUsers.slice(0, 6).map((item: any, i: number) => (
            <div key={item.userId} className="mt-2 flex items-center gap-3 rounded-[12px] border border-[#edf2f1] bg-[#f8fbfb] px-3 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2A6364] text-[10px] font-bold text-white">{i+1}</span>
              <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold text-[#223738]">{item.fullName}</div><div className="text-[11px] text-[#6d7b78]">{item.department}</div></div>
              <span className="shrink-0 text-[13px] font-bold text-[#2A6364]">{fmt(item.quantity)}</span>
            </div>
          )) : <div className="py-8 text-center text-[13px] text-[#9aacaa]">لا توجد بيانات</div>}
        </Card>
        <Card className="rounded-[20px] border border-[#dce6e3] p-5 shadow-sm">
          <SectionHeader title="المراسلات الخارجية النشطة" />
          {filteredDrafts.length ? filteredDrafts.slice(0, 6).map((item: any) => (
            <div key={item.id} className="mt-2 rounded-[12px] border border-[#edf2f1] bg-[#f8fbfb] px-3 py-2">
              <div className="text-[13px] font-bold text-[#223738]">{item.subject}</div>
              <div className="mt-0.5 text-[11px] text-[#6d7b78]">{item.recipient}</div>
            </div>
          )) : <div className="py-8 text-center text-[13px] text-[#9aacaa]">لا توجد مراسلات نشطة</div>}
        </Card>
      </section>
    </>
  );
}

/* ── Donut chart ── */
function HealthDonut({ healthy, low, out, total }: { healthy: number; low: number; out: number; total: number }) {
  const r = 44; const c = 2 * Math.PI * r;
  const seg = (n: number) => total > 0 ? (n / total) * c : 0;
  let off = 0;
  const segs = [
    { color: '#1e6b4c', dash: seg(healthy) },
    { color: '#8a6a37', dash: seg(low) },
    { color: '#7c1e3e', dash: seg(out) },
  ];
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#edf3f2" strokeWidth="12" />
        {segs.map((s, i) => {
          const el = (
            <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="12"
              strokeDasharray={`${s.dash} ${c - s.dash}`} strokeDashoffset={-off} strokeLinecap="round" />
          );
          off += s.dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[10px] text-[#9aacaa]">صحة</div>
        <div className="text-[15px] font-extrabold text-[#223738]">{total > 0 ? Math.round((healthy / total) * 100) : 0}%</div>
      </div>
    </div>
  );
}
