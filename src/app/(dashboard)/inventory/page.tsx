'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  getInventoryDisplayCategory,
  getInventoryDisplayName,
  getInventoryDisplayUnit,
  getInventoryTypeLabel,
} from '@/lib/inventoryLocalization';

type InventoryItem = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  subcategory?: string | null;
  type: 'RETURNABLE' | 'CONSUMABLE';
  quantity: number;
  availableQty: number;
  reservedQty: number;
  minStock: number;
  unit: string;
  location: string | null;
  status: 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  imageUrl?: string | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
  financialTracking?: boolean;
  maintenanceIntervalDays?: number | null;
  nextMaintenanceDueAt?: string | null;
  storeCatalogItems?: {
    id: string;
    isVisible: boolean;
    imageUrl?: string | null;
    onDemandNote?: string | null;
    sortOrder?: number | null;
  }[];
  _count?: { custodyRecords?: number };
};

type StoreItem = {
  id: string;
  title: string;
  inventoryItemId?: string | null;
  isOnDemand: boolean;
  isVisible: boolean;
  stockQty: number;
};

type Bundle = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  isVisible?: boolean;
  items: { catalogItemId: string; quantity: number; quantityMode?: 'FIXED' | 'PER_TRAINEE'; title: string }[];
};

type InventoryApiResponse = {
  data: InventoryItem[];
  categories?: string[];
  stats?: {
    totalItems: number;
    totalUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalEstimatedValue: number;
    returnableCount: number;
    consumableCount: number;
    availableCount: number;
    usedCount: number;
    visibleInStoreCount: number;
    missingImagesCount: number;
  };
  pagination?: {
    page: number;
    total: number;
    totalPages: number;
    limit: number;
  };
};

const emptyStats = {
  totalItems: 0,
  totalUnits: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  totalEstimatedValue: 0,
  returnableCount: 0,
  consumableCount: 0,
  availableCount: 0,
  usedCount: 0,
  visibleInStoreCount: 0,
  missingImagesCount: 0,
};

const defaultForm = {
  name: '',
  category: '',
  type: 'RETURNABLE' as 'RETURNABLE' | 'CONSUMABLE',
  quantity: '0',
  minStock: '5',
  unitPrice: '',
  imageUrl: '',
  showInStore: true,
  storeOnDemandNote: '',
  storeSortOrder: '0',
  maintenanceIntervalDays: '',
  nextMaintenanceDueAt: '',
};

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('ar-SA').format(value);
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 2,
  }).format(value);
};

const statCardClass =
  'surface-card-strong cursor-pointer rounded-[18px] p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg';

function getStoreMeta(item: InventoryItem) {
  return item.storeCatalogItems?.[0] || null;
}

function getItemImage(item: InventoryItem) {
  return item.imageUrl || getStoreMeta(item)?.imageUrl || null;
}

/* ─── Auto-generate category SVG images ─── */
function generateItemSvgDataUrl(name: string, category: string): string {
  const c = category || '';
  const firstChar = (name || '؟').slice(0, 2).trim();

  type Theme = { bg1: string; bg2: string; stroke: string; badge: string };
  const theme: Theme =
    /قلم|أقلام|قرطاسية/.test(c) ? { bg1: '#eef5f4', bg2: '#d9edea', stroke: '#2A6364', badge: '#2A6364' } :
    /نوت|دفتر|كتاب/.test(c)    ? { bg1: '#eef5f4', bg2: '#d9edea', stroke: '#1e6b4c', badge: '#1e6b4c' } :
    /ملف|فولدر|حافظة/.test(c)  ? { bg1: '#f7f1e4', bg2: '#ede0c8', stroke: '#8a6a37', badge: '#8a6a37' } :
    /شهادة|جائزة/.test(c)      ? { bg1: '#f7f1e4', bg2: '#ede0c8', stroke: '#b79059', badge: '#b79059' } :
    /لابتوب|حاسب|جهاز|USB/.test(c) ? { bg1: '#e7eff5', bg2: '#cde0ec', stroke: '#1b4f68', badge: '#1b4f68' } :
    /ميكروفون|مكبر|صوت/.test(c) ? { bg1: '#eef5f4', bg2: '#d9edea', stroke: '#2A6364', badge: '#2A6364' } :
    /سبورة|لوح|ماركر/.test(c)  ? { bg1: '#f4e7eb', bg2: '#e8ccd5', stroke: '#7c1e3e', badge: '#7c1e3e' } :
    /تقني|جهاز|حاسب/.test(c)  ? { bg1: '#e7eff5', bg2: '#cde0ec', stroke: '#1b4f68', badge: '#1b4f68' } :
      { bg1: '#eef5f4', bg2: '#d9edea', stroke: '#2A6364', badge: '#2A6364' };

  // Determine icon paths based on category
  const iconPath: string =
    /قلم|أقلام/.test(c)        ? '<path d="M52 20l8 8L32 56H24v-8L52 20z" stroke-width="2.5" stroke-linejoin="round"/><path d="M45 27l8 8M24 48l4 4" stroke-width="2" stroke-linecap="round"/>' :
    /نوت|دفتر/.test(c)         ? '<rect x="24" y="14" width="36" height="52" rx="4" fill="white" stroke-width="2"/><rect x="18" y="20" width="8" height="40" rx="2" fill="' + theme.stroke + '" opacity=".4"/><path d="M32 28h20M32 36h20M32 44h14" stroke-width="2" stroke-linecap="round"/>' :
    /ملف|فولدر/.test(c)        ? '<path d="M14 30a4 4 0 0 1 4-4h16l6 6h22a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V30z" fill="' + theme.stroke + '" opacity=".2" stroke-width="2"/><path d="M28 50h24M28 43h16" stroke-width="2" stroke-linecap="round"/>' :
    /شهادة/.test(c)            ? '<rect x="16" y="18" width="48" height="32" rx="4" fill="white" stroke-width="2"/><path d="M26 30h28M26 38h18" stroke-width="2" stroke-linecap="round"/><circle cx="40" cy="60" r="9" fill="' + theme.stroke + '" opacity=".25" stroke-width="2"/><path d="M37 60l2.5 2.5 5-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' :
    /لابتوب|حاسب/.test(c)     ? '<rect x="14" y="20" width="52" height="30" rx="4" fill="white" stroke-width="2"/><rect x="20" y="26" width="40" height="18" rx="2" fill="' + theme.bg1 + '"/><path d="M8 50h64l-4 8H12l-4-8z" fill="white" stroke-width="2"/><circle cx="40" cy="55" r="2" fill="' + theme.stroke + '" opacity=".4"/>' :
    /ميكروفون/.test(c)         ? '<rect x="32" y="14" width="16" height="26" rx="8" fill="white" stroke-width="2"/><path d="M24 36a16 16 0 0 0 32 0M40 52v8M32 60h16" stroke-width="2" stroke-linecap="round"/>' :
    /سبورة|لوح/.test(c)        ? '<rect x="12" y="16" width="56" height="36" rx="4" fill="white" stroke-width="2"/><path d="M22 38l8-10 7 7 6-6 8 9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 52l4 8h8l4-8" stroke-width="1.5" stroke-linecap="round"/>' :
      '<path d="M22 26a4 4 0 0 1 4-4h28l10 10v26a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V26z" fill="white" stroke-width="2"/><path d="M54 22v10h10" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><path d="M30 36h20M30 44h14" stroke-width="2" stroke-linecap="round"/>';

  const truncatedName = name.length > 18 ? name.slice(0, 16) + '…' : name;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" width="320" height="240">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.bg1}"/>
      <stop offset="100%" stop-color="${theme.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="320" height="240" fill="url(#bg)" rx="0"/>
  <circle cx="260" cy="40" r="60" fill="${theme.stroke}" opacity=".05"/>
  <circle cx="60" cy="200" r="80" fill="${theme.stroke}" opacity=".05"/>
  <g transform="translate(120,50)" stroke="${theme.stroke}" fill="none" stroke-linecap="round">
    ${iconPath}
  </g>
  <rect x="0" y="178" width="320" height="62" fill="${theme.stroke}" opacity=".08"/>
  <text x="160" y="204" font-family="Cairo,Arial" font-size="15" font-weight="700" fill="${theme.stroke}" text-anchor="middle" dominant-baseline="middle">${truncatedName}</text>
  <text x="160" y="225" font-family="Cairo,Arial" font-size="11" fill="${theme.stroke}" opacity=".65" text-anchor="middle" dominant-baseline="middle">${category}</text>
  <rect x="8" y="8" width="54" height="22" rx="11" fill="${theme.badge}" opacity=".15"/>
  <text x="35" y="20" font-family="Cairo,Arial" font-size="10" font-weight="700" fill="${theme.badge}" text-anchor="middle" dominant-baseline="middle">${firstChar}</text>
</svg>`;

  try {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  } catch {
    return '';
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  const image = document.createElement('img');
  const reader = new FileReader();
  const loaded = new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
  });
  reader.readAsDataURL(file);
  image.src = await loaded;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });
  const canvas = document.createElement('canvas');
  const maxWidth = 900;
  const scale = Math.min(1, maxWidth / image.width);
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.76);
}

/* ═════════════════════════════════════════════════════
   BULK IMAGE UPLOAD — match files → items then save all
═════════════════════════════════════════════════════ */

type BulkMatch = {
  file: File;
  dataUrl: string | null;
  itemId: string | null;
  confidence: number;
  status: 'pending' | 'converting' | 'ready' | 'saving' | 'done' | 'error';
};

function normalizeBulk(text: string) {
  return text.toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatch(filename: string, item: InventoryItem): number {
  const fn = normalizeBulk(filename);
  const name = normalizeBulk(item.name);
  const code = (item.code || '').toLowerCase().trim();
  if (fn === name) return 100;
  if (fn === code) return 95;
  if (name.includes(fn) || fn.includes(name)) return 82;
  if (code && (code.includes(fn) || fn.includes(code))) return 75;
  const fnWords = fn.split(' ').filter((w) => w.length > 1);
  const nameWords = name.split(' ').filter((w) => w.length > 1);
  const overlap = fnWords.filter((w) => nameWords.some((nw) => nw.includes(w) || w.includes(nw))).length;
  if (overlap > 0) return Math.round((overlap / Math.max(fnWords.length, nameWords.length)) * 65);
  return 0;
}

function ConfidenceBadge({ score }: { score: number }) {
  const [color, label] =
    score >= 85 ? ['bg-[#eef8f2] text-[#1e6b4c] border-[#cce6d7]', 'تطابق ممتاز'] :
    score >= 55 ? ['bg-[#fffaf0] text-[#8a6a37] border-[#e8ddbf]', 'تطابق جيد'] :
    score >= 30 ? ['bg-[#f4e7eb] text-[#7c1e3e] border-[#ecd0d8]', 'تطابق ضعيف'] :
    ['bg-[#f3f5f5] text-[#8a9a98] border-[#dce6e3]', 'بدون تطابق'];
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${color}`}>
      {score > 0 ? `${score}% — ${label}` : label}
    </span>
  );
}

function BulkUploadModal({
  items,
  onClose,
  onDone,
}: {
  items: InventoryItem[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [matches, setMatches] = useState<BulkMatch[]>([]);
  const [step, setStep] = useState<'select' | 'review' | 'saving' | 'done'>('select');
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [dragOver, setDragOver] = useState(false);

  async function processFiles(files: File[]) {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (!imageFiles.length) return;

    const initial: BulkMatch[] = imageFiles.map((file) => {
      const scores = items
        .map((item) => ({ item, score: scoreMatch(file.name, item) }))
        .sort((a, b) => b.score - a.score);
      const best = scores[0];
      return {
        file,
        dataUrl: null,
        itemId: best.score >= 30 ? best.item.id : null,
        confidence: best.score,
        status: 'converting' as const,
      };
    });
    setMatches(initial);
    setStep('review');

    for (let i = 0; i < imageFiles.length; i++) {
      try {
        const dataUrl = await fileToDataUrl(imageFiles[i]);
        setMatches((prev) => prev.map((m, idx) => idx === i ? { ...m, dataUrl, status: 'ready' } : m));
      } catch {
        setMatches((prev) => prev.map((m, idx) => idx === i ? { ...m, status: 'error' } : m));
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    processFiles(Array.from(e.dataTransfer.files));
  }

  function setItemId(idx: number, itemId: string) {
    setMatches((prev) => prev.map((m, i) => i === idx ? { ...m, itemId } : m));
  }

  function removeMatch(idx: number) {
    setMatches((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveAll() {
    const toSave = matches.filter((m) => m.itemId && m.dataUrl);
    setProgress({ done: 0, total: toSave.length, errors: 0 });
    setStep('saving');

    for (const match of toSave) {
      const item = items.find((i) => i.id === match.itemId);
      if (!item) continue;
      try {
        await fetch(`/api/inventory/${match.itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            category: item.category,
            type: item.type,
            quantity: item.quantity,
            minStock: item.minStock,
            unitPrice: item.unitPrice ?? null,
            financialTracking: item.financialTracking || false,
            imageUrl: match.dataUrl,
            showInStore: true,
            storeOnDemandNote: getStoreMeta(item)?.onDemandNote || null,
            storeSortOrder: getStoreMeta(item)?.sortOrder ?? 0,
          }),
        });
        setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
      } catch {
        setProgress((prev) => ({ ...prev, done: prev.done + 1, errors: prev.errors + 1 }));
      }
    }

    await onDone();
    setStep('done');
  }

  const readyCount = matches.filter((m) => m.status === 'ready' && m.itemId).length;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="relative flex max-h-[90vh] w-full max-w-[900px] flex-col rounded-[20px] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dce6e3] px-5 py-4">
          <div>
            <h2 className="text-[18px] font-extrabold text-[#203634]">رفع صور دفعي</h2>
            <p className="mt-0.5 text-[12px] text-[#8a9a98]">سمّ ملفات الصور باسم المادة — النظام سيطابقها تلقائياً</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f8f7] text-[#5a6f6e] hover:bg-[#dce6e3]">✕</button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">

          {/* STEP: select */}
          {step === 'select' && (
            <div className="space-y-4">
              {/* Instructions */}
              <div className="rounded-[14px] border border-[#e8ddbf] bg-[#fffaf0] p-4">
                <p className="text-[13px] font-bold text-[#8a6a37]">كيف يعمل الرفع الدفعي؟</p>
                <ol className="mt-2 space-y-1.5 text-[12px] leading-6 text-[#7f6b43]" style={{ listStyle: 'arabic-indic', paddingRight: '1.2em' }}>
                  <li>سمّ كل صورة بنفس اسم المادة في المخزون — مثلاً: <code className="rounded bg-[#f5edd8] px-1">أقلام سبورة.jpg</code></li>
                  <li>اختر جميع الصور دفعة واحدة</li>
                  <li>راجع المطابقات واعدّل أي مادة خاطئة</li>
                  <li>اضغط «حفظ الكل» — ستُحفظ جميع الصور مرة واحدة</li>
                </ol>
                <p className="mt-2 text-[11px] text-[#9a7a48]">💡 يقبل النظام: JPG, PNG, WebP, AVIF — الحجم المثالي: أقل من 500KB للملف</p>
              </div>

              {/* Drop zone */}
              <label
                className={`flex cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed py-14 transition ${dragOver ? 'border-[#2A6364] bg-[#eef5f4]' : 'border-[#DADBD9] bg-[#f8fbfb] hover:border-[#2A6364]/40 hover:bg-[#f4f9f8]'}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-[#B5BDBE]" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                <p className="mt-3 text-[14px] font-bold text-[#5A5A5A]">اسحب الصور هنا أو اضغط للاختيار</p>
                <p className="mt-1 text-[12px] text-[#B5BDBE]">يمكن اختيار عدة صور دفعة واحدة</p>
                <input type="file" multiple accept="image/*" className="hidden"
                  onChange={(e) => processFiles(Array.from(e.target.files || []))} />
              </label>
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px] text-[#5A5A5A]">
                  <span className="font-bold text-[#2A6364]">{matches.length}</span> ملف · <span className="font-bold text-[#1e6b4c]">{readyCount}</span> مطابق وجاهز للحفظ
                </div>
                <button onClick={() => { setMatches([]); setStep('select'); }} className="text-[12px] text-[#2A6364] underline">اختيار صور أخرى</button>
              </div>

              <div className="overflow-hidden rounded-[14px] border border-[#dce6e3]">
                <table className="w-full text-right text-[13px]">
                  <thead>
                    <tr className="bg-[#f4f8f7] text-[11px] text-[#2A6364]">
                      <th className="px-3 py-2.5 font-bold">الصورة</th>
                      <th className="px-3 py-2.5 font-bold">اسم الملف</th>
                      <th className="px-3 py-2.5 font-bold">التطابق</th>
                      <th className="px-3 py-2.5 font-bold">المادة المطابقة</th>
                      <th className="px-3 py-2.5 font-bold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f4f3]">
                    {matches.map((m, idx) => (
                      <tr key={idx} className={`${!m.itemId ? 'bg-[#fffaf0]' : ''}`}>
                        {/* Thumbnail */}
                        <td className="px-3 py-2">
                          <div className="flex h-12 w-16 items-center justify-center overflow-hidden rounded-[8px] border border-[#dce6e3] bg-[#f4f8f7]">
                            {m.status === 'converting' ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#dce6e3] border-t-[#2A6364]" />
                            ) : m.dataUrl ? (
                              <img src={m.dataUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[10px] text-[#B5BDBE]">خطأ</span>
                            )}
                          </div>
                        </td>
                        {/* Filename */}
                        <td className="px-3 py-2">
                          <div className="max-w-[180px] truncate text-[12px] text-[#5A5A5A]">{m.file.name}</div>
                          <div className="text-[10px] text-[#B5BDBE]">{(m.file.size / 1024).toFixed(0)} KB</div>
                        </td>
                        {/* Confidence */}
                        <td className="px-3 py-2"><ConfidenceBadge score={m.confidence} /></td>
                        {/* Item selector */}
                        <td className="px-3 py-2">
                          <select
                            value={m.itemId || ''}
                            onChange={(e) => setItemId(idx, e.target.value)}
                            className="h-9 w-full min-w-[200px] rounded-[8px] border border-[#dce6e3] bg-white px-2 text-[12px] outline-none focus:border-[#2A6364]/40"
                          >
                            <option value="">— اختر المادة يدوياً —</option>
                            {items.map((item) => (
                              <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                            ))}
                          </select>
                        </td>
                        {/* Remove */}
                        <td className="px-3 py-2">
                          <button onClick={() => removeMatch(idx)} className="text-[#7c1e3e] hover:underline text-[11px]">حذف</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP: saving */}
          {(step === 'saving' || step === 'done') && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              {step === 'saving' ? (
                <>
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#dce6e3] border-t-[#2A6364]" />
                  <p className="mt-4 text-[16px] font-bold text-[#203634]">جاري الحفظ...</p>
                  <p className="mt-1 text-[13px] text-[#8a9a98]">{progress.done} من {progress.total}</p>
                  <div className="mt-4 h-2 w-full max-w-[320px] overflow-hidden rounded-full bg-[#edf3f2]">
                    <div className="h-2 rounded-full bg-[#2A6364] transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef5f4]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-[#2A6364]" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </div>
                  <p className="mt-4 text-[18px] font-extrabold text-[#203634]">تم حفظ الصور بنجاح!</p>
                  <p className="mt-1 text-[13px] text-[#8a9a98]">
                    {progress.done - progress.errors} صورة محفوظة
                    {progress.errors > 0 && ` · ${progress.errors} أخطاء`}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step === 'review' && (
          <div className="flex items-center justify-between border-t border-[#dce6e3] px-5 py-4">
            <div className="text-[12px] text-[#8a9a98]">
              {readyCount === 0 ? 'لا توجد صور جاهزة للحفظ' : `${readyCount} صورة ستُحفظ`}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="border border-slate-200" onClick={onClose}>إلغاء</Button>
              <Button
                className="bg-[#2A6364] text-white hover:bg-[#214f50]"
                disabled={readyCount === 0}
                onClick={saveAll}
              >
                حفظ {readyCount} صورة
              </Button>
            </div>
          </div>
        )}
        {step === 'done' && (
          <div className="flex justify-center border-t border-[#dce6e3] px-5 py-4">
            <Button className="bg-[#2A6364] text-white hover:bg-[#214f50]" onClick={onClose}>إغلاق</Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'items' | 'summary' | 'bundles' | 'alerts'>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summaryItems, setSummaryItems] = useState<InventoryItem[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState(emptyStats);
  const [alertItems, setAlertItems] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [formState, setFormState] = useState(defaultForm);

  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageGenProgress, setImageGenProgress] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const canModify = user?.role === 'manager' || user?.role === 'warehouse';
  const selectedBundle = useMemo(() => bundles.find((bundle) => bundle.id === selectedBundleId) || bundles[0], [bundles, selectedBundleId]);
  const catalogChoices = useMemo(() => storeItems.filter((item) => !item.isOnDemand), [storeItems]);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      const response = await fetch(`/api/inventory?${params.toString()}`, { cache: 'no-store' });
      const data: InventoryApiResponse = await response.json();
      if (!response.ok) throw new Error((data as any)?.error || 'تعذر تحميل مواد المخزن');
      const rows = Array.isArray(data.data) ? data.data : [];
      setItems(rows);
      setCategories(data.categories || []);
      setStats({ ...emptyStats, ...(data.stats || {}) });
      setPagination((prev) => ({
        ...prev,
        totalPages: data.pagination?.totalPages || 1,
        total: data.pagination?.total || rows.length,
      }));
    } catch (err: any) {
      setItems([]);
      setStats(emptyStats);
      setError(err?.message || 'تعذر تحميل مواد المخزن');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, typeFilter, categoryFilter]);

  const fetchBundles = useCallback(async () => {
    try {
      const response = await fetch('/api/store-admin', { cache: 'no-store', credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      setStoreItems(Array.isArray(data.items) ? data.items : []);
      setBundles(Array.isArray(data.bundles) ? data.bundles : []);
    } catch {
      setStoreItems([]);
      setBundles([]);
    }
  }, []);

  const fetchSummaryItems = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '500' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      const response = await fetch(`/api/inventory?${params.toString()}`, { cache: 'no-store' });
      const data: InventoryApiResponse = await response.json();
      if (!response.ok) throw new Error((data as any)?.error || 'تعذر تحميل ملخص المواد');
      setSummaryItems(Array.isArray(data.data) ? data.data : []);
    } catch {
      setSummaryItems([]);
    } finally {
      setSummaryLoading(false);
    }
  }, [search, statusFilter, typeFilter, categoryFilter]);

  const fetchAlertItems = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '500' });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      const response = await fetch(`/api/inventory?${params.toString()}`, { cache: 'no-store' });
      const data: InventoryApiResponse = await response.json();
      if (!response.ok) throw new Error((data as any)?.error || 'تعذر تحميل تنبيهات المخزون');
      setAlertItems(Array.isArray(data.data) ? data.data : []);
    } catch {
      setAlertItems([]);
    } finally {
      setAlertsLoading(false);
    }
  }, [search, typeFilter, categoryFilter]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    if (canModify) fetchBundles();
  }, [canModify, fetchBundles]);

  useEffect(() => {
    if (activeTab === 'summary') fetchSummaryItems();
  }, [activeTab, fetchSummaryItems]);

  useEffect(() => {
    if (activeTab === 'alerts') fetchAlertItems();
  }, [activeTab, fetchAlertItems]);

  const openCreateModal = () => {
    setSelectedItem(null);
    setFormState(defaultForm);
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    const storeMeta = getStoreMeta(item);
    setSelectedItem(item);
    setFormState({
      name: item.name || '',
      category: item.category || '',
      type: item.type || 'RETURNABLE',
      quantity: String(item.quantity ?? 0),
      minStock: String(item.minStock ?? 5),
      unitPrice: item.unitPrice === null || item.unitPrice === undefined ? '' : String(item.unitPrice),
      imageUrl: getItemImage(item) || '',
      showInStore: storeMeta?.isVisible ?? true,
      storeOnDemandNote: storeMeta?.onDemandNote || '',
      storeSortOrder: String(storeMeta?.sortOrder ?? 0),
      maintenanceIntervalDays: item.maintenanceIntervalDays === null || item.maintenanceIntervalDays === undefined ? '' : String(item.maintenanceIntervalDays),
      nextMaintenanceDueAt: item.nextMaintenanceDueAt ? String(item.nextMaintenanceDueAt).slice(0, 10) : '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
    setFormState(defaultForm);
  };

  const saveItemVisibility = async (item: InventoryItem, checked: boolean) => {
    if (!canModify) return;
    await saveInventory(item.id, {
      name: item.name,
      category: item.category,
      type: item.type,
      quantity: item.quantity,
      minStock: item.minStock,
      unitPrice: item.unitPrice ?? null,
      financialTracking: item.financialTracking || item.unitPrice !== null,
      imageUrl: item.imageUrl || null,
      showInStore: checked,
      storeOnDemandNote: getStoreMeta(item)?.onDemandNote || null,
      storeSortOrder: getStoreMeta(item)?.sortOrder ?? 0,
    }, false);
  };

  const saveInventory = async (id: string | null, payload: any, refreshBundles = true) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(id ? `/api/inventory/${id}` : '/api/inventory', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'تعذر حفظ المادة');
      await fetchInventory();
      if (refreshBundles) await fetchBundles();
      return true;
    } catch (err: any) {
      setError(err?.message || 'تعذر حفظ المادة');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      name: formState.name,
      category: formState.category,
      type: formState.type,
      quantity: Number(formState.quantity || 0),
      minStock: Number(formState.minStock || 5),
      unitPrice: formState.unitPrice === '' ? null : Number(formState.unitPrice),
      financialTracking: formState.unitPrice !== '',
      imageUrl: formState.imageUrl || null,
      showInStore: formState.showInStore,
      storeOnDemandNote: formState.storeOnDemandNote || null,
      storeSortOrder: Number(formState.storeSortOrder || 0),
      maintenanceIntervalDays: formState.type === 'RETURNABLE' && formState.maintenanceIntervalDays ? Number(formState.maintenanceIntervalDays) : null,
      nextMaintenanceDueAt: formState.type === 'RETURNABLE' && formState.maintenanceIntervalDays ? formState.nextMaintenanceDueAt || null : null,
    };
    const ok = await saveInventory(selectedItem?.id || null, payload);
    if (ok) closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل تريد حذف هذه المادة؟')) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'تعذر حذف المادة');
      await fetchInventory();
      await fetchBundles();
    } catch (err: any) {
      setError(err?.message || 'تعذر حذف المادة');
    } finally {
      setSaving(false);
    }
  };

  const saveBundle = async (bundle: Bundle) => {
    setSaving(true);
    try {
      const response = await fetch('/api/store-admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...bundle, type: 'bundle' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'تعذر تحديث البكج');
      await fetchBundles();
    } catch (err: any) {
      setError(err?.message || 'تعذر تحديث البكج');
    } finally {
      setSaving(false);
    }
  };

  const updateBundle = (patch: Partial<Bundle>) => {
    if (!selectedBundle) return;
    const next = { ...selectedBundle, ...patch };
    setBundles((prev) => prev.map((bundle) => (bundle.id === selectedBundle.id ? next : bundle)));
  };

  const setBundleItem = (catalogItemId: string, checked: boolean) => {
    if (!selectedBundle) return;
    const current = selectedBundle.items || [];
    const nextItems = checked
      ? current.some((item) => item.catalogItemId === catalogItemId)
        ? current
        : [...current, { catalogItemId, quantity: 1, quantityMode: 'FIXED' as const, title: catalogChoices.find((item) => item.id === catalogItemId)?.title || '' }]
      : current.filter((item) => item.catalogItemId !== catalogItemId);
    updateBundle({ items: nextItems });
  };

  const updateBundleItem = (catalogItemId: string, patch: Partial<Bundle['items'][number]>) => {
    if (!selectedBundle) return;
    updateBundle({ items: selectedBundle.items.map((item) => (item.catalogItemId === catalogItemId ? { ...item, ...patch } : item)) });
  };

  const applyGeneratedImages = async () => {
    const itemsWithoutImages = items.filter((item) => !getItemImage(item));
    if (!itemsWithoutImages.length) {
      setImageGenProgress('جميع المواد لديها صور بالفعل ✓');
      setTimeout(() => setImageGenProgress(''), 3000);
      return;
    }
    setGeneratingImages(true);
    setImageGenProgress(`جاري توليد ${itemsWithoutImages.length} صورة...`);
    let done = 0;
    for (const item of itemsWithoutImages) {
      const imageUrl = generateItemSvgDataUrl(item.name, item.category);
      if (!imageUrl) continue;
      try {
        await fetch(`/api/inventory/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name, category: item.category, type: item.type,
            quantity: item.quantity, minStock: item.minStock,
            unitPrice: item.unitPrice ?? null, financialTracking: item.financialTracking || false,
            imageUrl,
            showInStore: getStoreMeta(item)?.isVisible ?? true,
            storeOnDemandNote: getStoreMeta(item)?.onDemandNote || null,
            storeSortOrder: getStoreMeta(item)?.sortOrder ?? 0,
          }),
        });
        done += 1;
        setImageGenProgress(`تم ${done} من ${itemsWithoutImages.length}...`);
      } catch { /* skip */ }
    }
    await fetchInventory();
    setGeneratingImages(false);
    setImageGenProgress(`تم توليد ${done} صورة بنجاح ✓`);
    setTimeout(() => setImageGenProgress(''), 4000);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setCategoryFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const alerts = useMemo(
    () => alertItems.filter((item) => item.status !== 'AVAILABLE' || !getItemImage(item) || !(getStoreMeta(item)?.isVisible ?? true)),
    [alertItems],
  );

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-[14px] border border-[#dce6e3] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[13px] text-[#6f817f]">المخزون هو المصدر الأساسي للصور والكميات والظهور للمدرب</div>
            <h1 className="mt-1 text-[28px] text-[#203634]">إدارة مواد المخزن</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {imageGenProgress && (
              <span className="rounded-full border border-[#dce6e3] bg-[#f4f8f7] px-3 py-1 text-[12px] text-[#2A6364]">{imageGenProgress}</span>
            )}
            <Button variant="ghost" className="border border-slate-200" onClick={() => window.open('/training-kit', '_blank')}>معاينة المتجر</Button>
            {canModify ? (
              <Button
                variant="ghost"
                className="border border-[#2A6364]/30 bg-[#eef5f4] text-[#2A6364] hover:bg-[#e0f0ef]"
                onClick={() => setShowBulkUpload(true)}
              >
                رفع صور دفعي
              </Button>
            ) : null}
            {canModify && stats.missingImagesCount > 0 ? (
              <Button
                variant="ghost"
                className="border border-[#d9c99f] bg-[#fffaf0] text-[#7f6030] hover:bg-[#f5edd8]"
                disabled={generatingImages}
                onClick={applyGeneratedImages}
              >
                {generatingImages ? 'جاري التوليد...' : `توليد صور تلقائية (${stats.missingImagesCount})`}
              </Button>
            ) : null}
            {canModify ? <Button className="bg-[#2A6364] text-white hover:bg-[#214f50]" onClick={openCreateModal}>+ إضافة مادة</Button> : null}
          </div>
        </div>
      </section>

      {error ? <div className="rounded-[8px] border border-[#eed9df] bg-[#fff7f8] px-4 py-3 text-[13px] text-[#7a3147]">{error}</div> : null}

      {showBulkUpload ? (
        <BulkUploadModal
          items={items}
          onClose={() => setShowBulkUpload(false)}
          onDone={async () => { await fetchInventory(); await fetchBundles(); }}
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="إجمالي المواد" value={stats.totalItems} tone="teal" onClick={() => { clearFilters(); setActiveTab('items'); }} />
        <StatCard label="مواد نشطة" value={stats.availableCount} tone="green" onClick={() => { setStatusFilter('AVAILABLE'); setActiveTab('items'); }} />
        <StatCard label="مواد منخفضة" value={stats.lowStockCount} tone="amber" onClick={() => { setStatusFilter('LOW_STOCK'); setActiveTab('items'); }} />
        <StatCard label="مواد نفدت" value={stats.outOfStockCount} tone="rose" onClick={() => { setStatusFilter('OUT_OF_STOCK'); setActiveTab('items'); }} />
        <StatCard label="بدون صور" value={stats.missingImagesCount} tone="blue" onClick={() => setActiveTab('alerts')} />
        <Card className={`${statCardClass} border-[#d8c59c] bg-[#fffaf0]`}><div className="text-[12px] text-slate-500">القيمة التقديرية</div><div className="mt-2 text-[18px] text-[#203634]">{formatCurrency(stats.totalEstimatedValue)}</div></Card>
      </div>

      <Card className="rounded-[14px] border border-[#dce6e3] bg-white p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <TabButton active={activeTab === 'items'} onClick={() => setActiveTab('items')}>المواد</TabButton>
            <TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')}>ملخص المواد</TabButton>
            <TabButton active={activeTab === 'bundles'} onClick={() => setActiveTab('bundles')}>البكجات</TabButton>
            <TabButton active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')}>تنبيهات المخزون</TabButton>
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(180px,280px)_160px_150px_140px_110px]">
            <Input placeholder="بحث عن مادة" value={search} onChange={(event) => { setSearch(event.target.value); setPagination((prev) => ({ ...prev, page: 1 })); }} />
            <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPagination((prev) => ({ ...prev, page: 1 })); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">كل الفئات</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPagination((prev) => ({ ...prev, page: 1 })); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">كل الأنواع</option>
              <option value="RETURNABLE">مسترجعة</option>
              <option value="CONSUMABLE">مستهلكة</option>
            </select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPagination((prev) => ({ ...prev, page: 1 })); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">كل الحالات</option>
              <option value="AVAILABLE">متاح</option>
              <option value="LOW_STOCK">منخفض</option>
              <option value="OUT_OF_STOCK">نافد</option>
            </select>
            <select value={pagination.limit} onChange={(event) => setPagination((prev) => ({ ...prev, page: 1, limit: Number(event.target.value) }))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value={10}>10 مواد</option>
              <option value={20}>20 مادة</option>
            </select>
          </div>
        </div>
      </Card>

      {activeTab === 'items' ? (
        <InventoryTable
          items={items}
          loading={loading}
          canModify={canModify}
          showImages
          onEdit={openEditModal}
          onDelete={handleDelete}
          onVisibility={saveItemVisibility}
        />
      ) : null}

      {activeTab === 'summary' ? (
        <div className="space-y-3">
          <div className="rounded-[12px] border border-[#dce6e3] bg-[#f8fbfb] px-4 py-3 text-sm text-[#536866]">
            يظهر الملخص جميع المواد المطابقة للفلاتر الحالية بدون صور لتسهيل الحصر والجرد السريع. عدد المواد: {formatNumber(summaryItems.length)}
          </div>
          <InventoryTable
            items={summaryItems}
            loading={summaryLoading}
            canModify={false}
            showImages={false}
            compact
            onEdit={openEditModal}
            onDelete={handleDelete}
            onVisibility={saveItemVisibility}
          />
        </div>
      ) : null}

      {activeTab === 'alerts' ? (
        <InventoryTable
          items={alerts}
          loading={alertsLoading}
          canModify={canModify}
          showImages
          onEdit={openEditModal}
          onDelete={handleDelete}
          onVisibility={saveItemVisibility}
        />
      ) : null}

      {activeTab === 'bundles' ? (
        <BundlesPanel
          bundles={bundles}
          selectedBundle={selectedBundle}
          catalogChoices={catalogChoices}
          saving={saving}
          onSelect={setSelectedBundleId}
          onUpdate={updateBundle}
          onSetItem={setBundleItem}
          onUpdateItem={updateBundleItem}
          onSave={saveBundle}
        />
      ) : null}

      {activeTab !== 'bundles' && activeTab !== 'summary' ? (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPage={(page) => setPagination((prev) => ({ ...prev, page }))}
        />
      ) : null}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedItem ? 'تعديل مادة المخزن' : 'إضافة مادة للمخزن'}>
        <form onSubmit={handleFormSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="rounded-[10px] border border-[#dce6e3] bg-[#f7faf9] p-3">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[8px] bg-white">
                {formState.imageUrl ? <img src={formState.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-sm text-slate-400">صورة المادة</span>}
              </div>
              <input
                type="file"
                accept="image/*"
                className="mt-3 w-full text-[12px]"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    const imageUrl = await fileToDataUrl(file);
                    setFormState((prev) => ({ ...prev, imageUrl }));
                  }
                }}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="اسم المادة" value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} required />
              <Input label="الفئة" value={formState.category} onChange={(event) => setFormState((prev) => ({ ...prev, category: event.target.value }))} list="inventory-categories" required />
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600">نوع المادة</label>
                <select value={formState.type} onChange={(event) => setFormState((prev) => ({ ...prev, type: event.target.value as any }))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">
                  <option value="RETURNABLE">مسترجعة — تُعاد بعد الاستخدام (عهدة)</option>
                  <option value="CONSUMABLE">مستهلكة — لا تُعاد (تُخصم عند الصرف)</option>
                </select>
                <p className="text-[10px] text-slate-400">
                  {formState.type === 'RETURNABLE' ? 'تُنشئ عهدة على المستلم وتظهر في المرتجعات.' : 'تُخصم من المخزون مباشرة عند الصرف. لا عهدة ولا إرجاع.'}
                </p>
              </div>
              <Input label="الكمية" type="number" min="0" value={formState.quantity} onChange={(event) => setFormState((prev) => ({ ...prev, quantity: event.target.value }))} required />
              <Input label="الحد الأدنى" type="number" min="1" value={formState.minStock} onChange={(event) => setFormState((prev) => ({ ...prev, minStock: event.target.value }))} required />
              <Input label="سعر المفرد" type="number" min="0" step="0.01" value={formState.unitPrice} onChange={(event) => setFormState((prev) => ({ ...prev, unitPrice: event.target.value }))} />
              <Input label="ترتيب الظهور للمدرب" type="number" value={formState.storeSortOrder} onChange={(event) => setFormState((prev) => ({ ...prev, storeSortOrder: event.target.value }))} />
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm">
                <input type="checkbox" checked={formState.showInStore} onChange={(event) => setFormState((prev) => ({ ...prev, showInStore: event.target.checked }))} />
                إظهار المادة للمدرب
              </label>
              <Input label="ملاحظة للمدرب عند الطلب" value={formState.storeOnDemandNote} onChange={(event) => setFormState((prev) => ({ ...prev, storeOnDemandNote: event.target.value }))} />
              {formState.type === 'RETURNABLE' ? (
                <>
                  <Input label="تذكير الصيانة بالأيام" type="number" min="0" value={formState.maintenanceIntervalDays} onChange={(event) => setFormState((prev) => ({ ...prev, maintenanceIntervalDays: event.target.value }))} />
                  <Input label="موعد أول تذكير" type="date" value={formState.nextMaintenanceDueAt} onChange={(event) => setFormState((prev) => ({ ...prev, nextMaintenanceDueAt: event.target.value }))} />
                </>
              ) : null}
            </div>
          </div>

          <datalist id="inventory-categories">
            {categories.map((category) => <option key={category} value={category} />)}
          </datalist>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={closeModal}>إلغاء</Button>
            <Button type="submit" className="bg-[#2A6364] text-white hover:bg-[#214f50]" disabled={saving}>{saving ? 'جار الحفظ...' : 'حفظ المادة'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const statTones: Record<string, string> = {
  teal: 'border-[#c9dfdc] bg-[#f4fbfa] text-[#2A6364]',
  green: 'border-[#cce6d7] bg-[#f3fbf6] text-[#2f6f4f]',
  amber: 'border-[#ead8aa] bg-[#fffaf0] text-[#80622a]',
  rose: 'border-[#efd0d8] bg-[#fff7f8] text-[#8a3650]',
  blue: 'border-[#cfddea] bg-[#f5f9fd] text-[#365f82]',
};

function StatCard({ label, value, tone, onClick }: { label: string; value: number; tone: string; onClick?: () => void }) {
  return (
    <Card className={`${statCardClass} ${statTones[tone] || statTones.teal}`} onClick={onClick}>
      <div className="text-[12px] text-slate-500">{label}</div>
      <div className="mt-2 text-[24px] text-[#203634]">{formatNumber(value)}</div>
    </Card>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-[10px] border px-4 py-2 text-sm ${active ? 'border-[#2A6364] bg-[#e9f2f1] text-[#203634]' : 'border-slate-200 bg-white text-slate-600'}`}>
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: InventoryItem['status'] }) {
  if (status === 'LOW_STOCK') return <Badge variant="warning">منخفض</Badge>;
  if (status === 'OUT_OF_STOCK') return <Badge variant="danger">نافد</Badge>;
  return <Badge variant="success">متاح</Badge>;
}

function TypeBadge({ type }: { type: 'RETURNABLE' | 'CONSUMABLE' }) {
  if (type === 'CONSUMABLE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#d9c99f] bg-[#fbf6ea] px-2.5 py-0.5 text-[11px] font-bold text-[#8a6a37]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#8a6a37]" />
        مستهلكة
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#cce6d7] bg-[#f0fbf5] px-2.5 py-0.5 text-[11px] font-bold text-[#1e6b4c]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#1e6b4c]" />
      مسترجعة
    </span>
  );
}

function InventoryTable({
  items,
  loading,
  canModify,
  showImages,
  compact = false,
  onEdit,
  onDelete,
  onVisibility,
}: {
  items: InventoryItem[];
  loading: boolean;
  canModify: boolean;
  showImages: boolean;
  compact?: boolean;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onVisibility: (item: InventoryItem, checked: boolean) => void;
}) {
  if (loading) {
    return <Card className="space-y-3 p-4">{[1, 2, 3, 4, 5].map((row) => <Skeleton key={row} className="h-14 w-full" />)}</Card>;
  }
  if (!items.length) return <Card className="p-8 text-center text-sm text-slate-500">لا توجد مواد مطابقة</Card>;

  return (
    <Card className="overflow-hidden rounded-[14px] border border-[#dce6e3] bg-white">
      <div className="mobile-scroll-x">
        <table className="min-w-[1180px] text-right">
          <thead className="bg-[#f4f8f8]">
            <tr>
              {showImages ? <th className="p-3 text-sm text-primary">الصورة</th> : null}
              <th className="p-3 text-sm text-primary">المادة</th>
              <th className="p-3 text-sm text-primary">الفئة</th>
              <th className="p-3 text-sm text-primary">النوع</th>
              <th className="p-3 text-sm text-primary">الكمية</th>
              <th className="p-3 text-sm text-primary">المتاح</th>
              <th className="p-3 text-sm text-primary">محجوز</th>
              <th className="p-3 text-sm text-primary">عهد نشطة</th>
              <th className="p-3 text-sm text-primary">السعر</th>
              <th className="p-3 text-sm text-primary">الحالة</th>
              <th className="p-3 text-sm text-primary">إظهار/إخفاء</th>
              {canModify ? <th className="p-3 text-sm text-primary">الإجراءات</th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const visible = getStoreMeta(item)?.isVisible ?? true;
              const image = getItemImage(item);
              return (
                <tr key={item.id} className="border-t border-slate-100 hover:bg-[#f8fbfb]">
                  {showImages ? (
                    <td className="p-3">
                      <div className="flex h-14 w-16 items-center justify-center overflow-hidden rounded-[8px] border border-slate-200 bg-[#f7faf9] text-[11px] text-slate-400">
                        {image ? <img src={image} alt={item.name} className="h-full w-full object-cover" /> : 'بدون صورة'}
                      </div>
                    </td>
                  ) : null}
                  <td className="p-3">
                    <div className="max-w-[240px]">
                      <div className="text-sm text-slate-900">{getInventoryDisplayName(item, 'ar')}</div>
                      <div className="mt-1 text-[11px] text-slate-400">{item.code}</div>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-slate-700">{getInventoryDisplayCategory(item, 'ar')}</td>
                  <td className="p-3"><TypeBadge type={item.type} /></td>
                  <td className="p-3 text-sm text-slate-800">{formatNumber(item.quantity)} {getInventoryDisplayUnit(item, 'ar')}</td>
                  <td className="p-3 text-sm text-slate-700">{formatNumber(item.availableQty)}</td>
                  <td className="p-3 text-sm text-slate-700">{formatNumber(item.reservedQty)}</td>
                  <td className="p-3 text-sm text-slate-700">{formatNumber(item._count?.custodyRecords || 0)}</td>
                  <td className="p-3 text-sm text-slate-700">{compact ? formatCurrency(item.totalPrice) : formatCurrency(item.unitPrice)}</td>
                  <td className="p-3"><StatusBadge status={item.status} /></td>
                  <td className="p-3">
                    <input type="checkbox" checked={visible} disabled={!canModify} onChange={(event) => onVisibility(item, event.target.checked)} className="h-5 w-5 accent-[#2A6364]" />
                  </td>
                  {canModify ? (
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="border border-slate-200" onClick={() => onEdit(item)}>تعديل</Button>
                        <Button size="sm" variant="ghost" className="border border-red-200 text-red-600 hover:bg-red-50" onClick={() => onDelete(item.id)}>حذف</Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Pagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (page: number) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-600">إجمالي النتائج: {formatNumber(total)}</div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" disabled={page <= 1} onClick={() => onPage(Math.max(page - 1, 1))}>السابق</Button>
        <div className="rounded-xl bg-[#f4f8f8] px-4 py-2 text-sm text-[#203634]">{page} / {totalPages}</div>
        <Button variant="ghost" disabled={page >= totalPages} onClick={() => onPage(Math.min(page + 1, totalPages))}>التالي</Button>
      </div>
    </div>
  );
}

function BundlesPanel({
  bundles,
  selectedBundle,
  catalogChoices,
  saving,
  onSelect,
  onUpdate,
  onSetItem,
  onUpdateItem,
  onSave,
}: {
  bundles: Bundle[];
  selectedBundle?: Bundle;
  catalogChoices: StoreItem[];
  saving: boolean;
  onSelect: (id: string) => void;
  onUpdate: (patch: Partial<Bundle>) => void;
  onSetItem: (catalogItemId: string, checked: boolean) => void;
  onUpdateItem: (catalogItemId: string, patch: Partial<Bundle['items'][number]>) => void;
  onSave: (bundle: Bundle) => void;
}) {
  const [bundleSearch, setBundleSearch] = useState('');
  const [newCatalogItemId, setNewCatalogItemId] = useState('');
  if (!selectedBundle) return <Card className="p-8 text-center text-sm text-slate-500">لا توجد بكجات</Card>;
  const selectedIds = new Set(selectedBundle.items.map((item) => item.catalogItemId));
  const filteredChoices = catalogChoices
    .filter((item) => !selectedIds.has(item.id))
    .filter((item) => item.title.includes(bundleSearch) || String(item.inventoryItemId || '').includes(bundleSearch))
    .slice(0, 30);
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <Card className="rounded-[14px] border border-[#dce6e3] bg-[#fbfdfc] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f2f1] text-[#2A6364]">B</span>
          البكجات المقترحة
        </div>
        <div className="space-y-2">
          {bundles.map((bundle) => (
            <button key={bundle.id} type="button" onClick={() => onSelect(bundle.id)} className={`w-full rounded-[10px] border p-3 text-right ${selectedBundle.id === bundle.id ? 'border-[#2A6364] bg-[#eef6f5]' : 'border-slate-200 bg-white'}`}>
              <div className="text-sm text-slate-900">{bundle.title}</div>
              <div className="mt-1 text-[12px] text-slate-500">{bundle.items.length} مواد</div>
            </button>
          ))}
        </div>
      </Card>
      <Card className="rounded-[14px] border border-[#dce6e3] bg-white p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="اسم البكج" value={selectedBundle.title} onChange={(event) => onUpdate({ title: event.target.value })} />
          <Input label="الوصف" value={selectedBundle.description || ''} onChange={(event) => onUpdate({ description: event.target.value })} />
        </div>

        <div className="mt-5 rounded-[12px] border border-[#dce6e3] bg-[#f8fbfb] p-4">
          <div className="mb-3 text-sm text-[#536866]">إضافة مادة للبكج</div>
          <div className="grid gap-2 md:grid-cols-[1fr_240px_auto]">
            <Input placeholder="ابحث عن مادة" value={bundleSearch} onChange={(event) => setBundleSearch(event.target.value)} />
            <select value={newCatalogItemId} onChange={(event) => setNewCatalogItemId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">اختر مادة</option>
              {filteredChoices.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <Button
              type="button"
              className="bg-[#2A6364] text-white hover:bg-[#214f50]"
              disabled={!newCatalogItemId}
              onClick={() => {
                onSetItem(newCatalogItemId, true);
                setNewCatalogItemId('');
                setBundleSearch('');
              }}
            >
              إضافة
            </Button>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[12px] border border-slate-200">
          <table className="w-full text-right">
            <thead className="bg-[#f4f8f8]">
              <tr>
                <th className="p-3 text-sm text-primary">مواد البكج الحالية</th>
                <th className="p-3 text-sm text-primary">الكمية</th>
                <th className="p-3 text-sm text-primary">طريقة الاحتساب</th>
                <th className="p-3 text-sm text-primary">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {selectedBundle.items.map((item) => (
                <tr key={item.catalogItemId} className="border-t border-slate-100">
                  <td className="p-3 text-sm text-slate-800">{item.title || catalogChoices.find((choice) => choice.id === item.catalogItemId)?.title}</td>
                  <td className="p-3"><input type="number" min={1} value={item.quantity} onChange={(event) => onUpdateItem(item.catalogItemId, { quantity: Number(event.target.value) })} className="h-10 w-24 rounded-[8px] border border-slate-200 px-2" /></td>
                  <td className="p-3">
                    <select value={item.quantityMode || 'FIXED'} onChange={(event) => onUpdateItem(item.catalogItemId, { quantityMode: event.target.value as any })} className="h-10 rounded-[8px] border border-slate-200 px-2 text-[12px]">
                      <option value="FIXED">كمية ثابتة</option>
                      <option value="PER_TRAINEE">حسب عدد المتدربين</option>
                    </select>
                  </td>
                  <td className="p-3"><Button size="sm" variant="ghost" className="border border-red-200 text-red-600" onClick={() => onSetItem(item.catalogItemId, false)}>حذف</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!selectedBundle.items.length ? <div className="p-5 text-center text-sm text-slate-500">لا توجد مواد داخل هذا البكج</div> : null}
        </div>

        <Button className="mt-4 bg-[#2A6364] text-white hover:bg-[#214f50]" disabled={saving} onClick={() => onSave(selectedBundle)}>حفظ البكج</Button>
      </Card>
    </div>
  );
}
