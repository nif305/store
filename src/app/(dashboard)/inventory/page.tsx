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

export default function InventoryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'items' | 'summary' | 'bundles' | 'alerts'>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState(emptyStats);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [formState, setFormState] = useState(defaultForm);

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

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    if (canModify) fetchBundles();
  }, [canModify, fetchBundles]);

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

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setCategoryFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const alerts = useMemo(
    () => items.filter((item) => item.status !== 'AVAILABLE' || !getItemImage(item) || !(getStoreMeta(item)?.isVisible ?? true)),
    [items],
  );

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-[14px] border border-[#dce6e3] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[13px] text-[#6f817f]">المخزون هو المصدر الأساسي للصور والكميات والظهور للمدرب</div>
            <h1 className="mt-1 text-[28px] text-[#203634]">إدارة مواد المخزن</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="border border-slate-200" onClick={() => window.open('/training-kit', '_blank')}>معاينة صفحة الطلب</Button>
            {canModify ? <Button className="bg-[#2A6364] text-white hover:bg-[#214f50]" onClick={openCreateModal}>إضافة مادة</Button> : null}
          </div>
        </div>
      </section>

      {error ? <div className="rounded-[8px] border border-[#eed9df] bg-[#fff7f8] px-4 py-3 text-[13px] text-[#7a3147]">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="إجمالي المواد" value={stats.totalItems} onClick={clearFilters} />
        <StatCard label="ظاهرة للمدرب" value={stats.visibleInStoreCount} onClick={() => setActiveTab('items')} />
        <StatCard label="بدون صور" value={stats.missingImagesCount} onClick={() => setActiveTab('alerts')} />
        <StatCard label="منخفضة" value={stats.lowStockCount} onClick={() => { setStatusFilter('LOW_STOCK'); setActiveTab('items'); }} />
        <StatCard label="عهد نشطة" value={stats.usedCount} onClick={() => setActiveTab('summary')} />
        <Card className={statCardClass}><div className="text-[12px] text-slate-500">القيمة التقديرية</div><div className="mt-2 text-[18px] text-[#203634]">{formatCurrency(stats.totalEstimatedValue)}</div></Card>
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
        <InventoryTable
          items={items}
          loading={loading}
          canModify={false}
          showImages={false}
          compact
          onEdit={openEditModal}
          onDelete={handleDelete}
          onVisibility={saveItemVisibility}
        />
      ) : null}

      {activeTab === 'alerts' ? (
        <InventoryTable
          items={alerts}
          loading={loading}
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

      {activeTab !== 'bundles' ? (
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
              <select value={formState.type} onChange={(event) => setFormState((prev) => ({ ...prev, type: event.target.value as any }))} className="h-11 rounded-xl border border-slate-200 px-3">
                <option value="RETURNABLE">مسترجعة</option>
                <option value="CONSUMABLE">مستهلكة</option>
              </select>
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

function StatCard({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  return (
    <Card className={statCardClass} onClick={onClick}>
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
                  <td className="p-3 text-sm text-slate-700">{getInventoryTypeLabel(item.type, 'ar')}</td>
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
  if (!selectedBundle) return <Card className="p-8 text-center text-sm text-slate-500">لا توجد بكجات</Card>;
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <Card className="rounded-[14px] border border-[#dce6e3] bg-white p-4">
        <div className="mb-3 text-sm text-slate-500">البكجات المقترحة</div>
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
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {catalogChoices.map((item) => {
            const current = selectedBundle.items.find((row) => row.catalogItemId === item.id);
            return (
              <div key={item.id} className="rounded-[10px] border border-slate-200 p-3">
                <label className="flex items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" checked={!!current} onChange={(event) => onSetItem(item.id, event.target.checked)} />
                  {item.title}
                </label>
                {current ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input type="number" min={1} value={current.quantity} onChange={(event) => onUpdateItem(item.id, { quantity: Number(event.target.value) })} className="h-10 rounded-[8px] border border-slate-200 px-2" />
                    <select value={current.quantityMode || 'FIXED'} onChange={(event) => onUpdateItem(item.id, { quantityMode: event.target.value as any })} className="h-10 rounded-[8px] border border-slate-200 px-2 text-[12px]">
                      <option value="FIXED">كمية ثابتة</option>
                      <option value="PER_TRAINEE">حسب عدد المتدربين</option>
                    </select>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <Button className="mt-4 bg-[#2A6364] text-white hover:bg-[#214f50]" disabled={saving} onClick={() => onSave(selectedBundle)}>حفظ البكج</Button>
      </Card>
    </div>
  );
}
