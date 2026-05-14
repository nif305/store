'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { NOTIFICATIONS_UPDATED_EVENT } from '@/lib/notifications';
import { canonicalizeAppHref } from '@/lib/system';

type ServerNotification = {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  isRead: boolean;
  createdAt: string;
  type?: string | null;
};

type NormalizedNotification = ServerNotification & {
  severity: 'critical' | 'action' | 'info';
  kind: 'message' | 'notification';
};

type NotificationCopy = {
  title: string;
  close: string;
  closeButton: string;
  markPreview: string;
  viewAll: string;
  none: string;
  loading: string;
  unreadSuffix: string;
  noUnread: string;
  loadError: string;
  previewHint: string;
  critical: string;
  action: string;
  info: string;
  openItem: string;
};

const COPY: Record<'ar' | 'en', NotificationCopy> = {
  ar: {
    title: 'الإشعارات',
    close: 'إغلاق قائمة الإشعارات',
    closeButton: 'إغلاق',
    markPreview: 'تعليم المعروض كمقروء',
    viewAll: 'مركز الإشعارات',
    none: 'لا توجد إشعارات',
    loading: 'جاري تحديث الإشعارات',
    unreadSuffix: 'غير مقروءة',
    noUnread: 'لا توجد إشعارات غير مقروءة',
    loadError: 'تعذر تحديث الإشعارات الآن',
    previewHint: 'يعرض الجرس آخر الإشعارات فقط للحفاظ على خفة المنصة.',
    critical: 'حرج',
    action: 'إجراء مطلوب',
    info: 'معلومات',
    openItem: 'فتح الإشعار',
  },
  en: {
    title: 'Notifications',
    close: 'Close notifications panel',
    closeButton: 'Close',
    markPreview: 'Mark shown as read',
    viewAll: 'Notification Center',
    none: 'No notifications',
    loading: 'Updating notifications',
    unreadSuffix: 'unread',
    noUnread: 'No unread notifications',
    loadError: 'Unable to refresh notifications right now',
    previewHint: 'The bell shows only the latest notifications to keep the portal fast.',
    critical: 'Critical',
    action: 'Action required',
    info: 'Information',
    openItem: 'Open notification',
  },
};

const BELL_PREVIEW_LIMIT = 5;
const NOTIFICATION_BELL_OPENED_EVENT = 'inventory-notification-bell-opened';

function normalizeNotification(item: ServerNotification): NormalizedNotification {
  const type = String(item.type || '').toUpperCase();
  const entityType = String(item.entityType || '').toLowerCase();

  const severity =
    type.includes('CRITICAL') || type.includes('OUT_OF_STOCK') || type.includes('OVERDUE')
      ? 'critical'
      : type.includes('LOW_STOCK') ||
          type.includes('NEW_') ||
          type.includes('PENDING') ||
          type.includes('REMINDER') ||
          type.includes('CUSTODY') ||
          type.includes('RETURN_')
        ? 'action'
        : 'info';

  const kind = entityType === 'message' ? 'message' : 'notification';

  return { ...item, severity, kind };
}

function appendOpenParam(href: string, id?: string | null) {
  if (!id) return href;
  if (href.includes('open=')) return href;
  return `${href}${href.includes('?') ? '&' : '?'}open=${encodeURIComponent(id)}`;
}

function resolveItemLinkForRole(item: NormalizedNotification, role?: string | null): string | null {
  const entityType = String(item.entityType || '').toLowerCase();

  if (item.link) {
    const target = canonicalizeAppHref(item.link, role);
    return ['suggestion', 'custody', 'request', 'return', 'message', 'inventory'].includes(entityType)
      ? appendOpenParam(target, item.entityId)
      : target;
  }
  if (entityType === 'message' && item.entityId) return `${canonicalizeAppHref('/messages', role)}?open=${item.entityId}`;
  if (entityType === 'request' && item.entityId) return `/materials/requests?open=${item.entityId}`;
  if (entityType === 'return' && item.entityId) return `/materials/returns?open=${item.entityId}`;
  if (entityType === 'custody' && item.entityId) return `/materials/custody?open=${item.entityId}`;
  if (entityType === 'inventory' && item.entityId) return `/materials/inventory?open=${item.entityId}`;
  if (entityType === 'suggestion') return canonicalizeAppHref('/materials/notifications', role);

  return canonicalizeAppHref('/notifications', role);
}

function formatRelative(value: string | null | undefined, language: 'ar' | 'en') {
  if (!value) return '-';

  try {
    const diffMs = new Date(value).getTime() - Date.now();
    const absMs = Math.abs(diffMs);
    const locale = language === 'en' ? 'en' : 'ar-SA';
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (absMs < hour) return formatter.format(Math.round(diffMs / minute) || -1, 'minute');
    if (absMs < day) return formatter.format(Math.round(diffMs / hour), 'hour');
    return formatter.format(Math.round(diffMs / day), 'day');
  } catch {
    return '-';
  }
}

function notifyUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

function previewSummary(language: 'ar' | 'en', visible: number, total: number) {
  if (visible <= 0) return '';
  if (total <= visible) return language === 'en' ? `Latest ${visible}` : `آخر ${visible}`;
  return language === 'en' ? `Latest ${visible} of ${total}` : `آخر ${visible} من أصل ${total}`;
}

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useI18n();
  const activeLanguage = language === 'en' ? 'en' : 'ar';
  const instanceId = useId();
  const panelId = useId();
  const titleId = useId();
  const statusId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const copy = COPY[activeLanguage];
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<React.CSSProperties>({
    top: 96,
    left: 12,
    width: 'calc(100vw - 24px)',
  });
  const [items, setItems] = useState<NormalizedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) return copy.noUnread;
    return `${unreadCount > 99 ? '99+' : unreadCount} ${copy.unreadSuffix}`;
  }, [copy.noUnread, copy.unreadSuffix, unreadCount]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const response = await fetch(`/api/notifications?mode=bell&limit=${BELL_PREVIEW_LIMIT}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(json?.error || copy.loadError);
      }

      const rows = Array.isArray(json?.data) ? json.data.map(normalizeNotification) : [];
      setItems(rows);
      setUnreadCount(Number(json?.stats?.unread ?? rows.filter((item) => !item.isRead).length));
      setTotalCount(Number(json?.stats?.total ?? json?.pagination?.total ?? rows.length));
    } catch {
      setLoadError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  const updatePanelPosition = useCallback(() => {
    if (typeof window === 'undefined') return;

    const rect = buttonRef.current?.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const panelWidth = Math.min(420, Math.max(280, viewportWidth - 24));

    if (!rect || viewportWidth < 640) {
      setPanelPosition({
        top: 88,
        left: 12,
        width: viewportWidth - 24,
      });
      return;
    }

    const left = Math.max(12, Math.min(viewportWidth - panelWidth - 12, rect.right - panelWidth));
    const top = Math.max(12, rect.bottom + 12);

    setPanelPosition({
      top,
      left,
      width: panelWidth,
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const guardedRefresh = async () => {
      if (!mounted) return;
      await refresh();
    };

    void guardedRefresh();

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, guardedRefresh);
    window.addEventListener('storage', guardedRefresh);
    window.addEventListener('focus', guardedRefresh);

    return () => {
      mounted = false;
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, guardedRefresh);
      window.removeEventListener('storage', guardedRefresh);
      window.removeEventListener('focus', guardedRefresh);
    };
  }, [refresh, userId]);

  useEffect(() => {
    const closeOtherInstances = (event: Event) => {
      const openedId = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (openedId && openedId !== instanceId) {
        setOpen(false);
      }
    };

    window.addEventListener(NOTIFICATION_BELL_OPENED_EVENT, closeOtherInstances as EventListener);
    return () => window.removeEventListener(NOTIFICATION_BELL_OPENED_EVENT, closeOtherInstances as EventListener);
  }, [instanceId]);

  useEffect(() => {
    if (!open) return;

    window.dispatchEvent(new CustomEvent(NOTIFICATION_BELL_OPENED_EVENT, { detail: { id: instanceId } }));
    updatePanelPosition();
    void refresh();

    const timer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
      if (!closeButtonRef.current) panelRef.current?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [instanceId, open, refresh, updatePanelPosition]);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      buttonRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  const markOneRead = async (id: string) => {
    const target = items.find((item) => item.id === id);

    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    }).catch(() => null);

    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    if (target && !target.isRead) setUnreadCount((value) => Math.max(0, value - 1));
    notifyUpdated();
  };

  const markPreviewRead = async () => {
    const unreadPreviewIds = items.filter((item) => !item.isRead).map((item) => item.id);
    if (unreadPreviewIds.length === 0) return;

    setItems((prev) => prev.map((item) => (unreadPreviewIds.includes(item.id) ? { ...item, isRead: true } : item)));
    setUnreadCount((value) => Math.max(0, value - unreadPreviewIds.length));

    await Promise.all(
      unreadPreviewIds.map((id) =>
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id }),
        }).catch(() => null),
      ),
    );

    notifyUpdated();
  };

  const handleOpenItem = async (item: NormalizedNotification) => {
    if (!item.isRead) {
      await markOneRead(item.id);
    }

    const target = resolveItemLinkForRole(item, user?.role);
    setOpen(false);
    if (target) router.push(target);
  };

  const notificationPanel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <>
            <div className="fixed inset-0 z-[9998] bg-black/10" aria-hidden="true" onClick={() => setOpen(false)} />
            <div
              id={panelId}
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              style={panelPosition}
              className="fixed z-[9999] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl"
              data-i18n-skip
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <div id={titleId} className="text-sm font-bold text-slate-900">
                    {copy.title}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {unreadLabel}
                    {items.length > 0 ? <span> · {previewSummary(activeLanguage, items.length, Math.max(totalCount, items.length))}</span> : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={markPreviewRead}
                    disabled={!items.some((item) => !item.isRead)}
                    className="text-xs text-[#016564] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copy.markPreview}
                  </button>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-[#016564]/30 hover:text-[#016564]"
                    aria-label={copy.close}
                  >
                    {copy.closeButton}
                  </button>
                </div>
              </div>

              <div className="max-h-[min(68vh,430px)] overflow-y-auto" aria-busy={loading}>
                {items.length > 0 ? (
                  <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs leading-5 text-slate-500">
                    {copy.previewHint}{' '}
                    <Link href={canonicalizeAppHref('/notifications', user?.role)} className="font-bold text-[#016564]" onClick={() => setOpen(false)}>
                      {copy.viewAll}
                    </Link>
                  </div>
                ) : null}

                {items.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">{loadError || copy.none}</div>
                ) : (
                  <div role="list" aria-label={copy.title}>
                    {items.map((item) => {
                      const severityLabel = item.severity === 'critical' ? copy.critical : item.severity === 'action' ? copy.action : copy.info;

                      return (
                        <div key={item.id} role="listitem">
                          <button
                            type="button"
                            onClick={() => handleOpenItem(item)}
                            className={`block w-full border-b border-slate-100 px-4 py-3 text-right transition hover:bg-slate-50 ${
                              item.isRead ? 'bg-white' : 'bg-[#f8fbfb]'
                            }`}
                            aria-label={`${copy.openItem}: ${item.title}. ${severityLabel}. ${formatRelative(item.createdAt, activeLanguage)}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  {!item.isRead ? <span className="h-2 w-2 rounded-full bg-[#d0b284]" aria-hidden="true" /> : null}
                                  <div className="truncate text-sm font-bold text-slate-900">{item.title}</div>
                                </div>
                                <div className="mt-1 line-clamp-2 text-xs leading-6 text-slate-600">{item.message}</div>
                                <div className="mt-1 text-[11px] text-slate-400">
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{severityLabel}</span>
                                  <span className="mx-1" aria-hidden="true">
                                    .
                                  </span>
                                  {formatRelative(item.createdAt, activeLanguage)}
                                </div>
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="relative" data-i18n-skip>
        <span id={statusId} className="sr-only" role="status" aria-live="polite">
          {loading ? copy.loading : loadError || unreadLabel}
        </span>

        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            updatePanelPosition();
            setOpen((prev) => !prev);
          }}
          className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#016564] shadow-soft transition hover:border-[#016564]/20 hover:bg-[#f7fbfa]"
          aria-label={`${copy.title}: ${unreadLabel}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-describedby={statusId}
          title={copy.title}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 16.5h12l-1.5-2V10a4.5 4.5 0 1 0-9 0v4.5l-1.5 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>

          {unreadCount > 0 ? (
            <span className="absolute -top-1 -left-1 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#7c1e3e] px-1 text-[11px] text-white" aria-hidden="true">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>
      </div>

      {notificationPanel}
    </>
  );
}
