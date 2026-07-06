'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';

type AuditRow = {
  id: string; source: string; action: string; entity: string;
  entityId?: string | null; details?: string | null; ipAddress?: string | null;
  createdAt: string;
  user?: { id: string; fullName?: string; role?: string | null; roles?: string[]; email?: string | null } | null;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
  catch { return '—'; }
}
function formatTimeAgo(date: string, lang = 'ar') {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (lang === 'en') {
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  return `منذ ${Math.floor(h / 24)} ي`;
}

const ACTION_LABELS_AR: Record<string, string> = {
  TRAINER_NEED_CREATED: 'إنشاء احتياج مدرب', TRAINER_NEED_ASSIGNED: 'تعيين منسق',
  TRAINER_NEED_UNASSIGNED: 'إلغاء تعيين', TRAINER_NEED_CONVERTED_TO_REQUEST: 'تحويل لطلب مواد',
  TRAINER_NEED_EXTERNAL_SOURCING: 'تأمين خارجي', TRAINER_NEED_UPDATED: 'تعديل احتياج',
  TRAINER_NEED_CANCELLED: 'إلغاء احتياج', CREATE_REQUEST: 'طلب جديد',
  ISSUE_REQUEST: 'صرف طلب', REJECT_REQUEST: 'رفض طلب', CANCEL_REQUEST: 'إلغاء طلب',
  APPROVE_RETURN: 'قبول مرتجع', REJECT_RETURN: 'رفض مرتجع', CREATE_RETURN: 'طلب إرجاع',
  UPDATE_INVENTORY: 'تحديث مخزون', SYNC_INVENTORY: 'مزامنة المخزون',
  ASSIGN_CUSTODY: 'تعيين عهدة', RETURN_CUSTODY: 'إعادة عهدة',
  SYNC_SMART_ALERTS: 'مزامنة تنبيهات', CREATE_USER: 'إنشاء مستخدم',
  UPDATE_USER: 'تعديل مستخدم', TOGGLE_USER_STATUS: 'تغيير حالة مستخدم',
};

const ACTION_LABELS_EN: Record<string, string> = {
  TRAINER_NEED_CREATED: 'Trainer Need Created', TRAINER_NEED_ASSIGNED: 'Coordinator Assigned',
  TRAINER_NEED_UNASSIGNED: 'Unassigned', TRAINER_NEED_CONVERTED_TO_REQUEST: 'Converted to Request',
  TRAINER_NEED_EXTERNAL_SOURCING: 'External Sourcing', TRAINER_NEED_UPDATED: 'Need Updated',
  TRAINER_NEED_CANCELLED: 'Need Cancelled', CREATE_REQUEST: 'New Request',
  ISSUE_REQUEST: 'Request Issued', REJECT_REQUEST: 'Request Rejected', CANCEL_REQUEST: 'Request Cancelled',
  APPROVE_RETURN: 'Return Approved', REJECT_RETURN: 'Return Rejected', CREATE_RETURN: 'Return Created',
  UPDATE_INVENTORY: 'Inventory Updated', SYNC_INVENTORY: 'Inventory Synced',
  ASSIGN_CUSTODY: 'Custody Assigned', RETURN_CUSTODY: 'Custody Returned',
  SYNC_SMART_ALERTS: 'Alerts Synced', CREATE_USER: 'User Created',
  UPDATE_USER: 'User Updated', TOGGLE_USER_STATUS: 'User Status Changed',
};

const ENTITY_LABELS_AR: Record<string, string> = {
  TrainerNeed: 'احتياج مدرب', Request: 'طلب مواد', ReturnRequest: 'طلب إرجاع',
  CustodyRecord: 'عهدة', InventoryItem: 'مادة مخزون', Notification: 'إشعار',
  User: 'مستخدم', AuditLog: 'سجل تدقيق',
};

const ENTITY_LABELS_EN: Record<string, string> = {
  TrainerNeed: 'Trainer Need', Request: 'Material Request', ReturnRequest: 'Return Request',
  CustodyRecord: 'Custody Record', InventoryItem: 'Inventory Item', Notification: 'Notification',
  User: 'User', AuditLog: 'Audit Log',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'الاسم', quantity: 'الكمية', availableQty: 'المتاح', category: 'الفئة',
  type: 'النوع', code: 'الرمز', status: 'الحالة', purpose: 'الغرض',
  notes: 'ملاحظات', fullName: 'اسم المنفذ', department: 'الجهة',
  source: 'المصدر', intervalMinutes: 'الفاصل الزمني (دقيقة)',
  role: 'الدور', before: 'قبل', after: 'بعد',
};

function actionLabel(action: string, lang = 'ar') {
  const labels = lang === 'en' ? ACTION_LABELS_EN : ACTION_LABELS_AR;
  return labels[action] || action.replace(/_/g, ' ');
}
function entityLabel(entity: string, lang = 'ar') {
  const labels = lang === 'en' ? ENTITY_LABELS_EN : ENTITY_LABELS_AR;
  return labels[entity] || entity;
}

function actionColor(action: string): { color: string; bg: string } {
  const a = action.toUpperCase();
  if (/DELETE|REMOVE|REJECT|CANCEL|UNASSIGN/.test(a)) return { color: '#73384B', bg: '#f4e7eb' };
  if (/APPROVE|ISSUE|CLOSE|RETURN|COMPLETE|CONVERT/.test(a)) return { color: '#1e6b4c', bg: '#e8f5ef' };
  if (/UPDATE|EDIT|ADJUST|ASSIGN|SYNC/.test(a)) return { color: '#8a6a37', bg: '#f7f1e4' };
  if (/CREATE|ADD|NEW/.test(a)) return { color: '#2A6364', bg: '#eef5f4' };
  return { color: '#5A5A5A', bg: '#F0F0F0' };
}

function parseDetails(raw?: string | null): { summary: string; fields: [string, string][]; hasDiff: boolean; before?: Record<string, unknown>; after?: Record<string, unknown> } {
  if (!raw) return { summary: '', fields: [], hasDiff: false };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const hasDiff = 'before' in parsed || 'after' in parsed;
    const before = typeof parsed.before === 'object' && parsed.before ? parsed.before as Record<string, unknown> : undefined;
    const after = typeof parsed.after === 'object' && parsed.after ? parsed.after as Record<string, unknown> : undefined;
    const summary = typeof parsed.name === 'string' ? parsed.name : typeof parsed.purpose === 'string' ? parsed.purpose : '';
    const fields: [string, string][] = Object.entries(parsed)
      .filter(([k]) => !['before', 'after', 'source'].includes(k))
      .map(([k, v]) => [FIELD_LABELS[k] || k, typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')]);
    return { summary, fields, hasDiff, before, after };
  } catch {
    return { summary: raw.slice(0, 80), fields: [], hasDiff: false };
  }
}

const entityOptions = ['TrainerNeed', 'Request', 'ReturnRequest', 'CustodyRecord', 'InventoryItem', 'User'];

export default function AuditLogsPage() {
  const { user } = useAuth();
  const { language } = useI18n();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [days, setDays] = useState('30');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '50', page: String(pagination.page), system: 'materials', days });
        if (actionFilter) params.set('action', actionFilter);
        if (entityFilter) params.set('entity', entityFilter);
        if (search.trim()) params.set('search', search.trim());
        const res = await fetch(`/api/audit-logs?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (mounted) {
          setRows(Array.isArray(json?.data) ? json.data : []);
          setPagination({ page: Number(json?.pagination?.page || 1), totalPages: Number(json?.pagination?.totalPages || 1), total: Number(json?.pagination?.total || 0) });
        }
      } catch { if (mounted) setRows([]); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [days, actionFilter, entityFilter, search, pagination.page]);

  const stats = useMemo(() => ({
    total: pagination.total,
    creates: rows.filter((r) => /create|add|new/i.test(r.action)).length,
    updates: rows.filter((r) => /update|edit|adjust|sync/i.test(r.action)).length,
    decisions: rows.filter((r) => /approve|reject|issue|close|return|complete|convert/i.test(r.action)).length,
  }), [rows, pagination.total]);

  if (user?.role !== 'manager') {
    return <div className="rounded-[16px] border border-[#ecd0d8] bg-[#fff7f8] p-6 text-center text-[13px] text-[#73384B]">غير مصرح لك بالوصول لهذه الصفحة</div>;
  }

  function goToPage(n: number) { setPagination((p) => ({ ...p, page: Math.min(Math.max(1, n), Math.max(1, p.totalPages)) })); }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <section className="overflow-hidden rounded-[20px] bg-gradient-to-l from-[#1c2b3a] to-[#2E4A6A] p-5 text-white shadow-[0_12px_32px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/15">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
              </svg>
            </div>
            <div>
              <h1 className="text-[20px] font-extrabold">سجل التدقيق</h1>
              <div className="text-[11px] text-white/50">{stats.total} سجل في هذه الفترة</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['إنشاء', stats.creates, '#4ade80'], ['تعديل', stats.updates, '#fbbf24'], ['قرارات', stats.decisions, '#60a5fa']].map(([l, v, c]) => (
              <div key={l as string} className="rounded-[10px] border border-white/10 bg-white/8 px-3 py-2">
                <div className="text-[18px] font-extrabold" style={{ color: c as string }}>{v as number}</div>
                <div className="text-[10px] text-white/40">{l as string}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="relative sm:col-span-1">
            <svg viewBox="0 0 24 24" fill="none" className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={(e) => { setPagination((p) => ({ ...p, page: 1 })); setSearch(e.target.value); }}
              placeholder="بحث باسم المستخدم أو الكيان..."
              className="h-9 w-full rounded-full border border-white/20 bg-white/10 pr-8 pl-3 text-[12px] text-white placeholder-white/30 outline-none focus:border-white/40" />
          </div>
          {[
            { value: days, onChange: (v: string) => { setPagination((p) => ({...p,page:1})); setDays(v); }, options: [['7','آخر 7 أيام'],['30','آخر 30 يوماً'],['90','آخر 90 يوماً'],['0','كل الفترات']] },
            { value: entityFilter, onChange: (v: string) => { setPagination((p) => ({...p,page:1})); setEntityFilter(v); }, options: [['', language === 'en' ? 'All entities' : 'كل الكيانات'], ...entityOptions.map((e) => [e, entityLabel(e, language)])] },
            { value: actionFilter, onChange: (v: string) => { setPagination((p) => ({...p,page:1})); setActionFilter(v); }, options: [['', language === 'en' ? 'All actions' : 'كل الإجراءات'], ...Object.entries(language === 'en' ? ACTION_LABELS_EN : ACTION_LABELS_AR).map(([k,v]) => [k, v])] },
          ].map((sel, i) => (
            <select key={i} value={sel.value} onChange={(e) => sel.onChange(e.target.value)}
              className="h-9 rounded-full border border-white/20 bg-white/10 px-3 text-[12px] text-white outline-none focus:border-white/40">
              {(sel.options as [string,string][]).map(([v,l]) => <option key={v} value={v} className="text-black bg-white">{l}</option>)}
            </select>
          ))}
        </div>
      </section>

      {/* Log entries */}
      <div className="overflow-hidden rounded-[16px] border border-[#DADBD9] bg-white">
        {loading ? (
          <div className="space-y-0">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="flex items-center gap-3 border-b border-[#F0F0F0] px-4 py-4">
                <div className="h-8 w-8 animate-pulse rounded-full bg-[#F0F0F0]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 animate-pulse rounded bg-[#F0F0F0]" />
                  <div className="h-2.5 w-48 animate-pulse rounded bg-[#F0F0F0]" />
                </div>
                <div className="h-2.5 w-12 animate-pulse rounded bg-[#F0F0F0]" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12 text-[#DADBD9]" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
            </svg>
            <p className="mt-3 text-[13px] text-[#B5BDBE]">لا توجد سجلات مطابقة</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0F0F0]">
            {rows.map((row) => {
              const ac = actionColor(row.action);
              const parsed = parseDetails(row.details);
              const userRole = row.user?.roles?.[0] || row.user?.role || '';
              const roleLabel = language === 'en'
                ? (userRole === 'MANAGER' ? 'Manager' : userRole === 'WAREHOUSE' ? 'Warehouse' : userRole === 'USER' ? 'Employee' : '')
                : (userRole === 'MANAGER' ? 'مدير' : userRole === 'WAREHOUSE' ? 'مستودع' : userRole === 'USER' ? 'موظف' : '');
              return (
                <div key={row.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#FAFAFA]">
                  {/* Action badge */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: ac.bg }}>
                    <span className="text-[9px] font-extrabold" style={{ color: ac.color }}>
                      {actionLabel(row.action, language).slice(0, 2)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: ac.bg, color: ac.color }}>
                        {actionLabel(row.action, language)}
                      </span>
                      <span className="rounded-full bg-[#F0F0F0] px-2 py-0.5 text-[10px] text-[#5A5A5A]">
                        {entityLabel(row.entity, language)}
                      </span>
                      {row.entityId && (
                        <span className="font-mono text-[10px] text-[#B5BDBE]">
                          #{row.entityId.slice(-8)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-[#B5BDBE]">
                      <span className="font-semibold text-[#5A5A5A]">{row.user?.fullName || 'النظام'}</span>
                      {roleLabel && <span className="rounded-full bg-[#F0F0F0] px-1.5 py-0.5 text-[9px]">{roleLabel}</span>}
                      {parsed.summary && <><span>·</span><span className="truncate max-w-[200px]">{parsed.summary}</span></>}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] text-[#B5BDBE]">{formatTimeAgo(row.createdAt, language)}</span>
                    <button onClick={() => setSelected(row)}
                      className="rounded-[8px] border border-[#DADBD9] px-2.5 py-1 text-[11px] font-semibold text-[#5A5A5A] hover:bg-[#F9F9F9]">
                      تفاصيل
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-[16px] border border-[#DADBD9] bg-white px-4 py-3">
          <button onClick={() => goToPage(pagination.page - 1)} disabled={pagination.page <= 1}
            className="rounded-full border border-[#DADBD9] px-4 py-1.5 text-[12px] font-bold text-[#5A5A5A] disabled:opacity-40">السابق</button>
          <div className="text-[12px] font-bold text-[#2A6364]">{pagination.page} / {pagination.totalPages} · {pagination.total} سجل</div>
          <button onClick={() => goToPage(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
            className="rounded-full border border-[#DADBD9] px-4 py-1.5 text-[12px] font-bold text-[#5A5A5A] disabled:opacity-40">التالي</button>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
          <div className="w-full max-w-2xl overflow-hidden rounded-[20px] bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#DADBD9] px-5 py-4">
              <div>
                <div className="text-[15px] font-extrabold text-[#2A2A2A]">{actionLabel(selected.action, language)}</div>
                <div className="text-[11px] text-[#B5BDBE]">{entityLabel(selected.entity, language)} · {formatDate(selected.createdAt)}</div>
              </div>
              <button onClick={() => setSelected(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F9F9F9] text-[#5A5A5A] hover:bg-[#DADBD9]">✕</button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                {[
                  ['المنفذ', selected.user?.fullName || 'النظام'],
                  ['البريد', selected.user?.email || '—'],
                  ['الدور', selected.user?.roles?.[0] || selected.user?.role || '—'],
                  [language === 'en' ? 'Entity' : 'الكيان', entityLabel(selected.entity, language)],
                  ['الرمز المرجعي', selected.entityId ? `#${selected.entityId.slice(-12)}` : '—'],
                  ['عنوان IP', selected.ipAddress || '—'],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-[10px] bg-[#F9F9F9] px-3 py-2">
                    <div className="text-[10px] text-[#B5BDBE]">{k as string}</div>
                    <div className="font-semibold text-[#2A2A2A] break-all">{v as string}</div>
                  </div>
                ))}
              </div>

              {/* Details */}
              {selected.details && (() => {
                const p = parseDetails(selected.details);
                return (
                  <div className="mt-4">
                    {p.hasDiff && p.before && p.after ? (
                      <div>
                        <div className="mb-2 text-[12px] font-bold text-[#2A2A2A]">التغييرات</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-[10px] border border-[#ecd0d8] bg-[#fff7f8] p-3">
                            <div className="mb-1 text-[10px] font-bold text-[#73384B]">قبل</div>
                            {Object.entries(p.before).filter(([k]) => !['id', 'updatedAt', 'createdAt'].includes(k)).slice(0, 6).map(([k, v]) => (
                              <div key={k} className="text-[11px] text-[#5A5A5A]">
                                <span className="font-semibold">{FIELD_LABELS[k] || k}:</span> {String(v ?? '—')}
                              </div>
                            ))}
                          </div>
                          <div className="rounded-[10px] border border-[#cce4e4] bg-[#eef5f4] p-3">
                            <div className="mb-1 text-[10px] font-bold text-[#2A6364]">بعد</div>
                            {Object.entries(p.after).filter(([k]) => !['id', 'updatedAt', 'createdAt'].includes(k)).slice(0, 6).map(([k, v]) => (
                              <div key={k} className="text-[11px] text-[#5A5A5A]">
                                <span className="font-semibold">{FIELD_LABELS[k] || k}:</span> {String(v ?? '—')}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : p.fields.length > 0 ? (
                      <div>
                        <div className="mb-2 text-[12px] font-bold text-[#2A2A2A]">بيانات إضافية</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {p.fields.slice(0, 10).map(([k, v]) => (
                            <div key={k} className="rounded-[8px] bg-[#F9F9F9] px-2.5 py-1.5 text-[11px]">
                              <span className="text-[#B5BDBE]">{k}: </span>
                              <span className="font-semibold text-[#2A2A2A]">{v.length > 50 ? `${v.slice(0, 50)}...` : v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
