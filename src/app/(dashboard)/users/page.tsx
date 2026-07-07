'use client';

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { type AppLanguage, useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';

type RoleValue = 'manager' | 'warehouse' | 'user';
type UserStatus = 'active' | 'disabled';

type UserRow = {
  id: string;
  employeeId?: string;
  fullName: string;
  email: string;
  mobile?: string | null;
  extension?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  operationalProject?: string | null;
  role: RoleValue;
  roles: RoleValue[];
  preferredLanguage: AppLanguage;
  status: UserStatus;
  createdAt?: string | null;
  canManageTrainerNeeds?: boolean;
  telegramChatId?: string | null;
};

type FormState = {
  fullName: string;
  email: string;
  mobile: string;
  extension: string;
  operationalProject: string;
  hasManagerRole: boolean;
  hasWarehouseRole: boolean;
  canManageTrainerNeeds: boolean;
  preferredLanguage: AppLanguage;
  status: UserStatus;
  password: string;
  confirmPassword: string;
};

type UserStats = {
  total: number;
  active: number;
  disabled: number;
  managers: number;
  warehouses: number;
  usersOnly: number;
};

type PaginationState = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
};

const emptyForm: FormState = {
  fullName: '',
  email: '',
  mobile: '',
  extension: '',
  operationalProject: '',
  hasManagerRole: false,
  hasWarehouseRole: false,
  canManageTrainerNeeds: false,
  preferredLanguage: 'ar',
  status: 'active',
  password: '',
  confirmPassword: '',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function normalizeArabic(value: string) {
  return (value || '')
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeRoles(value: unknown): RoleValue[] {
  const allowed: RoleValue[] = ['user', 'warehouse', 'manager'];

  const incoming = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const normalized = incoming
    .map((item) => String(item).toLowerCase())
    .filter((item): item is RoleValue => allowed.includes(item as RoleValue));

  const set = new Set<RoleValue>(['user', ...normalized]);

  return allowed.filter((role) => set.has(role));
}

function normalizeLanguage(value: unknown): AppLanguage {
  return value === 'en' ? 'en' : 'ar';
}

function languageLabel(language: AppLanguage) {
  return language === 'en' ? 'English' : 'العربية';
}

function getPrimaryRole(roles: RoleValue[]): RoleValue {
  if (roles.includes('manager')) return 'manager';
  if (roles.includes('warehouse')) return 'warehouse';
  return 'user';
}

function roleLabelFromRoles(roles: RoleValue[], lang: AppLanguage = 'ar') {
  const normalized = normalizeRoles(roles);
  if (lang === 'en') {
    if (normalized.includes('manager') && normalized.includes('warehouse')) return 'Manager + Warehouse + Employee';
    if (normalized.includes('manager')) return 'Manager + Employee';
    if (normalized.includes('warehouse')) return 'Warehouse + Employee';
    return 'Employee';
  }
  if (normalized.includes('manager') && normalized.includes('warehouse')) return 'مدير + مسؤول مخزن + موظف';
  if (normalized.includes('manager')) return 'مدير + موظف';
  if (normalized.includes('warehouse')) return 'مسؤول مخزن + موظف';
  return 'موظف';
}

function roleShortBadges(roles: RoleValue[], lang: AppLanguage = 'ar') {
  const normalized = normalizeRoles(roles);
  const badges: string[] = [];
  if (normalized.includes('manager')) badges.push(lang === 'en' ? 'Manager' : 'مدير');
  if (normalized.includes('warehouse')) badges.push(lang === 'en' ? 'Warehouse' : 'مسؤول مخزن');
  badges.push(lang === 'en' ? 'Employee' : 'موظف');
  return badges;
}

function roleDescriptionFromRoles(roles: RoleValue[], lang: AppLanguage = 'ar') {
  const normalized = normalizeRoles(roles);
  if (lang === 'en') {
    if (normalized.includes('manager') && normalized.includes('warehouse')) return 'Manager + Warehouse + Employee';
    if (normalized.includes('manager')) return 'Manager + Employee';
    if (normalized.includes('warehouse')) return 'Warehouse + Employee';
    return 'Employee';
  }
  if (normalized.includes('manager') && normalized.includes('warehouse')) return 'مدير + مخزن + موظف';
  if (normalized.includes('manager')) return 'مدير + موظف';
  if (normalized.includes('warehouse')) return 'مخزن + موظف';
  return 'موظف';
}

function statusLabel(status: UserStatus, lang: AppLanguage = 'ar') {
  if (lang === 'en') return status === 'active' ? 'Active' : 'Disabled';
  return status === 'active' ? 'نشط' : 'موقوف';
}

function statusVariant(status: UserStatus): 'success' | 'danger' {
  return status === 'active' ? 'success' : 'danger';
}

function normalizeUser(row: any): UserRow {
  const roles = normalizeRoles(row?.roles ?? row?.role);

  return {
    id: row?.id || '',
    employeeId: row?.employeeId,
    fullName: row?.fullName || '',
    email: row?.email || '',
    mobile: row?.mobile ?? '',
    extension: row?.extension ?? '',
    department: row?.department ?? '',
    jobTitle: row?.jobTitle ?? '',
    operationalProject: row?.operationalProject ?? '',
    role: getPrimaryRole(roles),
    roles,
    preferredLanguage: normalizeLanguage(row?.preferredLanguage),
    status: row?.status === 'disabled' ? 'disabled' : 'active',
    createdAt: row?.createdAt ?? null,
    canManageTrainerNeeds: !!row?.canManageTrainerNeeds,
  };
}

function StatCard({
  title,
  value,
  accent,
  active,
  onClick,
}: {
  title: string;
  value: number;
  accent: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[22px] border bg-white p-4 text-right shadow-sm transition hover:-translate-y-[1px] hover:shadow-md sm:rounded-[26px] ${
        active ? 'border-[#016564] ring-4 ring-[#016564]/10' : 'border-[#d6d7d4]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] text-[#6f7b7a] sm:text-[13px]">{title}</div>
          <div className="mt-2 text-[28px] font-extrabold leading-none text-[#152625] sm:text-[32px]">
            {value}
          </div>
        </div>
        <span className={`h-3 w-3 rounded-full ${accent}`} />
      </div>
    </button>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e4e8e7] bg-[#fbfcfc] px-3 py-2">
      <div className="text-[11px] font-semibold text-[#7b8786]">{label}</div>
      <div className="mt-1 text-sm text-[#243635]">{value || '—'}</div>
    </div>
  );
}

export default function UsersPage() {
  const { user, refreshUsers } = useAuth();
  const { language } = useI18n();
  const isManager = user?.role === 'manager';

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'manager' | 'warehouse' | 'user'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'disabled'>('ALL');
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    active: 0,
    disabled: 0,
    managers: 0,
    warehouses: 0,
    usersOnly: 0,
  });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 5,
  });

  const [selected, setSelected] = useState<UserRow | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (deferredSearch.trim()) params.set('search', deferredSearch.trim());
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(`/api/users?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      const nextRows = Array.isArray(data?.data) ? data.data.map(normalizeUser) : [];
      const nextPagination: PaginationState = {
        page: Number(data?.pagination?.page || pagination.page),
        totalPages: Number(data?.pagination?.totalPages || 1),
        total: Number(data?.pagination?.total || nextRows.length),
        limit: Number(data?.pagination?.limit || pagination.limit),
      };

      if (pagination.page > nextPagination.totalPages && nextPagination.totalPages > 0) {
        setPagination((prev) => ({ ...prev, page: nextPagination.totalPages }));
        return;
      }

      setRows(nextRows);
      setStats({
        total: Number(data?.stats?.total || 0),
        active: Number(data?.stats?.active || 0),
        disabled: Number(data?.stats?.disabled || 0),
        managers: Number(data?.stats?.managers || 0),
        warehouses: Number(data?.stats?.warehouses || 0),
        usersOnly: Number(data?.stats?.usersOnly || 0),
      });
      setPagination(nextPagination);
    } catch {
      setRows([]);
      setStats({
        total: 0,
        active: 0,
        disabled: 0,
        managers: 0,
        warehouses: 0,
        usersOnly: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [deferredSearch, pagination.limit, pagination.page, roleFilter, statusFilter]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [deferredSearch, roleFilter, statusFilter]);

  const filteredRows = useMemo(() => rows, [rows]);

  const openEdit = (row: UserRow) => {
    setEditing(row);
    setForm({
      fullName: row.fullName || '',
      email: row.email || '',
      mobile: row.mobile || '',
      extension: row.extension || '',
      operationalProject: row.operationalProject || row.department || '',
      hasManagerRole: row.roles.includes('manager'),
      hasWarehouseRole: row.roles.includes('warehouse'),
      canManageTrainerNeeds: !!row.canManageTrainerNeeds,
      preferredLanguage: row.preferredLanguage || 'ar',
      status: row.status,
      password: '',
      confirmPassword: '',
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!editing) return;

    if (!form.fullName.trim() || !form.email.trim()) {
      alert('الاسم والبريد الإلكتروني مطلوبان');
      return;
    }

    if (form.password && form.password !== form.confirmPassword) {
      alert('كلمة المرور وتأكيدها غير متطابقين');
      return;
    }

    setSaving(true);

    try {
      const roles: RoleValue[] = ['user'];
      if (form.hasWarehouseRole) roles.push('warehouse');
      if (form.hasManagerRole) roles.push('manager');

      const payload: Record<string, string | string[] | boolean> = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        extension: form.extension.trim(),
        operationalProject: form.operationalProject.trim(),
        preferredLanguage: form.preferredLanguage,
        status: form.status,
        roles,
        canManageTrainerNeeds: form.canManageTrainerNeeds,
      };

      if (form.password.trim()) {
        payload.password = form.password.trim();
      }

      const res = await fetch(`/api/users/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(data?.error || 'تعذر حفظ التعديلات');
        return;
      }

      await fetchUsers();
      await refreshUsers();
      closeEdit();
    } finally {
      setSaving(false);
    }
  };

  const quickToggleStatus = async (row: UserRow) => {
    const nextStatus = row.status === 'active' ? 'disabled' : 'active';

    try {
      const res = await fetch(`/api/users/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(data?.error || 'تعذر تحديث حالة الحساب');
        return;
      }

      await fetchUsers();
      await refreshUsers();

      if (selected?.id === row.id) {
        setSelected((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      }
    } catch {
      alert('تعذر تحديث حالة الحساب');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  if (!isManager) {
    return (
      <div className="rounded-[22px] border border-red-200 bg-red-50 p-6 text-center text-red-700 sm:rounded-[26px]">
        غير مصرح لك بالوصول لهذه الصفحة
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Hero Header */}
      <section className="overflow-hidden rounded-[20px] bg-gradient-to-l from-[#3a1c2c] to-[#73384B] p-5 text-white shadow-[0_12px_32px_rgba(115,56,75,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/15">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="3"/><path d="M3 21v-2a7 7 0 0 1 11-5.8"/><circle cx="17" cy="15" r="3"/><path d="M21 21v-1a3 3 0 0 0-5.7-1.3"/>
              </svg>
            </div>
            <div>
              <h1 className="text-[20px] font-extrabold">إدارة المستخدمين</h1>
              <div className="text-[11px] text-white/50">{stats.total} حساب · {stats.active} نشط</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              { label: 'الكل', value: stats.total, active: roleFilter === 'ALL' && statusFilter === 'ALL', onClick: () => { setRoleFilter('ALL'); setStatusFilter('ALL'); } },
              { label: 'مدراء', value: stats.managers, active: roleFilter === 'manager', onClick: () => setRoleFilter('manager') },
              { label: 'مستودع', value: stats.warehouses, active: roleFilter === 'warehouse', onClick: () => setRoleFilter('warehouse') },
              { label: 'موظفون', value: stats.usersOnly, active: roleFilter === 'user', onClick: () => setRoleFilter('user') },
              { label: 'نشط', value: stats.active, active: statusFilter === 'active', onClick: () => setStatusFilter('active') },
              { label: 'موقوف', value: stats.disabled, active: statusFilter === 'disabled', onClick: () => setStatusFilter('disabled') },
            ].map((s) => (
              <button key={s.label} onClick={s.onClick}
                className={`rounded-[12px] border px-3 py-2 text-center transition hover:scale-[1.03] ${s.active ? 'border-white/40 bg-white/20' : 'border-white/10 bg-white/8 hover:bg-white/15'}`}>
                <div className="text-[20px] font-extrabold text-white">{s.value}</div>
                <div className="text-[10px] text-white/60">{s.label}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Filters + list */}
      <section className="overflow-hidden rounded-[20px] border border-[#DADBD9] bg-white shadow-sm">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#DADBD9] px-4 py-3">
          <div className="relative flex-1 min-w-[160px]">
            <svg viewBox="0 0 24 24" fill="none" className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B5BDBE]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="الاسم أو البريد أو الجوال..."
              className="h-9 w-full rounded-full border border-[#DADBD9] bg-[#F9F9F9] pr-8 pl-3 text-[12px] outline-none focus:border-[#73384B]/40 focus:bg-white" />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'ALL'|'manager'|'warehouse'|'user')}
            className="h-9 rounded-full border border-[#DADBD9] bg-white px-3 text-[12px] outline-none">
            <option value="ALL">كل الأدوار</option>
            <option value="manager">مدراء</option>
            <option value="warehouse">مستودع</option>
            <option value="user">موظفون</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL'|'active'|'disabled')}
            className="h-9 rounded-full border border-[#DADBD9] bg-white px-3 text-[12px] outline-none">
            <option value="ALL">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="disabled">موقوف</option>
          </select>
          <button onClick={clearFilters} className="h-9 rounded-full border border-[#DADBD9] px-3 text-[12px] text-[#5A5A5A] hover:bg-[#F9F9F9]">
            إعادة الضبط
          </button>
        </div>

        {/* ── Desktop table ── */}
        <div className="hidden xl:block">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-[62px] w-full rounded-[14px]" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#91a09f]">
              {language === 'en' ? 'No matching results' : 'لا توجد نتائج مطابقة'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[#edf1f0] bg-[#f7f9f9] text-right text-[11px] font-bold uppercase tracking-wider text-[#91a09f]">
                    <th className="px-5 py-3">{language === 'en' ? 'User' : 'المستخدم'}</th>
                    <th className="px-4 py-3">{language === 'en' ? 'Permissions' : 'الصلاحيات'}</th>
                    <th className="px-4 py-3">{language === 'en' ? 'Status' : 'الحالة'}</th>
                    <th className="px-4 py-3">{language === 'en' ? 'Contact' : 'التواصل'}</th>
                    <th className="px-4 py-3">{language === 'en' ? 'Project' : 'المشروع'}</th>
                    <th className="px-4 py-3">{language === 'en' ? 'Created' : 'الإنشاء'}</th>
                    <th className="px-4 py-3 text-center">{language === 'en' ? 'Actions' : 'الإجراءات'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f3f3]">
                  {filteredRows.map((row) => {
                    const initials = row.fullName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
                    const primaryRole = getPrimaryRole(row.roles);
                    const avatarColor = primaryRole === 'manager' ? '#2A6364' : primaryRole === 'warehouse' ? '#2E6F8E' : '#6B5A4A';
                    return (
                      <tr key={row.id} className="group align-middle transition-colors hover:bg-[#f7fafa]">
                        {/* User */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
                              style={{ backgroundColor: avatarColor }}>
                              {initials || '?'}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[13px] font-bold text-[#152625] truncate">{row.fullName}</div>
                              <div className="text-[11px] text-[#91a09f] truncate">{row.email}</div>
                            </div>
                          </div>
                        </td>
                        {/* Permissions */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {roleShortBadges(row.roles, language).map((badge) => (
                              <span key={`${row.id}-${badge}`}
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  badge === 'موظف' || badge === 'Employee'
                                    ? 'bg-[#eef5f4] text-[#2A6364]'
                                    : badge === 'مدير' || badge === 'Manager'
                                      ? 'bg-[#fdf8f0] text-[#8a6a37]'
                                      : 'bg-[#eef3f8] text-[#2E6F8E]'
                                }`}>
                                {badge}
                              </span>
                            ))}
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            row.status === 'active'
                              ? 'bg-[#eef8f2] text-[#1e6b4c]'
                              : 'bg-[#fff0f3] text-[#73384B]'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${row.status === 'active' ? 'bg-[#4F8F7A]' : 'bg-[#73384B]'}`} />
                            {statusLabel(row.status, language)}
                          </span>
                        </td>
                        {/* Contact */}
                        <td className="px-4 py-3 text-[12px] text-[#556867]">
                          <div>{row.mobile || '—'}</div>
                          {row.extension && <div className="text-[11px] text-[#91a09f]">{language === 'en' ? 'Ext:' : 'تحويلة:'} {row.extension}</div>}
                        </td>
                        {/* Project */}
                        <td className="px-4 py-3 max-w-[140px]">
                          <div className="truncate text-[12px] text-[#556867]">{row.operationalProject || row.department || '—'}</div>
                        </td>
                        {/* Created */}
                        <td className="px-4 py-3 text-[12px] text-[#91a09f]">{formatDate(row.createdAt)}</td>
                        {/* Actions — icon buttons */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {/* View */}
                            <button
                              onClick={() => setSelected(row)}
                              title={language === 'en' ? 'View' : 'عرض'}
                              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#e2e8e8] bg-white text-[#556867] transition hover:border-[#2A6364]/30 hover:bg-[#eef5f4] hover:text-[#2A6364]"
                            >
                              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                              </svg>
                            </button>
                            {/* Edit */}
                            <button
                              onClick={() => openEdit(row)}
                              title={language === 'en' ? 'Edit' : 'تعديل'}
                              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#e2e8e8] bg-white text-[#556867] transition hover:border-[#2A6364]/30 hover:bg-[#eef5f4] hover:text-[#2A6364]"
                            >
                              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            {/* Toggle status */}
                            <button
                              onClick={() => quickToggleStatus(row)}
                              title={row.status === 'active' ? (language === 'en' ? 'Suspend' : 'إيقاف') : (language === 'en' ? 'Activate' : 'تنشيط')}
                              className={`flex h-8 w-8 items-center justify-center rounded-[8px] border transition ${
                                row.status === 'active'
                                  ? 'border-[#e2e8e8] bg-white text-[#91a09f] hover:border-[#73384B]/30 hover:bg-[#fff0f3] hover:text-[#73384B]'
                                  : 'border-[#cce6d7] bg-[#eef8f2] text-[#1e6b4c] hover:bg-[#d4f0e2]'
                              }`}
                            >
                              {row.status === 'active' ? (
                                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Mobile cards ── */}
        <div className="space-y-2 p-3 xl:hidden sm:p-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-36 w-full rounded-[16px]" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-[16px] border border-[#edf1f0] bg-white p-8 text-center text-sm text-[#91a09f]">
              {language === 'en' ? 'No matching results' : 'لا توجد نتائج مطابقة'}
            </div>
          ) : (
            filteredRows.map((row) => {
              const initials = row.fullName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
              const primaryRole = getPrimaryRole(row.roles);
              const avatarColor = primaryRole === 'manager' ? '#2A6364' : primaryRole === 'warehouse' ? '#2E6F8E' : '#6B5A4A';
              return (
                <div key={row.id} className="overflow-hidden rounded-[16px] border border-[#edf1f0] bg-white">
                  {/* Top row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold text-white"
                      style={{ backgroundColor: avatarColor }}>
                      {initials || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-bold text-[#152625] truncate">{row.fullName}</div>
                      <div className="text-[11px] text-[#91a09f] truncate">{row.email}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      row.status === 'active' ? 'bg-[#eef8f2] text-[#1e6b4c]' : 'bg-[#fff0f3] text-[#73384B]'
                    }`}>
                      {statusLabel(row.status, language)}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#f0f3f3] bg-[#f9fbfb] px-4 py-2 text-[11px] text-[#91a09f]">
                    <span>{row.mobile || '—'}</span>
                    {row.extension && <span>{language === 'en' ? 'Ext:' : 'تحويلة:'} {row.extension}</span>}
                    <span className="truncate max-w-[140px]">{row.operationalProject || row.department || '—'}</span>
                    <span className="mr-auto flex flex-wrap gap-1">
                      {roleShortBadges(row.roles, language).map((badge) => (
                        <span key={`${row.id}-m-${badge}`}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            badge === 'موظف' || badge === 'Employee' ? 'bg-[#eef5f4] text-[#2A6364]' :
                            badge === 'مدير' || badge === 'Manager' ? 'bg-[#fdf8f0] text-[#8a6a37]' :
                            'bg-[#eef3f8] text-[#2E6F8E]'
                          }`}>
                          {badge}
                        </span>
                      ))}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex border-t border-[#f0f3f3]">
                    <button onClick={() => setSelected(row)}
                      className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold text-[#556867] transition hover:bg-[#f7fafa] hover:text-[#2A6364]">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      {language === 'en' ? 'View' : 'عرض'}
                    </button>
                    <div className="w-px bg-[#f0f3f3]" />
                    <button onClick={() => openEdit(row)}
                      className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold text-[#556867] transition hover:bg-[#f7fafa] hover:text-[#2A6364]">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      {language === 'en' ? 'Edit' : 'تعديل'}
                    </button>
                    <div className="w-px bg-[#f0f3f3]" />
                    <button onClick={() => quickToggleStatus(row)}
                      className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold transition ${
                        row.status === 'active'
                          ? 'text-[#91a09f] hover:bg-[#fff7f8] hover:text-[#73384B]'
                          : 'text-[#1e6b4c] hover:bg-[#eef8f2]'
                      }`}>
                      {row.status === 'active' ? (
                        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      )}
                      {row.status === 'active'
                        ? (language === 'en' ? 'Suspend' : 'إيقاف')
                        : (language === 'en' ? 'Activate' : 'تنشيط')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!loading && pagination.totalPages > 1 ? (
          <div className="border-t border-[#edf1f0] px-4 py-4 sm:px-5">
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <div className="text-sm font-bold text-[#016564]">
                الصفحة {pagination.page} من {pagination.totalPages}
              </div>
              <div className="text-xs text-[#61706f]">عدد السجلات في هذا العرض: {pagination.total}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page <= 1}
                  className="rounded-full border border-[#d6d7d4] px-4 py-2 text-sm font-bold text-[#425554] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  السابق
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: Math.min(prev.totalPages, prev.page + 1),
                    }))
                  }
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded-full border border-[#d6d7d4] px-4 py-2 text-sm font-bold text-[#425554] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `تفاصيل المستخدم: ${selected.fullName}` : 'تفاصيل المستخدم'}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoPill label="الاسم" value={selected.fullName} />
              <InfoPill label="البريد الإلكتروني" value={selected.email} />
              <InfoPill label={language === 'en' ? 'Permissions' : 'الصلاحيات'} value={roleLabelFromRoles(selected.roles, language)} />
              <InfoPill label={language === 'en' ? 'Status' : 'الحالة'} value={statusLabel(selected.status, language)} />
              <InfoPill label="لغة الواجهة" value={languageLabel(selected.preferredLanguage)} />
              <InfoPill label="الجوال" value={selected.mobile || '—'} />
              <InfoPill label="التحويلة" value={selected.extension || '—'} />
              <div className="sm:col-span-2">
                <InfoPill
                  label="المشروع التشغيلي"
                  value={selected.operationalProject || selected.department || '—'}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[#edf1f0] bg-[#fbfcfc] px-4 py-3 text-sm text-[#556867]">
              {roleDescriptionFromRoles(selected.roles, language)}
            </div>

            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => setSelected(null)} className="w-full sm:w-auto">
                إغلاق
              </Button>

              <Button
                variant={selected.status === 'active' ? 'danger' : 'secondary'}
                onClick={async () => {
                  await quickToggleStatus(selected);
                  setSelected(null);
                }}
                className="w-full sm:w-auto"
              >
                {selected.status === 'active' ? 'إيقاف الحساب' : 'تنشيط الحساب'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={!!editing}
        onClose={closeEdit}
        title={editing ? `تعديل المستخدم: ${editing.fullName}` : 'تعديل المستخدم'}
      >
        {editing ? (
          <div className="space-y-5">
            <div className="rounded-[22px] border border-[#d6d7d4] bg-[#fbfcfc] px-4 py-4 text-sm text-[#556867]">
              <div className="font-bold text-[#016564]">الصلاحيات</div>
              <div className="mt-1 leading-6">
                الأساس: <span className="font-bold">موظف</span> — يمكن إضافة: <span className="font-bold">مدير</span> و/أو <span className="font-bold">مخزن</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="الاسم"
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              />

              <Input
                label="البريد الإلكتروني"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />

              <Input
                label="الجوال"
                value={form.mobile}
                onChange={(e) => setForm((prev) => ({ ...prev, mobile: e.target.value }))}
              />

              <Input
                label="التحويلة"
                value={form.extension}
                onChange={(e) => setForm((prev) => ({ ...prev, extension: e.target.value }))}
              />

              <div className="space-y-2 sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700">الصلاحيات الإضافية</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <input
                      type="checkbox"
                      checked={form.hasManagerRole}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, hasManagerRole: e.target.checked }))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#016564] focus:ring-[#016564]"
                    />
                    <div>
                      <div className="text-sm font-bold text-[#152625]">مدير</div>
                      <div className="mt-1 text-xs leading-6 text-[#61706f]">
                        اعتماد الطلبات والتقارير
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <input
                      type="checkbox"
                      checked={form.hasWarehouseRole}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, hasWarehouseRole: e.target.checked }))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#016564] focus:ring-[#016564]"
                    />
                    <div>
                      <div className="text-sm font-bold text-[#152625]">مسؤول مخزن</div>
                      <div className="mt-1 text-xs leading-6 text-[#61706f]">
                        صرف واستلام المواد
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.canManageTrainerNeeds}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, canManageTrainerNeeds: e.target.checked }))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#016564] focus:ring-[#016564]"
                    />
                    <div>
                      <div className="text-sm font-bold text-[#152625]">إدارة احتياجات المدربين</div>
                      <div className="mt-1 text-xs leading-6 text-[#61706f]">
                        عرض احتياجات المدربين فقط
                      </div>
                    </div>
                  </label>
                </div>

                <div className="rounded-2xl border border-[#edf1f0] bg-[#fbfcfc] px-4 py-3 text-sm text-[#556867]">
                  {language === 'en' ? 'Final permissions: ' : 'الصلاحية النهائية لهذا المستخدم: '}{roleLabelFromRoles([
                    'user',
                    ...(form.hasWarehouseRole ? ['warehouse' as const] : []),
                    ...(form.hasManagerRole ? ['manager' as const] : []),
                  ], language)}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">الحالة</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as UserStatus,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10"
                >
                  <option value="active">نشط</option>
                  <option value="disabled">موقوف</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <Input
                  label="المشروع التشغيلي"
                  value={form.operationalProject}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, operationalProject: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">لغة الواجهة</label>
                <select
                  value={form.preferredLanguage}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      preferredLanguage: normalizeLanguage(e.target.value),
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10"
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </div>

              <Input
                label="كلمة مرور جديدة"
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="اتركه فارغًا للإبقاء"
              />

              <Input
                label="تأكيد كلمة المرور الجديدة"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="أعد كتابة كلمة المرور"
              />

              <div className="rounded-2xl border border-[#e8f0ef] bg-[#f6fbfb] px-4 py-3">
                <div className="mb-2 text-sm font-semibold text-[#152625]">Telegram</div>
                {editing?.telegramChatId ? (
                  <div className="flex items-center gap-2 text-sm text-[#2a7a4a]">
                    <span>✅ مرتبط</span>
                    <span className="text-xs text-[#61706f]">(Chat ID: {editing.telegramChatId})</span>
                  </div>
                ) : (
                  <div className="text-xs text-[#61706f]">غير مرتبط — يمكن للموظف ربط حسابه من ملفه الشخصي</div>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#edf1f0] pt-4 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={closeEdit} className="w-full sm:w-auto">
                إلغاء
              </Button>

              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                {saving ? 'جارٍ الحفظ...' : 'حفظ التعديل'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
