'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { translateStaticUiText } from '@/lib/i18n';

type SummaryMetrics = {
  totalInventory: number;
  lowStock: number;
  outOfStock: number;
  availableInventory: number;
  returnableItems: number;
  consumableItems: number;
  materialRequestsTotal: number;
  pendingRequests: number;
  approvedRequests: number;
  issuedRequests: number;
  returnedRequests: number;
  rejectedRequests: number;
  returnRequestsTotal: number;
  pendingReturns: number;
  approvedReturns: number;
  rejectedReturns: number;
  custodyTotal: number;
  activeCustody: number;
  returnedCustody: number;
  delayedCustody: number;
  unreadNotifications: number;
  totalTrainingRooms: number;
  roomsBookedToday: number;
  roomsAvailableToday: number;
  pendingRoomBookings: number;
};

export default function MaterialsDashboardPage() {
  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
  const { user, loading: authLoading } = useAuth();
  const { language } = useI18n();
  const isEmployee = user?.role === 'user';
  const canSeeRoomOperations = user?.role === 'manager' || user?.role === 'warehouse' || !!user?.canManageTrainerNeeds;
  const ui = (source: string) => translateStaticUiText(source, language);
  const materialRequestsTotal =
    metrics?.materialRequestsTotal ??
    ((metrics?.pendingRequests ?? 0) +
      (metrics?.issuedRequests ?? 0) +
      (metrics?.returnedRequests ?? 0) +
      (metrics?.rejectedRequests ?? 0));
  const returnRequestsTotal = metrics?.returnRequestsTotal ?? metrics?.pendingReturns ?? 0;
  const custodyTotal = metrics?.custodyTotal ?? metrics?.activeCustody ?? 0;

  useEffect(() => {
    let mounted = true;
    const headers = user?.role ? { 'x-active-role': user.role } : undefined;

    fetch(`/api/dashboard-summary?scope=global&ts=${Date.now()}`, {
      credentials: 'include',
      cache: 'no-store',
      headers,
    })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json?.error || 'Unable to load dashboard summary');
        return json;
      })
      .then((json) => {
        if (mounted) setMetrics(json?.metrics || null);
      })
      .catch(() => {
        // Keep the last successful summary instead of replacing the dashboard
        // with zeros when auth/session refresh races the first client render.
      });

    return () => {
      mounted = false;
    };
  }, [authLoading, user?.id, user?.role]);

  const stockSeries = useMemo(() => {
    const rows = [
      { label: ui('متاحة'), value: metrics?.availableInventory ?? 0, color: '#0f5e61' },
      { label: ui('منخفضة'), value: metrics?.lowStock ?? 0, color: '#c3a66f' },
      { label: ui('نافدة'), value: metrics?.outOfStock ?? 0, color: '#7c1e3e' },
    ];
    const total = Math.max(rows.reduce((sum, item) => sum + item.value, 0), 1);
    return { rows, total };
  }, [metrics, language]);

  const actionCards = [
    {
      title: ui('إجمالي طلبات المواد'),
      value: materialRequestsTotal,
      hint: ui('كل الطلبات بجميع حالاتها'),
      href: '/materials/requests',
      accent: 'from-[#123f45] to-[#5b7f81]',
    },
    {
      title: ui('طلبات تحتاج صرفًا'),
      value: metrics?.pendingRequests ?? 0,
      hint: ui('قائمة التنفيذ اليومية للمستودع'),
      href: '/materials/requests',
      accent: 'from-[#0f5e61] to-[#41797a]',
    },
    {
      title: ui('طلبات مصروفة'),
      value: metrics?.issuedRequests ?? 0,
      hint: ui('طلبات تم تنفيذها أو صرفها'),
      href: '/materials/requests',
      accent: 'from-[#2e725f] to-[#78a08b]',
    },
    {
      title: ui('إجمالي العهد'),
      value: custodyTotal,
      hint: ui('العهد النشطة والمعادة'),
      href: '/materials/custody',
      accent: 'from-[#1b4f68] to-[#5f8fa2]',
    },
    {
      title: ui('طلبات الإرجاع'),
      value: returnRequestsTotal,
      hint: ui('المفتوحة والمغلقة'),
      href: '/materials/returns',
      accent: 'from-[#8a6a37] to-[#c3a66f]',
    },
  ];

  const quickActions = [
    { title: ui('طلبات المواد'), hint: ui('رفع ومراجعة وصرف الطلبات'), href: '/materials/requests' },
    { title: ui('المخزون'), hint: ui('إدارة الأصناف والكميات والحالة'), href: '/materials/inventory' },
    { title: ui('المرتجعات'), hint: ui('استلام الإرجاع وتوثيق الحالة'), href: '/materials/returns' },
    { title: ui('العهد'), hint: ui('متابعة العهد النشطة والمتأخرة'), href: '/materials/custody' },
  ];
  const visibleQuickActions = user?.role === 'user'
    ? quickActions.filter((card) => card.href !== '/materials/inventory')
    : quickActions;

  const requestActions = useMemo(() => {
    if (user?.role === 'user') {
      return [
        {
          title: ui('طلب جديد'),
          hint: ui('رفع طلب مواد من المخزن'),
          href: '/materials/requests?new=1',
          icon: <RequestIcon />,
        },
        {
          title: ui('المرتجعات'),
          hint: ui('طلبات الإرجاع والاستلام'),
          href: '/materials/returns',
          icon: <ReturnIcon />,
        },
        {
          title: ui('العهد'),
          hint: ui('العهد النشطة والمتأخرة'),
          href: '/materials/custody',
          icon: <CustodyIcon />,
        },
      ];
    }

    if (user?.role === 'warehouse') {
      return [
        {
          title: ui('طلبات الصرف'),
          hint: ui('تنفيذ الطلبات المعتمدة من المستودع'),
          href: '/materials/requests',
          icon: <RequestIcon />,
        },
        {
          title: ui('المخزون'),
          hint: ui('إدارة الأصناف والكميات والحالة'),
          href: '/materials/inventory',
          icon: <InventoryIcon />,
        },
        {
          title: ui('موافقة الإرجاع'),
          hint: ui('استلام المرتجعات وتوثيق حالتها'),
          href: '/materials/returns',
          icon: <ReturnIcon />,
        },
        {
          title: ui('العهد'),
          hint: ui('متابعة العهد المرتبطة بالمخزن'),
          href: '/materials/custody',
          icon: <CustodyIcon />,
        },
      ];
    }

    return [
      {
        title: ui('طلبات المواد'),
        hint: ui('متابعة جميع طلبات المواد والحالات'),
        href: '/materials/requests',
        icon: <RequestIcon />,
      },
      {
        title: ui('المخزون'),
        hint: ui('متابعة توفر الأصناف ومستوى المخزون'),
        href: '/materials/inventory',
        icon: <InventoryIcon />,
      },
      {
        title: ui('المرتجعات'),
        hint: ui('متابعة حالات الإرجاع والاستلام'),
        href: '/materials/returns',
        icon: <ReturnIcon />,
      },
      {
        title: ui('العهد'),
        hint: ui('متابعة العهد النشطة والمتأخرة'),
        href: '/materials/custody',
        icon: <CustodyIcon />,
      },
    ];
  }, [user?.role, language]);

  const sectionTitle =
    user?.role === 'user' ? ui('اختر نوع الإجراء') : user?.role === 'warehouse' ? ui('مهام المستودع') : ui('متابعة المواد');

  const primaryAction =
    user?.role === 'user'
      ? { label: ui('طلب مواد جديد'), href: '/materials/requests?new=1' }
      : user?.role === 'warehouse'
        ? { label: ui('طلبات الصرف'), href: '/materials/requests' }
        : { label: ui('جميع طلبات المواد'), href: '/materials/requests' };

  const workflow = [
    { label: ui('إجمالي طلبات المواد'), value: materialRequestsTotal },
    { label: ui('طلبات بانتظار الإجراء'), value: metrics?.pendingRequests ?? 0 },
    { label: ui('طلبات مصروفة'), value: metrics?.issuedRequests ?? 0 },
    { label: ui('طلبات معادة'), value: metrics?.returnedRequests ?? 0 },
    { label: ui('طلبات مرفوضة'), value: metrics?.rejectedRequests ?? 0 },
    { label: ui('عهد نشطة'), value: metrics?.activeCustody ?? 0 },
    { label: ui('عهد معادة'), value: metrics?.returnedCustody ?? 0 },
  ];
  const workflowMax = Math.max(...workflow.map((item) => item.value), 1);

  return (
    <div className="space-y-5">
      <section className="rounded-[8px] border border-[#dce6e3] bg-white p-5 shadow-[0_16px_34px_-32px_rgba(15,23,42,0.2)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12px] font-bold text-[#2A6364]">رابط المدربين</div>
            <h2 className="mt-1 text-[22px] font-extrabold text-[#223738]">مساعد تجهيز الدورة</h2>
            <p className="mt-2 max-w-[760px] text-[13px] leading-7 text-[#70807e]">
              متجر تشغيلي لاختيار مستلزمات التدريب، ثم تنتقل الاحتياجات لقسم احتياجات المدربين للحجز الذكي والتحويل إلى طلب مواد.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/training-kit" target="_blank" className="rounded-[8px] bg-[#2A6364] px-5 py-3 text-[14px] font-extrabold text-white">
              فتح مساعد تجهيز الدورة
            </a>
            {user?.role === 'manager' || user?.role === 'warehouse' || user?.canManageTrainerNeeds ? (
              <a href="/materials/trainer-needs" className="rounded-[8px] border border-[#2A6364] px-5 py-3 text-[14px] font-extrabold text-[#2A6364]">
                احتياجات المدربين
              </a>
            ) : null}
          </div>
        </div>
      </section>
      {canSeeRoomOperations ? (
      <section className="grid gap-3 md:grid-cols-4">
        <a href="/materials/rooms-schedule" className="rounded-[8px] border border-[#dce6e3] bg-white p-4 transition hover:border-[#2A6364]">
          <div className="text-[12px] text-[#71817f]">القاعات المحجوزة اليوم</div>
          <div className="mt-2 text-[28px] font-extrabold text-[#2A6364]">{metrics?.roomsBookedToday ?? 0}</div>
        </a>
        <a href="/materials/rooms-schedule" className="rounded-[8px] border border-[#dce6e3] bg-white p-4 transition hover:border-[#2A6364]">
          <div className="text-[12px] text-[#71817f]">القاعات المتاحة اليوم</div>
          <div className="mt-2 text-[28px] font-extrabold text-[#1e6b4c]">{metrics?.roomsAvailableToday ?? 0}</div>
        </a>
        <a href="/materials/rooms-schedule" className="rounded-[8px] border border-[#dce6e3] bg-white p-4 transition hover:border-[#2A6364]">
          <div className="text-[12px] text-[#71817f]">طلبات قاعات بانتظار الاعتماد</div>
          <div className="mt-2 text-[28px] font-extrabold text-[#8a6a37]">{metrics?.pendingRoomBookings ?? 0}</div>
        </a>
        <a href="/materials/rooms-admin" className="rounded-[8px] border border-[#dce6e3] bg-white p-4 transition hover:border-[#2A6364]">
          <div className="text-[12px] text-[#71817f]">إجمالي القاعات</div>
          <div className="mt-2 text-[28px] font-extrabold text-[#223738]">{metrics?.totalTrainingRooms ?? 0}</div>
        </a>
      </section>
      ) : null}
      {isEmployee ? (
        <section className="rounded-[26px] border border-white/80 bg-white p-5 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.2)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[12px] font-semibold text-[#8a9a98]">{ui('إجراءات النظام')}</div>
            <h2 className="mt-1.5 text-[22px] font-extrabold text-[#223738]">{sectionTitle}</h2>
          </div>
          <a
            href={primaryAction.href}
            className="inline-flex items-center justify-center rounded-[16px] bg-[#163e44] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#0f3337]"
          >
            {primaryAction.label}
          </a>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {requestActions.map((action) => (
            <a
              key={action.title}
              href={action.href}
              className="group rounded-[20px] border border-[#dde6e4] bg-[#fbfcfc] p-4 transition hover:-translate-y-0.5 hover:border-[#cfe0dc] hover:bg-white"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#eef5f4] text-[#0f5e61]">
                {action.icon}
              </div>
              <div className="mt-3 text-[18px] font-extrabold text-[#223738]">{action.title}</div>
              <div className="mt-1.5 text-[12px] leading-6 text-[#70807e]">{action.hint}</div>
            </a>
          ))}
        </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[26px] border border-white/80 bg-white shadow-[0_20px_44px_-36px_rgba(15,23,42,0.22)]">
        <div className="grid gap-5 p-5 xl:grid-cols-[1.05fr_0.95fr] xl:p-6">
          <div className="rounded-[24px] bg-[linear-gradient(135deg,#0e5d61_0%,#698b8c_100%)] px-5 py-5 text-white shadow-[0_18px_40px_-32px_rgba(1,101,100,0.58)]">
            <div className="text-[12px] text-white/70">{ui('نظام طلب المواد من المخزن')}</div>
            <h1 className="mt-2.5 text-[25px] font-extrabold leading-tight">
              {isEmployee ? ui('لوحة طلباتي ومتابعتها') : ui('لوحة تشغيل المواد')}
            </h1>
            <p className="mt-2.5 max-w-[620px] text-[13px] leading-7 text-white/84">
              {isEmployee
                ? ui('مدخل مباشر لرفع طلبات المواد ومتابعة حالتها والعهد والمرتجعات المرتبطة بك دون إظهار تفاصيل المخزون التشغيلية.')
                : ui('مركز متابعة يومي يربط بين حالة المخزون وطلبات الصرف والمرتجعات والعهد النشطة، مع وصول مباشر إلى أهم الإجراءات التنفيذية.')}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {isEmployee ? (
                <>
                  <HeroMetric title={ui('طلبات بانتظار الإجراء')} value={metrics?.pendingRequests ?? 0} />
                  <HeroMetric title={ui('طلبات تم صرفها')} value={metrics?.issuedRequests ?? 0} />
                  <HeroMetric title={ui('إجمالي العهد')} value={custodyTotal} />
                </>
              ) : (
                <>
                  <HeroMetric title={ui('إجمالي طلبات المواد')} value={materialRequestsTotal} />
                  <HeroMetric title={ui('طلبات مصروفة')} value={metrics?.issuedRequests ?? 0} />
                  <HeroMetric title={ui('إجمالي العهد')} value={custodyTotal} />
                </>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            {actionCards.map((card) => (
              <a
                key={card.title}
                href={card.href}
                className={`rounded-[22px] bg-gradient-to-l ${card.accent} px-4 py-4 text-white shadow-[0_16px_32px_-30px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5`}
              >
                <div className="text-[12px] text-white/72">{ui('أولوية تنفيذ')}</div>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[19px] font-extrabold">{card.title}</div>
                    <div className="mt-1.5 text-[12px] text-white/82">{card.hint}</div>
                  </div>
                  <div className="text-[30px] font-extrabold leading-none">{card.value}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className={`grid gap-4 ${isEmployee ? '' : 'xl:grid-cols-[0.9fr_1.1fr]'}`}>
        {!isEmployee ? (
        <div className="rounded-[26px] border border-[#dde6e4] bg-white p-5 shadow-[0_16px_34px_-32px_rgba(15,23,42,0.2)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[19px] font-extrabold text-[#223738]">{ui('حالة المخزون')}</h2>
            <a href="/materials/inventory" className="text-[13px] font-semibold text-[#0f5e61]">
              {ui('فتح المخزون')}
            </a>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <DonutChart series={stockSeries.rows} total={stockSeries.total} centerLabel={ui('إجمالي الحالة')} />
            <div className="flex-1 space-y-3">
              {stockSeries.rows.map((item) => (
                <div key={item.label} className="rounded-[18px] border border-[#edf1f1] bg-[#f8fbfb] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[14px] font-semibold text-[#244141]">{item.label}</span>
                    </div>
                    <span className="text-[18px] font-extrabold text-[#223738]">{item.value}</span>
                  </div>
                </div>
              ))}

              <div className="grid gap-3 sm:grid-cols-2">
                <MiniInsight title={ui('مواد مسترجعة')} value={metrics?.returnableItems ?? 0} />
                <MiniInsight title={ui('مواد استهلاكية')} value={metrics?.consumableItems ?? 0} />
              </div>
            </div>
          </div>
        </div>
        ) : null}

        <div className="rounded-[26px] border border-[#dde6e4] bg-white p-5 shadow-[0_16px_34px_-32px_rgba(15,23,42,0.2)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[19px] font-extrabold text-[#223738]">{ui('مسار التنفيذ اليومي')}</h2>
            <span className="rounded-full bg-[#f3f7f6] px-3 py-1 text-[12px] text-[#6f8080]">
              {ui('تشغيل حي قابل للتنفيذ')}
            </span>
          </div>

          <div className="space-y-4">
            {workflow.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="font-semibold text-[#2a4444]">{item.label}</span>
                  <span className="text-[#6f8080]">{item.value}</span>
                </div>
                <div className="h-3 rounded-full bg-[#edf3f2]">
                  <div
                    className="h-3 rounded-full bg-[#0f5e61]"
                    style={{ width: `${(item.value / workflowMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {visibleQuickActions.map((card) => (
              <a
                key={card.title}
                href={card.href}
                className="rounded-[18px] border border-[#dde6e4] bg-[#fbfcfc] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[#cfe0dc] hover:bg-white"
              >
                <div className="text-[16px] font-extrabold text-[#223738]">{card.title}</div>
                <div className="mt-1.5 text-[12px] leading-6 text-[#70807e]">{card.hint}</div>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroMetric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-white/12 bg-white/10 px-4 py-3.5 backdrop-blur-sm">
      <div className="text-[12px] text-white/70">{title}</div>
      <div className="mt-1.5 text-[24px] font-extrabold">{value}</div>
    </div>
  );
}

function MiniInsight({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-[#edf1f1] bg-[#fbfcfc] px-4 py-3.5 text-center">
      <div className="text-[12px] text-[#879795]">{title}</div>
      <div className="mt-1.5 text-[22px] font-extrabold text-[#223738]">{value}</div>
    </div>
  );
}

function DonutChart({
  series,
  total,
  centerLabel,
}: {
  series: { label: string; value: number; color: string }[];
  total: number;
  centerLabel: string;
}) {
  let current = 0;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative h-[154px] w-[154px] shrink-0 self-center">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#eaf0ef" strokeWidth="16" />
        {series.map((item) => {
          const dash = (item.value / total) * circumference;
          const circle = (
            <circle
              key={item.label}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-current}
              strokeLinecap="round"
            />
          );
          current += dash;
          return circle;
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">
        <div>
          <div className="text-[11px] text-[#8b9999]">{centerLabel}</div>
          <div className="text-[24px] font-extrabold text-[#223738]">{total}</div>
        </div>
      </div>
    </div>
  );
}

function RequestIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
      <path d="M7 4h7l3 3v13H7V4Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 4v4h4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 12h4M10 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function InventoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
      <path d="M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 7.5V16.5L12 21l8-4.5V7.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 12v9" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
      <path d="M8 8H5V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8c1.8-2.4 4-3.5 7-3.5 4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CustodyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
      <path d="M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 7.5V16.5L12 21l8-4.5V7.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 12.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
