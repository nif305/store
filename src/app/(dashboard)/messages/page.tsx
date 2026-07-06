'use client';

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';

type RelatedType = 'REQUEST' | 'RETURN' | 'CUSTODY' | 'MAINTENANCE' | 'PURCHASE' | 'OTHER';

type MessageItem = {
  id: string;
  senderId: string;
  receiverId: string;
  subject: string;
  body: string;
  relatedType?: RelatedType | null;
  relatedId?: string | null;
  isRead: boolean;
  createdAt: string;
  sender?: { id: string; fullName?: string; role?: string | null; email?: string | null } | null;
  receiver?: { id: string; fullName?: string; role?: string | null; email?: string | null } | null;
};

type MessageStats = {
  total: number;
  unread: number;
};

type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function formatDate(date?: string) {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleString('ar-SA');
  } catch {
    return date;
  }
}

const relatedTypeLabelsAr: Record<RelatedType, string> = {
  REQUEST: 'طلب مواد',
  RETURN: 'إرجاع',
  CUSTODY: 'عهدة',
  MAINTENANCE: 'صيانة',
  PURCHASE: 'شراء مباشر',
  OTHER: 'طلب آخر',
};

const relatedTypeLabelsEn: Record<RelatedType, string> = {
  REQUEST: 'Material Request',
  RETURN: 'Return',
  CUSTODY: 'Custody',
  MAINTENANCE: 'Maintenance',
  PURCHASE: 'Direct Purchase',
  OTHER: 'Other Request',
};

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const { user, allUsers } = useAuth();
  const { language } = useI18n();
  const relatedTypeLabels = language === 'en' ? relatedTypeLabelsEn : relatedTypeLabelsAr;
  const [activeBox, setActiveBox] = useState<'inbox' | 'sent'>('inbox');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [stats, setStats] = useState<MessageStats>({ total: 0, unread: 0 });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MessageItem | null>(null);
  const [search, setSearch] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [receiverId, setReceiverId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [relatedType, setRelatedType] = useState<RelatedType | ''>('');
  const [relatedId, setRelatedId] = useState('');
  const [error, setError] = useState('');
  const deferredSearch = useDeferredValue(search);
  const openMessageId = searchParams.get('open') || '';

  const fetchMessages = async (box = activeBox, page = pagination.page) => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const params = new URLSearchParams({
        box,
        page: String(page),
        limit: String(pagination.limit),
      });

      if (deferredSearch.trim()) {
        params.set('search', deferredSearch.trim());
      }

      if (openMessageId) {
        params.set('open', openMessageId);
      }

      const response = await fetch(`/api/messages?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = await response.json().catch(() => null);
      const rows = Array.isArray(json?.data) ? json.data : [];
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

      setMessages(rows);
      setStats({
        total: Number(json?.stats?.total || 0),
        unread: Number(json?.stats?.unread || 0),
      });
      setPagination(nextPagination);

      const focusMessage =
        (json?.focusMessage as MessageItem | null | undefined) ||
        (openMessageId ? rows.find((message: MessageItem) => message.id === openMessageId) : null);

      if (focusMessage) {
        setSelected(focusMessage);
      }
    } catch {
      setMessages([]);
      setStats({ total: 0, unread: 0 });
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    void fetchMessages(activeBox, pagination.page);
  }, [user?.id, activeBox, pagination.page, pagination.limit, deferredSearch, openMessageId]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [activeBox, deferredSearch]);

  const recipients = useMemo(
    () => allUsers.filter((item) => item.id !== user?.id && item.status === 'active'),
    [allUsers, user?.id]
  );

  const openMessage = async (message: MessageItem) => {
    setSelected(message);

    if (activeBox !== 'inbox' || message.isRead || !user?.id) {
      return;
    }

    await fetch('/api/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: message.id }),
    }).catch(() => null);

    setMessages((prev) =>
      prev.map((item) => (item.id === message.id ? { ...item, isRead: true } : item))
    );
    setSelected((prev) => (prev?.id === message.id ? { ...prev, isRead: true } : prev));
    setStats((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <section className="overflow-hidden rounded-[20px] bg-gradient-to-l from-[#2c4a5a] to-[#2E6F8E] p-5 text-white shadow-[0_12px_32px_rgba(46,111,142,0.25)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-extrabold">المراسلات الداخلية</h1>
            <div className="mt-1 flex items-center gap-3 text-[12px] text-white/70">
              <span>{stats.total} رسالة</span>
              {activeBox === 'inbox' && stats.unread > 0 && (
                <span className="rounded-full bg-[#C7B08C]/80 px-2 py-0.5 text-[11px] font-bold text-white">
                  {stats.unread} غير مقروءة
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setComposeOpen(true)}
            className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-2.5 text-[13px] font-extrabold text-[#2E6F8E] shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition hover:bg-[#f0f8fc]">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            رسالة جديدة
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {(['inbox', 'sent'] as const).map((box) => (
            <button key={box} onClick={() => setActiveBox(box)}
              className={`rounded-full border px-4 py-1.5 text-[12px] font-bold transition ${activeBox === box ? 'border-white bg-white text-[#2E6F8E]' : 'border-white/30 text-white hover:border-white/60'}`}>
              {box === 'inbox' ? 'الوارد' : 'الصادر'}
            </button>
          ))}
          <div className="relative flex-1 mr-2">
            <svg viewBox="0 0 24 24" fill="none" className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في الرسائل..."
              className="h-8 w-full rounded-full border border-white/20 bg-white/10 pr-8 pl-3 text-[12px] text-white placeholder-white/40 outline-none focus:border-white/40 focus:bg-white/20" />
          </div>
        </div>
      </section>

      {/* Messages list */}
      <div className="space-y-2.5">
        {loading ? (
          [1,2,3].map((i) => <div key={i} className="h-24 animate-pulse rounded-[16px] bg-[#F0F0F0]" />)
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[20px] border border-[#DADBD9] bg-white py-16 text-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12 text-[#DADBD9]" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p className="mt-3 text-[13px] text-[#B5BDBE]">لا توجد رسائل</p>
          </div>
        ) : (
          messages.map((message) => {
            const otherParty = activeBox === 'inbox' ? message.sender : message.receiver;
            const isUnread = !message.isRead && activeBox === 'inbox';

            return (
              <button key={message.id} onClick={() => openMessage(message)}
                className={`w-full rounded-[16px] border bg-white p-4 text-right transition hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] ${isUnread ? 'border-[#2E6F8E]/30 bg-[#f5f9fc]' : 'border-[#DADBD9]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e7eff5]">
                      <span className="text-[13px] font-extrabold text-[#2E6F8E]">
                        {(otherParty?.fullName || '?').charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-extrabold text-[#2A2A2A]">{message.subject}</span>
                        {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#2E6F8E]" />}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[12px] text-[#B5BDBE]">{message.body}</p>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-[#B5BDBE]">
                        <span>{activeBox === 'inbox' ? 'من: ' : 'إلى: '}{otherParty?.fullName || '—'}</span>
                        {message.relatedType && (
                          <span className="rounded-full bg-[#eef5f4] px-2 py-0.5 text-[10px] font-semibold text-[#2A6364]">
                            {relatedTypeLabels[message.relatedType]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] text-[#B5BDBE]">{formatDate(message.createdAt)}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-[16px] border border-[#DADBD9] bg-white px-4 py-3">
          <button onClick={() => setPagination((p) => ({ ...p, page: Math.max(p.page - 1, 1) }))} disabled={pagination.page <= 1}
            className="rounded-full border border-[#DADBD9] px-4 py-1.5 text-[12px] font-bold text-[#5A5A5A] disabled:opacity-40">السابق</button>
          <div className="text-[12px] font-bold text-[#2A6364]">{pagination.page} / {pagination.totalPages}</div>
          <button onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))} disabled={pagination.page >= pagination.totalPages}
            className="rounded-full border border-[#DADBD9] px-4 py-1.5 text-[12px] font-bold text-[#5A5A5A] disabled:opacity-40">التالي</button>
        </div>
      )}

      <Modal isOpen={composeOpen} onClose={() => setComposeOpen(false)} title="رسالة داخلية جديدة" size="lg">
        <div className="space-y-4">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#425554]">إلى</label>
            <select
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              className="w-full rounded-2xl border border-[#d6d7d4] bg-white px-4 py-3 text-sm outline-none focus:border-[#016564]"
            >
              <option value="">اختر المستلم</option>
              {recipients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName} — {item.role}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="الموضوع"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="عنوان مختصر وواضح"
          />
          <Textarea
            label="نص الرسالة"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="اكتب الرسالة هنا"
            rows={7}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#425554]">النوع المرتبط</label>
              <select
                value={relatedType}
                onChange={(e) => setRelatedType(e.target.value as RelatedType | '')}
                className="w-full rounded-2xl border border-[#d6d7d4] bg-white px-4 py-3 text-sm outline-none focus:border-[#016564]"
              >
                <option value="">بدون ربط</option>
                {Object.entries(relatedTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="الرقم المرجعي"
              value={relatedId}
              onChange={(e) => setRelatedId(e.target.value)}
              placeholder="مثال: MNT-2026-0004"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setComposeOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={async () => {
                setError('');
                if (!user?.id || !receiverId || !subject.trim() || !body.trim()) {
                  setError('يرجى تعبئة المستلم والموضوع ونص الرسالة');
                  return;
                }

                const response = await fetch('/api/messages', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    receiverId,
                    subject: subject.trim(),
                    body: body.trim(),
                    relatedType: relatedType || undefined,
                    relatedId: relatedId.trim() || undefined,
                  }),
                });
                const json = await response.json().catch(() => null);

                if (!response.ok) {
                  setError(json?.error || 'تعذر إرسال الرسالة');
                  return;
                }

                setComposeOpen(false);
                setReceiverId('');
                setSubject('');
                setBody('');
                setRelatedType('');
                setRelatedId('');
                setPagination((prev) => ({ ...prev, page: 1 }));
                setActiveBox('sent');
              }}
            >
              إرسال الرسالة
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.subject || 'تفاصيل الرسالة'} size="xl">
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [activeBox === 'inbox' ? 'من' : 'إلى', activeBox === 'inbox' ? selected.sender?.fullName || '—' : selected.receiver?.fullName || '—'],
                ['التاريخ', formatDate(selected.createdAt)],
                ['البريد الإلكتروني', activeBox === 'inbox' ? selected.sender?.email || '—' : selected.receiver?.email || '—'],
                ['النوع المرتبط', selected.relatedType ? relatedTypeLabels[selected.relatedType] : '—'],
                ['الرقم المرجعي', selected.relatedId || '—'],
                ['حالة القراءة', selected.isRead ? 'مقروءة' : 'غير مقروءة'],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-[#e7ebea] bg-[#fcfdfd] p-3">
                  <div className="text-xs font-bold text-[#016564]">{label}</div>
                  <div className="mt-1 text-sm text-[#425554]">{value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-[#e7ebea] bg-[#fcfdfd] p-4">
              <div className="text-xs font-bold text-[#016564]">نص الرسالة</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#425554]">{selected.body}</div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
