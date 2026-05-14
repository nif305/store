'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';

type AuditRow = {
  id: string;
  source: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: { id: string; fullName?: string; role?: string | null; roles?: string[]; email?: string | null } | null;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch { return '—'; }
}

function normalizeArabic(value: string) {
  return (value || '').toLowerCase().trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '').replace(/\s+/g, ' ');
}

function actionVariant(action: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  const a = action.toLowerCase();
  if (a.includes('delete') || a.includes('remove') || a.includes('reject') || a.includes('cancel')) return 'danger';
  if (a.includes('approve') || a.includes('issue') || a.includes('close') || a.includes('return') || a.includes('complete')) return 'success';
  if (a.includes('update') || a.includes('edit') || a.includes('adjust')) return 'warning';
  if (a.includes('create') || a.includes('add') || a.includes('new')) return 'info';
  return 'neutral';
}

export default function AuditLogsPage() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [days, setDays] = useState('30');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const system = 'materials';

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: '50',
          page: String(pagination.page),
          system,
          days,
        });
        if (actionFilter) params.set('action', actionFilter);
        if (entityFilter) params.set('entity', entityFilter);
        if (search.trim()) params.set('search', search.trim());
        const res = await fetch(`/api/audit-logs?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (mounted) {
          setRows(Array.isArray(json?.data) ? json.data : []);
          setPagination({
            page: Number(json?.pagination?.page || 1),
            totalPages: Number(json?.pagination?.totalPages || 1),
            total: Number(json?.pagination?.total || 0),
          });
        }
      } catch {
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [system, days, actionFilter, entityFilter, search, pagination.page]);

  const filteredRows = useMemo(() => {
    return rows;
  }, [rows]);

  const stats = useMemo(() => ({
    total: pagination.total,
    creates: rows.filter((row) => /create|add|new/i.test(row.action)).length,
    updates: rows.filter((row) => /update|edit|adjust/i.test(row.action)).length,
    decisions: rows.filter((row) => /approve|reject|issue|close|return|complete/i.test(row.action)).length,
  }), [rows, pagination.total]);

  const entityOptions = ['Request', 'ReturnRequest', 'CustodyRecord', 'InventoryItem'];

  function prettyDetails(value?: string | null) {
    if (!value) return '—';
    try {
      const parsed = JSON.parse(value);
      return Object.entries(parsed).map(([key, val]) => `${key}: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`).join('\n');
    } catch {
      return value;
    }
  }

  function goToPage(nextPage: number) {
    setPagination((prev) => ({ ...prev, page: Math.min(Math.max(1, nextPage), Math.max(1, prev.totalPages)) }));
  }

  if (user?.role !== 'manager') {
    return <div className="rounded-[22px] border border-red-200 bg-red-50 p-6 text-center text-red-700">غير مصرح لك بالوصول لهذه الصفحة</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[24px] border border-[#d6d7d4] bg-white px-4 py-4 shadow-sm sm:rounded-[28px] sm:px-5 sm:py-5">
        <div className="space-y-2">
          <h1 className="text-[24px] font-extrabold leading-[1.25] text-[#016564] sm:text-[30px]">{system === 'services' ? 'سجل تدقيق الخدمات' : 'سجل تدقيق المواد'}</h1>
          <p className="text-[13px] leading-7 text-[#61706f] sm:text-sm">سجل تدقيق محسّن مع تصفية حسب النظام والزمن والكيان والإجراء، لعرض السجلات الصحيحة فقط دون ضوضاء.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none"><div className="text-[12px] text-[#6f7b7a]">إجمالي السجلات</div><div className="mt-1 text-[22px] font-extrabold text-[#016564]">{stats.total}</div></Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none"><div className="text-[12px] text-[#6f7b7a]">عمليات الإنشاء</div><div className="mt-1 text-[22px] font-extrabold text-[#016564]">{stats.creates}</div></Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none"><div className="text-[12px] text-[#6f7b7a]">عمليات التعديل</div><div className="mt-1 text-[22px] font-extrabold text-[#d0b284]">{stats.updates}</div></Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none"><div className="text-[12px] text-[#6f7b7a]">القرارات والإقفالات</div><div className="mt-1 text-[22px] font-extrabold text-[#498983]">{stats.decisions}</div></Card>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#d6d7d4] bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
        <div className="grid gap-3 xl:grid-cols-4">
          <Input label="بحث في السجل" value={search} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setSearch(e.target.value); }} placeholder="الإجراء، الكيان، الرقم المرجعي، اسم المستخدم، أو الملاحظات" />
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">الفترة</label>
            <select value={days} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setDays(e.target.value); }} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10">
              <option value="7">آخر 7 أيام</option>
              <option value="30">آخر 30 يومًا</option>
              <option value="90">آخر 90 يومًا</option>
              <option value="0">كل الفترات</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">الإجراء</label>
            <input value={actionFilter} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setActionFilter(e.target.value); }} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10" placeholder="مثل APPROVE أو CREATE" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">الكيان</label>
            <select value={entityFilter} onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setEntityFilter(e.target.value); }} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10">
              <option value="">كل الكيانات</option>
              {entityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {loading ? <div className="space-y-3">{[1,2,3].map((item) => <Skeleton key={item} className="h-32 w-full rounded-[24px]" />)}</div> : filteredRows.length === 0 ? (
          <Card className="rounded-[24px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm">لا توجد سجلات مطابقة</Card>
        ) : filteredRows.map((row) => (
          <Card key={row.id} className="rounded-[24px] border border-[#d6d7d4] p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={actionVariant(row.action)}>{row.action}</Badge>
                  {row.entity ? <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-700">{row.entity}</span> : null}
                  {row.entityId ? <span className="rounded-full bg-[#016564]/10 px-3 py-1 text-[11px] text-[#016564]">{row.entityId}</span> : null}
                </div>
                <div className="grid gap-2 text-sm text-[#425554] sm:grid-cols-2 xl:grid-cols-3">
                  <div><span className="font-semibold text-[#016564]">المنفذ: </span>{row.user?.fullName || 'غير معروف'}</div>
                  <div><span className="font-semibold text-[#016564]">الدور: </span>{row.user?.role || '—'}</div>
                  <div><span className="font-semibold text-[#016564]">الوقت: </span>{formatDate(row.createdAt)}</div>
                </div>
                {row.details ? <p className="text-sm leading-7 text-[#61706f] whitespace-pre-wrap">{prettyDetails(row.details)}</p> : null}
              </div>
              <div className="flex w-full flex-col gap-2 lg:w-auto"><Button className="w-full lg:w-36" onClick={() => setSelected(row)}>فتح التفاصيل</Button></div>
            </div>
          </Card>
        ))}
      </section>

      {!loading && pagination.totalPages > 1 ? (
        <section className="flex items-center justify-between rounded-[24px] border border-[#d6d7d4] bg-white px-4 py-3 shadow-sm">
          <button type="button" onClick={() => goToPage(pagination.page - 1)} disabled={pagination.page <= 1} className="rounded-full border border-[#d6d7d4] px-4 py-2 text-sm font-bold text-[#425554] disabled:cursor-not-allowed disabled:opacity-40">السابق</button>
          <div className="text-sm font-bold text-[#016564]">الصفحة {pagination.page} من {pagination.totalPages}</div>
          <button type="button" onClick={() => goToPage(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="rounded-full border border-[#d6d7d4] px-4 py-2 text-sm font-bold text-[#425554] disabled:cursor-not-allowed disabled:opacity-40">التالي</button>
        </section>
      ) : null}

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? `تفاصيل السجل: ${selected.action}` : 'تفاصيل السجل'} maxWidth="4xl">
        {selected ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['الإجراء', selected.action],
              ['الكيان', selected.entity || '—'],
              ['الرقم المرجعي', selected.entityId || '—'],
              ['المصدر', selected.source || 'SERVER'],
              ['المنفذ', selected.user?.fullName || '—'],
              ['البريد الإلكتروني', selected.user?.email || '—'],
              ['الدور', selected.user?.role || '—'],
              ['الوقت', formatDate(selected.createdAt)],
              ['عنوان IP', selected.ipAddress || '—'],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-[#e7ebea] bg-[#fcfdfd] p-3">
                <div className="text-xs font-bold text-[#016564]">{label}</div>
                <div className="mt-1 break-words text-sm text-[#425554]">{value}</div>
              </div>
            ))}
            <div className="sm:col-span-2 rounded-2xl border border-[#e7ebea] bg-[#fcfdfd] p-3">
              <div className="text-xs font-bold text-[#016564]">التفاصيل</div>
              <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-7 text-[#425554]">{prettyDetails(selected.details)}</div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
