'use client';

import React, { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { NOTIFICATIONS_UPDATED_EVENT } from '@/lib/notifications';
import { canonicalizeAppHref } from '@/lib/system';

type FilterKey = 'ALL' | 'UNREAD' | 'ALERT' | 'NOTIFICATION' | 'CRITICAL' | 'ACTION';

type NotificationMeta = {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
  type?: string | null;
  kind?: 'alert' | 'notification';
  severity?: 'info' | 'action' | 'critical';
};

type NotificationStats = {
  total: number;
  unread: number;
  alerts: number;
  critical: number;
  actions: number;
};

type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const A11Y_COPY = {
  ar: {
    loading: 'جاري تحديث الإشعارات',
    updated: 'تم تحديث الإشعارات',
    list: 'قائمة الإشعارات',
    filters: 'تصفية الإشعارات',
    stats: 'ملخص الإشعارات',
    page: 'صفحة الإشعارات',
    previous: 'الصفحة السابقة',
    next: 'الصفحة التالية',
    total: 'إجمالي الإشعارات',
    unread: 'الإشعارات غير المقروءة',
    alerts: 'التنبيهات',
    critical: 'التنبيهات الحرجة',
    actions: 'إشعارات تحتاج إجراء',
    loadError: 'تعذر تحميل الإشعارات. حاول التحديث مرة أخرى.',
  },
  en: {
    loading: 'Updating notifications',
    updated: 'Notifications updated',
    list: 'Notifications list',
    filters: 'Notification filters',
    stats: 'Notifications summary',
    page: 'Notifications page',
    previous: 'Previous page',
    next: 'Next page',
    total: 'Total notifications',
    unread: 'Unread notifications',
    alerts: 'Alerts',
    critical: 'Critical alerts',
    actions: 'Notifications requiring action',
    loadError: 'Unable to load notifications. Try refreshing again.',
  },
} as const;

function formatDate(date?: string) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date;
  }
}

function normalizeNotification(item: NotificationMeta): NotificationMeta {
  const type = String(item.type || '').toUpperCase();
  const entityType = String(item.entityType || '').toLowerCase();

  const severity =
    type.includes('CRITICAL') || type.includes('OUT_OF_STOCK') || type.includes('OVERDUE')
      ? 'critical'
      : type.includes('LOW_STOCK') || type.includes('NEW_') || type.includes('PENDING') || type.includes('REMINDER') || type.includes('CUSTODY') || type.includes('RETURN_')
        ? 'action'
        : 'info';

  const kind =
    severity === 'critical' || severity === 'action' || entityType === 'message' ? 'alert' : 'notification';

  return { ...item, severity, kind };
}

function typeLabel(item: NotificationMeta) {
  return item.kind === 'alert' ? 'تنبيه' : 'إشعار';
}

function severityLabel(item: NotificationMeta) {
  if (item.severity === 'critical') return 'حرج';
  if (item.severity === 'action') return 'إجراء';
  return 'معلوماتي';
}

function itemClasses(item: NotificationMeta) {
  if (item.severity === 'critical') {
    return 'border-[#7c1e3e]/15 bg-[#7c1e3e]/[0.04]';
  }

  if (item.kind === 'alert' || item.severity === 'action') {
    return 'border-[#d0b284]/25 bg-[#d0b284]/[0.10]';
  }

  return 'border-slate-200 bg-white';
}

function badgeClasses(item: NotificationMeta) {
  if (item.severity === 'critical') return 'bg-[#7c1e3e]/10 text-[#7c1e3e]';
  if (item.kind === 'alert' || item.severity === 'action') return 'bg-[#d0b284]/15 text-[#8a6a28]';
  return 'bg-[#016564]/10 text-[#016564]';
}

function appendOpenParam(href: string, id?: string | null) {
  if (!id) return href;
  return `${href}${href.includes('?') ? '&' : '?'}open=${encodeURIComponent(id)}`;
}

function resolveItemLinkForRole(item: NotificationMeta, role?: string | null): string | null {
  const entityType = String(item.entityType || '').toLowerCase();

  if (item.link) {
    const target = canonicalizeAppHref(item.link, role);
    if (['suggestion', 'custody', 'request', 'return', 'message', 'inventory'].includes(entityType) && !target.includes('open=')) {
      return appendOpenParam(target, item.entityId);
    }
    return target;
  }

  if (entityType === 'message' && item.entityId) return `${canonicalizeAppHref('/messages', role)}?open=${item.entityId}`;
  if (entityType === 'request' && item.entityId) return '/materials/requests?open=' + item.entityId;
  if (entityType === 'return' && item.entityId) return '/materials/returns?open=' + item.entityId;
  if (entityType === 'custody' && item.entityId) return '/materials/custody?open=' + item.entityId;
  if (entityType === 'inventory' && item.entityId) return '/materials/inventory?open=' + item.entityId;
  if (entityType === 'suggestion') return canonicalizeAppHref('/materials/notifications', role);

  return null;
}

function canCreateManagerRequest(item: NotificationMeta, roles: string[] = []) {
  const type = String(item.type || '').toUpperCase();
  return roles.includes('warehouse') && (
    type === 'WAREHOUSE_PURCHASE_REMINDER' ||
    type === 'WAREHOUSE_MAINTENANCE_REMINDER'
  );
}

function emitNotificationsUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useI18n();
  const a11y = A11Y_COPY[language === 'en' ? 'en' : 'ar'];
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<NotificationMeta[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unread: 0,
    alerts: 0,
    critical: 0,
    actions: 0,
  });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loadError, setLoadError] = useState('');
  const deferredSearch = useDeferredValue(search);

  const refreshNotifications = useCallback(
    async (page = pagination.page) => {
      setLoading(true);
      setLoadError('');

      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
        filter,
      });

      if (deferredSearch.trim()) {
        params.set('search', deferredSearch.trim());
      }

      try {
        const response = await fetch(`/api/notifications?${params.toString()}`, {
          cache: 'no-store',
          credentials: 'include',
        });

        const json = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(json?.error || a11y.loadError);
        }

        const rows = Array.isArray(json?.data) ? json.data.map(normalizeNotification) : [];
        const nextPagination: PaginationState = {
          page: Number(json?.pagination?.page || page || 1),
          limit: Number(json?.pagination?.limit || pagination.limit || 5),
          total: Number(json?.pagination?.total || 0),
          totalPages: Math.max(1, Number(json?.pagination?.totalPages || 1)),
        };

        if (page > nextPagination.totalPages && nextPagination.totalPages > 0) {
          setPagination((prev) => ({ ...prev, page: nextPagination.totalPages }));
          return;
        }

        setItems(rows);
        setStats({
          total: Number(json?.stats?.total || 0),
          unread: Number(json?.stats?.unread || 0),
          alerts: Number(json?.stats?.alerts || 0),
          critical: Number(json?.stats?.critical || 0),
          actions: Number(json?.stats?.actions || 0),
        });
        setPagination(nextPagination);
      } catch (error: any) {
        setLoadError(error?.message || a11y.loadError);
      } finally {
        setLoading(false);
      }
    },
    [a11y.loadError, deferredSearch, filter, pagination.limit, pagination.page]
  );

  useEffect(() => {
    if (!user?.id) return;

    const refresh = () => {
      void refreshNotifications(pagination.page);
    };

    refresh();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [user?.id, pagination.page, refreshNotifications]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [filter, deferredSearch]);

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ all: true }),
    }).catch(() => null);

    await refreshNotifications(pagination.page);
    emitNotificationsUpdated();
  };

  const handleMarkRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    }).catch(() => null);

    await refreshNotifications(pagination.page);
    emitNotificationsUpdated();
  };

  const handleCreateManagerRequest = async (id: string) => {
    setBusyId(id);
    setFeedback(null);

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'create-manager-request', id }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json?.error || 'تعذر تحويل التذكير إلى طلب مدير');
      }

      const code = String(json?.data?.code || '').trim();
      const existing = Boolean(json?.data?.existing);
      setFeedback({
        type: 'success',
        message: existing
          ? `يوجد طلب مرتبط بهذا التذكير مسبقًا برقم ${code}.`
          : `تم تحويل التذكير إلى طلب مدير برقم ${code}.`,
      });

      await refreshNotifications(pagination.page);
      emitNotificationsUpdated();
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: error?.message || 'تعذر تحويل التذكير إلى طلب مدير',
      });
    } finally {
      setBusyId('');
    }
  };

  const handleOpenItem = async (item: NotificationMeta) => {
    const target = resolveItemLinkForRole(item, user?.role);

    if (!item.isRead) {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: item.id }),
      }).catch(() => null);

      emitNotificationsUpdated();
    }

    if (target) {
      router.push(target);
    }
  };

  const severityConfig = {
    critical: { color: '#73384B', bg: '#f4e7eb', border: '#ecd0d8', label: 'حرج', dot: 'bg-[#73384B]' },
    action:   { color: '#8a6a37', bg: '#f7f1e4', border: '#e8ddbf', label: 'إجراء', dot: 'bg-[#C7B08C]' },
    info:     { color: '#2A6364', bg: '#eef5f4', border: '#cce4e4', label: 'معلوماتي', dot: 'bg-[#2A6364]' },
  };

  return (
    <div className="space-y-4" aria-busy={loading} dir="rtl">
      <div className="sr-only" role="status" aria-live="polite">
        {loading ? a11y.loading : `${a11y.updated}. ${a11y.total}: ${stats.total}. ${a11y.unread}: ${stats.unread}.`}
      </div>

      {/* ══ Hero Header ══ */}
      <section className="overflow-hidden rounded-[20px] bg-gradient-to-l from-[#1c2b45] to-[#2E4A7A] shadow-[0_12px_32px_rgba(0,0,0,0.2)]" aria-labelledby="notifications-heading">
        <div className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/15">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-white" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {stats.unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C7B08C] text-[9px] font-extrabold text-[#3a2a10]">
                    {stats.unread > 9 ? '9+' : stats.unread}
                  </span>
                )}
              </div>
              <div>
                <h1 id="notifications-heading" className="text-[20px] font-extrabold text-white">الإشعارات والتنبيهات</h1>
                <div className="text-[11px] text-white/50">{stats.total} إشعار</div>
              </div>
            </div>

            <button
              onClick={handleMarkAllRead}
              disabled={stats.unread <= 0}
              aria-disabled={stats.unread <= 0}
              className="flex items-center gap-2 rounded-[12px] bg-white/15 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/25 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              تعليم الكل كمقروء
            </button>
          </div>

          {/* KPI strip */}
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5" role="group" aria-label={a11y.stats}>
            {[
              { label: 'إجمالي', value: stats.total, color: '#60a5fa' },
              { label: 'غير مقروءة', value: stats.unread, color: '#fbbf24', urgent: stats.unread > 0 },
              { label: 'تنبيهات', value: stats.alerts, color: '#fbbf24' },
              { label: 'حرجة', value: stats.critical, color: '#f87171', urgent: stats.critical > 0 },
              { label: 'تحتاج إجراء', value: stats.actions, color: '#34d399', urgent: stats.actions > 0 },
            ].map((s) => (
              <div key={s.label} className={`rounded-[13px] border px-3 py-2.5 ${s.urgent ? 'border-white/20 bg-white/15' : 'border-white/8 bg-white/6'}`} aria-label={`${s.label}: ${s.value}`}>
                <div className="text-[22px] font-extrabold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] text-white/50">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter + search bar */}
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-5 py-3" role="group" aria-label={a11y.filters}>
          {([
            ['ALL', 'الكل'],
            ['UNREAD', 'غير مقروءة'],
            ['CRITICAL', 'حرجة'],
            ['ACTION', 'إجراء'],
            ['ALERT', 'تنبيهات'],
          ] as [FilterKey, string][]).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${filter === key ? 'border-white/40 bg-white/20 text-white' : 'border-white/15 text-white/60 hover:border-white/30 hover:text-white/80'}`}>
              {label}
            </button>
          ))}
          <div className="relative flex-1 min-w-[150px]">
            <svg viewBox="0 0 24 24" fill="none" className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في الإشعارات..."
              className="h-8 w-full rounded-full border border-white/20 bg-white/10 pr-8 pl-3 text-[11px] text-white placeholder-white/30 outline-none focus:border-white/40" />
          </div>
        </div>
      </section>

      {/* Feedback / error banners */}
      {feedback && (
        <div role={feedback.type === 'error' ? 'alert' : 'status'} aria-live={feedback.type === 'error' ? 'assertive' : 'polite'}
          className={`flex items-center gap-2 rounded-[12px] border px-4 py-3 text-[13px] ${feedback.type === 'error' ? 'border-[#ecd0d8] bg-[#fff7f8] text-[#73384B]' : 'border-[#cce6d7] bg-[#e8f5ef] text-[#1e6b4c]'}`}>
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          {feedback.message}
        </div>
      )}
      {loadError && (
        <div role="alert" className="flex items-center gap-2 rounded-[12px] border border-[#ecd0d8] bg-[#fff7f8] px-4 py-3 text-[13px] text-[#73384B]">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          {loadError}
        </div>
      )}

      {/* ══ Notifications List ══ */}
      <div className="space-y-2.5" role={!loading && items.length > 0 ? 'list' : undefined} aria-label={a11y.list}>
        {loading ? (
          [1,2,3,4].map((i) => (
            <div key={i} className="flex animate-pulse gap-3 rounded-[16px] border border-[#F0F0F0] bg-white p-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-[#F0F0F0]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded bg-[#F0F0F0]" />
                <div className="h-2.5 w-full rounded bg-[#F0F0F0]" />
                <div className="h-2.5 w-1/3 rounded bg-[#F0F0F0]" />
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[20px] border border-[#DADBD9] bg-white py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F9F9F9]">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-[#DADBD9]" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <p className="mt-3 text-[14px] font-semibold text-[#B5BDBE]">لا توجد إشعارات</p>
          </div>
        ) : (
          items.map((item) => {
            const sev = item.severity || 'info';
            const cfg = severityConfig[sev as keyof typeof severityConfig] || severityConfig.info;
            const hasLink = !!resolveItemLinkForRole(item, user?.role);

            return (
              <div key={item.id} role="listitem" aria-label={item.title}
                className={`overflow-hidden rounded-[16px] border bg-white transition ${!item.isRead ? 'border-[#C7B08C]/30 shadow-[0_2px_12px_rgba(199,176,140,0.1)]' : 'border-[#DADBD9]'}`}>
                <div className="flex items-start gap-3 p-4">
                  {/* Severity indicator */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: cfg.bg }}>
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke={cfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {sev === 'critical'
                        ? <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
                        : sev === 'action'
                        ? <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>
                        : <><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></>
                      }
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Badges row */}
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                      {!item.isRead && (
                        <span className="flex items-center gap-1 rounded-full bg-[#f7f1e4] px-2 py-0.5 text-[10px] font-bold text-[#8a6a37]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#C7B08C]" />
                          جديد
                        </span>
                      )}
                      <span className="text-[10px] text-[#B5BDBE]">{formatDate(item.createdAt)}</span>
                    </div>

                    {/* Title */}
                    <div className="text-[14px] font-extrabold leading-snug text-[#2A2A2A]">{item.title}</div>

                    {/* Message */}
                    <div className="mt-1 text-[12px] leading-relaxed text-[#5A5A5A]">{item.message}</div>

                    {/* Actions */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {hasLink && (
                        <button onClick={() => handleOpenItem(item)} aria-label={`${a11y.page}: ${item.title}`}
                          className="rounded-[8px] px-3 py-1.5 text-[11px] font-bold text-white transition hover:opacity-90"
                          style={{ backgroundColor: cfg.color }}>
                          فتح العنصر
                        </button>
                      )}
                      {canCreateManagerRequest(item, user?.roles || []) && (
                        <button onClick={() => handleCreateManagerRequest(item.id)} disabled={busyId === item.id} aria-label={`${a11y.actions}: ${item.title}`}
                          className="rounded-[8px] bg-[#2A6364] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1e5152] disabled:opacity-40">
                          {busyId === item.id ? '...' : 'إنشاء طلب للمدير'}
                        </button>
                      )}
                      {!item.isRead && (
                        <button onClick={() => handleMarkRead(item.id)} aria-label={`${a11y.unread}: ${item.title}`}
                          className="rounded-[8px] border border-[#DADBD9] px-3 py-1.5 text-[11px] font-semibold text-[#5A5A5A] hover:bg-[#F9F9F9]">
                          تعليم كمقروء
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-[16px] border border-[#DADBD9] bg-white px-4 py-3">
          <button type="button" onClick={() => setPagination((p) => ({ ...p, page: Math.max(p.page - 1, 1) }))}
            disabled={pagination.page <= 1} aria-label={a11y.previous}
            className="rounded-full border border-[#DADBD9] px-4 py-1.5 text-[12px] font-bold text-[#5A5A5A] disabled:opacity-40">
            السابق
          </button>
          <div className="text-[12px] font-bold text-[#2A6364]">
            {pagination.page} / {pagination.totalPages} · {pagination.total} إشعار
          </div>
          <button type="button" onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
            disabled={pagination.page >= pagination.totalPages} aria-label={a11y.next}
            className="rounded-full border border-[#DADBD9] px-4 py-1.5 text-[12px] font-bold text-[#5A5A5A] disabled:opacity-40">
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
