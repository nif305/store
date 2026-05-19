'use client';

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';

type ArchiveSource = 'materials' | 'service';
type FolderKey =
  | 'service-correspondence'
  | 'service-maintenance'
  | 'service-cleaning'
  | 'service-purchase'
  | 'service-other'
  | 'material-consumable'
  | 'material-returnable'
  | 'material-custody-returned';

type ArchiveRow = {
  id: string;
  source: ArchiveSource;
  folder: FolderKey;
  title: string;
  code: string;
  status: string;
  requesterName: string;
  requesterDepartment: string;
  description: string;
  createdAt?: string | null;
  extra?: string;
};

type FolderMeta = {
  key: FolderKey;
  source: ArchiveSource;
  title: string;
  subtitle: string;
  tone: string;
};

type ArchiveStats = {
  total: number;
  folders: number;
  activeFolderCount: number;
};

type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const FOLDERS: FolderMeta[] = [
  {
    key: 'service-correspondence',
    source: 'service',
    title: 'المراسلات الخارجية',
    subtitle: 'المعاملات المنتهية بعد التنزيل أو الإرسال',
    tone: 'text-[#016564]',
  },
  {
    key: 'service-maintenance',
    source: 'service',
    title: 'طلبات الصيانة',
    subtitle: 'طلبات الصيانة المؤرشفة',
    tone: 'text-[#016564]',
  },
  {
    key: 'service-cleaning',
    source: 'service',
    title: 'طلبات النظافة',
    subtitle: 'طلبات النظافة المؤرشفة',
    tone: 'text-[#016564]',
  },
  {
    key: 'service-purchase',
    source: 'service',
    title: 'طلبات المشتريات المباشرة',
    subtitle: 'طلبات الشراء المباشر المؤرشفة',
    tone: 'text-[#8a6a28]',
  },
  {
    key: 'service-other',
    source: 'service',
    title: 'طلبات أخرى',
    subtitle: 'الطلبات الأخرى المؤرشفة',
    tone: 'text-[#6d5b7a]',
  },
  {
    key: 'material-consumable',
    source: 'materials',
    title: 'الطلبات المستهلكة',
    subtitle: 'طلبات المواد الاستهلاكية المصروفة',
    tone: 'text-[#498983]',
  },
  {
    key: 'material-returnable',
    source: 'materials',
    title: 'الطلبات المسترجعة',
    subtitle: 'طلبات المواد المسترجعة المكتملة',
    tone: 'text-[#498983]',
  },
  {
    key: 'material-custody-returned',
    source: 'materials',
    title: 'العهد المعادة',
    subtitle: 'العهد التي أغلقت وتمت إعادتها',
    tone: 'text-[#498983]',
  },
];

const PAGE_LIMIT = 5;
const EMPTY_COUNTS: Record<FolderKey, number> = {
  'service-correspondence': 0,
  'service-maintenance': 0,
  'service-cleaning': 0,
  'service-purchase': 0,
  'service-other': 0,
  'material-consumable': 0,
  'material-returnable': 0,
  'material-custody-returned': 0,
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '-';
  }
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
      <path
        d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l1.8 2H18a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M3.5 9H20.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function ArchivePage() {
  const pathname = usePathname();
  const { user } = useAuth();
  const systemSource: ArchiveSource = pathname?.startsWith('/services')
    ? 'service'
    : 'materials';
  const defaultFolder: FolderKey =
    systemSource === 'service'
      ? 'service-correspondence'
      : 'material-consumable';
  const visibleFolders = useMemo(
    () => FOLDERS.filter((folder) => folder.source === systemSource),
    [systemSource]
  );
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [selected, setSelected] = useState<ArchiveRow | null>(null);
  const [activeFolder, setActiveFolder] = useState<FolderKey>(defaultFolder);
  const [folderCounts, setFolderCounts] =
    useState<Record<FolderKey, number>>(EMPTY_COUNTS);
  const [stats, setStats] = useState<ArchiveStats>({
    total: 0,
    folders: visibleFolders.length,
    activeFolderCount: 0,
  });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });

  useEffect(() => {
    setActiveFolder(defaultFolder);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [defaultFolder]);

  useEffect(() => {
    setSelected(null);
  }, [activeFolder, systemSource]);

  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [activeFolder, systemSource, deferredSearch]);

  useEffect(() => {
    if (user?.role !== 'manager') return;

    let mounted = true;

    (async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          source: systemSource,
          folder: activeFolder,
          page: String(pagination.page),
          limit: String(pagination.limit),
        });

        if (deferredSearch.trim()) {
          params.set('search', deferredSearch.trim());
        }

        const response = await fetch(`/api/archive?${params.toString()}`, {
          cache: 'no-store',
        });
        const json = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(String(json?.error || 'تعذر جلب الأرشيف'));
        }

        const nextPagination: PaginationState = {
          page: Number(json?.pagination?.page || pagination.page || 1),
          limit: Number(json?.pagination?.limit || pagination.limit || PAGE_LIMIT),
          total: Number(json?.pagination?.total || 0),
          totalPages: Math.max(1, Number(json?.pagination?.totalPages || 1)),
        };

        if (pagination.page > nextPagination.totalPages && nextPagination.totalPages > 0) {
          if (mounted) {
            setPagination((prev) => ({
              ...prev,
              page: nextPagination.totalPages,
            }));
          }
          return;
        }

        if (!mounted) {
          return;
        }

        setRows(Array.isArray(json?.data) ? json.data : []);
        setFolderCounts({
          ...EMPTY_COUNTS,
          ...(json?.folderCounts || {}),
        });
        setStats({
          total: Number(json?.stats?.total || 0),
          folders: Number(json?.stats?.folders || visibleFolders.length),
          activeFolderCount: Number(json?.stats?.activeFolderCount || 0),
        });
        setPagination(nextPagination);
      } catch {
        if (!mounted) {
          return;
        }

        setRows([]);
        setFolderCounts(EMPTY_COUNTS);
        setStats({
          total: 0,
          folders: visibleFolders.length,
          activeFolderCount: 0,
        });
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    activeFolder,
    deferredSearch,
    pagination.limit,
    pagination.page,
    systemSource,
    user?.role,
    visibleFolders.length,
  ]);

  const activeFolderMeta =
    visibleFolders.find((folder) => folder.key === activeFolder) || visibleFolders[0];

  if (user?.role !== 'manager') {
    return (
      <div className="rounded-[22px] border border-red-200 bg-red-50 p-6 text-center text-red-700">
        غير مصرح لك بالوصول لهذه الصفحة
      </div>
    );
  }

  const FOLDER_COLORS: Record<string, { color: string; bg: string }> = {
    'service-correspondence': { color: '#2A6364', bg: '#eef5f4' },
    'service-maintenance': { color: '#1b4f68', bg: '#e7eff5' },
    'service-cleaning': { color: '#4F8F7A', bg: '#edf4f0' },
    'service-purchase': { color: '#8a6a37', bg: '#f7f1e4' },
    'service-other': { color: '#5A5A5A', bg: '#F0F0F0' },
    'material-consumable': { color: '#73384B', bg: '#f4e7eb' },
    'material-returnable': { color: '#2A6364', bg: '#eef5f4' },
    'material-custody-returned': { color: '#4F8F7A', bg: '#edf4f0' },
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <section className="overflow-hidden rounded-[20px] bg-gradient-to-l from-[#2c3a4a] to-[#3d5a6b] p-5 text-white shadow-[0_12px_32px_rgba(0,0,0,0.2)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/15">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8L2 7h20l-6-4z"/><path d="M10 12h4"/>
              </svg>
            </div>
            <div>
              <h1 className="text-[20px] font-extrabold">
                {systemSource === 'service' ? 'أرشيف الخدمات' : 'أرشيف المواد'}
              </h1>
              <div className="text-[11px] text-white/50">{stats.total} سجل مؤرشف</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'إجمالي السجلات', value: stats.total },
              { label: 'عدد المجلدات', value: stats.folders },
              { label: 'المجلد الحالي', value: stats.activeFolderCount },
            ].map((s) => (
              <div key={s.label} className="rounded-[12px] border border-white/10 bg-white/8 px-3 py-2 text-center">
                <div className="text-[20px] font-extrabold text-white">{s.value}</div>
                <div className="text-[10px] text-white/50">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Folder tabs */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {visibleFolders.map((folder) => (
            <button key={folder.key} type="button" onClick={() => setActiveFolder(folder.key)}
              className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${activeFolder === folder.key ? 'border-white/40 bg-white/20 text-white' : 'border-white/15 text-white/60 hover:border-white/30 hover:text-white/80'}`}>
              <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l1.8 2H18a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5v-9Z"/>
              </svg>
              {folder.title}
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${activeFolder === folder.key ? 'bg-white/25 text-white' : 'bg-white/10 text-white/50'}`}>
                {folderCounts[folder.key] || 0}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" fill="none" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B5BDBE]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالرمز أو الاسم أو مقدم الطلب..."
            className="h-10 w-full rounded-full border border-[#DADBD9] bg-white pr-9 pl-4 text-[13px] outline-none focus:border-[#2A6364]/40" />
        </div>
        <div className="shrink-0 rounded-full border border-[#DADBD9] bg-[#F9F9F9] px-3 py-2 text-[12px] font-semibold text-[#5A5A5A]">
          {activeFolderMeta?.title}
        </div>
      </div>

      {/* Records */}
      <div className="space-y-3">
        {loading ? (
          [1,2,3].map((i) => <div key={i} className="h-28 animate-pulse rounded-[16px] bg-[#F0F0F0]" />)
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[20px] border border-[#DADBD9] bg-white py-16 text-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-14 w-14 text-[#DADBD9]" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8L2 7h20l-6-4z"/><path d="M10 12h4"/>
            </svg>
            <p className="mt-3 text-[14px] font-bold text-[#B5BDBE]">لا توجد سجلات في هذا المجلد</p>
            <p className="mt-1 text-[12px] text-[#B5BDBE]">تظهر السجلات بعد اكتمال العمليات وإغلاقها</p>
          </div>
        ) : (
          rows.map((row) => {
            const fc = FOLDER_COLORS[row.folder] || { color: '#2A6364', bg: '#eef5f4' };
            return (
              <div key={row.id} className="overflow-hidden rounded-[16px] border border-[#DADBD9] bg-white">
                <div className="flex items-center gap-3 border-b border-[#F0F0F0] px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]" style={{ backgroundColor: fc.bg }}>
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke={fc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l1.8 2H18a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5v-9Z"/>
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-extrabold text-[#2A2A2A] truncate">{row.title}</div>
                    <div className="flex items-center gap-2 text-[11px] text-[#B5BDBE]">
                      <span className="font-mono">{row.code}</span>
                      <span>·</span>
                      <span>{row.requesterName}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: fc.bg, color: fc.color }}>{row.status}</span>
                    <button type="button" onClick={() => setSelected(row)}
                      className="rounded-[8px] bg-[#2A6364] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1e5152]">
                      تفاصيل
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-4">
                  {[
                    ['الإدارة', row.requesterDepartment],
                    ['التاريخ', formatDate(row.createdAt)],
                    ['المصدر', row.source === 'materials' ? 'مواد' : 'خدمي'],
                    ['ملاحظات', row.extra || row.description?.slice(0, 40) || '—'],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded-[8px] bg-[#F9F9F9] px-2.5 py-1.5">
                      <div className="text-[10px] text-[#B5BDBE]">{k as string}</div>
                      <div className="text-[12px] font-semibold text-[#2A2A2A] truncate">{v as string || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-[16px] border border-[#DADBD9] bg-white px-4 py-3">
          <button onClick={() => setPagination((p) => ({ ...p, page: Math.max(p.page - 1, 1) }))} disabled={pagination.page <= 1}
            className="rounded-full border border-[#DADBD9] px-4 py-1.5 text-[12px] font-bold text-[#5A5A5A] disabled:opacity-40">السابق</button>
          <div className="text-[12px] font-bold text-[#2A6364]">{pagination.page} / {pagination.totalPages} · {pagination.total} سجل</div>
          <button
            type="button"
            onClick={() =>
              setPagination((prev) => ({
                ...prev,
                page: Math.min(prev.page + 1, prev.totalPages),
              }))
            }
            disabled={pagination.page >= pagination.totalPages}
            className="rounded-full border border-[#DADBD9] px-4 py-1.5 text-[12px] font-bold text-[#5A5A5A] disabled:opacity-40">
            التالي
          </button>
        </div>
      )}

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `تفاصيل الأرشيف: ${selected.code}` : 'تفاصيل الأرشيف'}
        maxWidth="4xl"
      >
        {selected ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['المجلد', FOLDERS.find((folder) => folder.key === selected.folder)?.title || '-'],
              ['الرمز', selected.code],
              ['العنوان', selected.title],
              ['الحالة', selected.status],
              ['مقدم الطلب', selected.requesterName],
              ['الإدارة', selected.requesterDepartment],
              ['التاريخ', formatDate(selected.createdAt)],
              ['معلومة إضافية', selected.extra || '-'],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-[#e7ebea] bg-[#fcfdfd] p-3"
              >
                <div className="text-xs font-bold text-[#016564]">{label}</div>
                <div className="mt-1 text-sm text-[#425554]">{value}</div>
              </div>
            ))}
            <div className="sm:col-span-2 rounded-2xl border border-[#e7ebea] bg-[#fcfdfd] p-3">
              <div className="text-xs font-bold text-[#016564]">الوصف</div>
              <div className="mt-1 text-sm leading-7 text-[#425554]">
                {selected.description || '-'}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
