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

  return (
    <div className="space-y-4 sm:space-y-5" aria-busy={loading}>
      <div className="sr-only" role="status" aria-live="polite">
        {loading ? a11y.loading : `${a11y.updated}. ${a11y.total}: ${stats.total}. ${a11y.unread}: ${stats.unread}.`}
      </div>

      <section
        className="rounded-[24px] border border-[#d6d7d4] bg-white px-4 py-4 shadow-sm sm:rounded-[28px] sm:px-5 sm:py-5"
        aria-labelledby="notifications-heading"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 id="notifications-heading" className="text-[24px] font-extrabold leading-[1.25] text-[#016564] sm:text-[30px]">
              الإشعارات والتنبيهات
            </h1>
            <p className="mt-2 text-[13px] leading-7 text-[#61706f] sm:text-sm">
              سجل موحد يوضح ما يخصك من مستجدات تشغيلية واعتمادات ورسائل وتنبيهات مرتبطة بالمخزون أو العهد أو المسارات الخدمية.
            </p>
          </div>

          <Button variant="secondary" onClick={handleMarkAllRead} disabled={stats.unread <= 0} aria-disabled={stats.unread <= 0} className="w-full sm:w-auto">
            تعليم الكل كمقروء
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-5" role="group" aria-label={a11y.stats}>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl" aria-label={`${a11y.total}: ${stats.total}`}>
            <div className="text-[12px] text-[#6f7b7a]">إجمالي الإشعارات</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#016564]">{stats.total}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl" aria-label={`${a11y.unread}: ${stats.unread}`}>
            <div className="text-[12px] text-[#6f7b7a]">غير المقروءة</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#d0b284]">{stats.unread}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl" aria-label={`${a11y.alerts}: ${stats.alerts}`}>
            <div className="text-[12px] text-[#6f7b7a]">التنبيهات</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#8a6a28]">{stats.alerts}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl" aria-label={`${a11y.critical}: ${stats.critical}`}>
            <div className="text-[12px] text-[#6f7b7a]">الحرجة</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#7c1e3e]">{stats.critical}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl" aria-label={`${a11y.actions}: ${stats.actions}`}>
            <div className="text-[12px] text-[#6f7b7a]">تحتاج إجراء</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#016564]">{stats.actions}</div>
          </Card>
        </div>
      </section>

      {feedback ? (
        <section
          role={feedback.type === 'error' ? 'alert' : 'status'}
          aria-live={feedback.type === 'error' ? 'assertive' : 'polite'}
          className={`rounded-[24px] border px-4 py-3 text-sm shadow-sm sm:rounded-[28px] ${
            feedback.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.message}
        </section>
      ) : null}

      {loadError ? (
        <section
          role="alert"
          className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm sm:rounded-[28px]"
        >
          {loadError}
        </section>
      ) : null}

      <section className="rounded-[24px] border border-[#d6d7d4] bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5" aria-label={a11y.filters}>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <Input
            label="بحث"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="العنوان، المحتوى، أو نوع الإشعار"
          />

          <div className="flex flex-wrap gap-2 self-end" role="group" aria-label={a11y.filters}>
            {[
              ['ALL', 'الكل'],
              ['UNREAD', 'غير المقروءة'],
              ['ALERT', 'التنبيهات'],
              ['NOTIFICATION', 'الإشعارات'],
              ['CRITICAL', 'الحرجة'],
              ['ACTION', 'تحتاج إجراء'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key as FilterKey)}
                aria-pressed={filter === key}
                className={`rounded-full px-4 py-2 text-xs transition ${
                  filter === key
                    ? 'bg-[#016564] text-white'
                    : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3" role={!loading && items.length > 0 ? 'list' : undefined} aria-label={a11y.list}>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-36 w-full rounded-[24px]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card className="rounded-[24px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm sm:rounded-[28px]">
            لا توجد إشعارات مطابقة
          </Card>
        ) : (
          items.map((item) => (
            <Card
              key={item.id}
              role="listitem"
              aria-label={item.title}
              className={`rounded-[24px] border p-4 shadow-sm transition sm:rounded-[28px] sm:p-5 ${itemClasses(item)}`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-[11px] ${badgeClasses(item)}`}>{typeLabel(item)}</span>
                    <span className={`rounded-full px-3 py-1 text-[11px] ${badgeClasses(item)}`}>{severityLabel(item)}</span>
                    {!item.isRead ? (
                      <span className="rounded-full bg-[#d0b284]/15 px-3 py-1 text-[11px] text-[#8a6a28]">
                        جديد
                      </span>
                    ) : null}
                  </div>

                  <div className="break-words text-[15px] font-bold leading-7 text-[#152625] sm:text-base">
                    {item.title}
                  </div>

                  <div className="break-words text-sm leading-7 text-[#304342]">{item.message}</div>

                  <div className="text-[12px] text-[#61706f]">{formatDate(item.createdAt)}</div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto">
                  {canCreateManagerRequest(item, user?.roles || []) ? (
                    <Button
                      loading={busyId === item.id}
                      onClick={() => handleCreateManagerRequest(item.id)}
                      aria-label={`${a11y.actions}: ${item.title}`}
                      className="w-full sm:w-auto"
                    >
                      إنشاء طلب للمدير
                    </Button>
                  ) : null}

                  {!item.isRead ? (
                    <Button variant="ghost" onClick={() => handleMarkRead(item.id)} aria-label={`${a11y.unread}: ${item.title}`} className="w-full sm:w-auto">
                      تعليم كمقروء
                    </Button>
                  ) : null}

                  {resolveItemLinkForRole(item, user?.role) ? (
                    <Button onClick={() => handleOpenItem(item)} aria-label={`${a11y.page}: ${item.title}`} className="w-full sm:w-auto">
                      فتح العنصر
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))
        )}
      </section>

      {!loading && pagination.totalPages > 1 ? (
        <section className="flex items-center justify-between rounded-[24px] border border-[#d6d7d4] bg-white px-4 py-3 shadow-sm">
          <button
            type="button"
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
            disabled={pagination.page <= 1}
            aria-label={a11y.previous}
            className="rounded-full border border-[#d6d7d4] px-4 py-2 text-sm font-bold text-[#425554] disabled:cursor-not-allowed disabled:opacity-40"
          >
            السابق
          </button>
          <div className="text-center">
            <div className="text-sm font-bold text-[#016564]">
              الصفحة {pagination.page} من {pagination.totalPages}
            </div>
            <div className="text-xs text-slate-500">إجمالي الإشعارات في هذا العرض: {pagination.total}</div>
          </div>
          <button
            type="button"
            onClick={() =>
              setPagination((prev) => ({
                ...prev,
                page: Math.min(prev.page + 1, prev.totalPages),
              }))
            }
            disabled={pagination.page >= pagination.totalPages}
            aria-label={a11y.next}
            className="rounded-full border border-[#d6d7d4] px-4 py-2 text-sm font-bold text-[#425554] disabled:cursor-not-allowed disabled:opacity-40"
          >
            التالي
          </button>
        </section>
      ) : null}
    </div>
  );
}
