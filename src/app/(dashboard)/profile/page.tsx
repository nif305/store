'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type ProfileData = {
  fullName: string;
  email: string;
  mobile: string;
  department: string;
  jobTitle: string;
  telegramChatId: string | null;
};

export default function ProfilePage() {
  const { user } = useAuth();
  const { language } = useI18n();
  const isEn = language === 'en';
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/users/me');
      if (res.ok) setProfile(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function generateLinkToken() {
    setLinking(true);
    try {
      const res = await fetch('/api/telegram/link');
      if (res.ok) {
        const data = await res.json();
        setLinkToken(data.token);
      }
    } finally {
      setLinking(false);
    }
  }

  async function unlink() {
    setUnlinking(true);
    try {
      const res = await fetch('/api/telegram/link', { method: 'DELETE' });
      if (res.ok) {
        setProfile((prev) => prev ? { ...prev, telegramChatId: null } : prev);
        setLinkToken(null);
      }
    } finally {
      setUnlinking(false);
    }
  }

  function copyCommand() {
    if (!linkToken) return;
    navigator.clipboard.writeText(`/start ${linkToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'YourBot';

  if (loading) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-gray-200 mb-4" />
        <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6" dir={isEn ? 'ltr' : 'rtl'}>
      <h1 className="text-2xl font-bold text-[#016564]">{isEn ? 'My Profile' : 'ملفي الشخصي'}</h1>

      {/* Info */}
      <Card className="rounded-2xl p-5 space-y-3">
        <Row label={isEn ? 'Name' : 'الاسم'} value={profile?.fullName} />
        <Row label={isEn ? 'Email' : 'البريد'} value={profile?.email} />
        <Row label={isEn ? 'Mobile' : 'الجوال'} value={profile?.mobile} />
        <Row label={isEn ? 'Department' : 'القسم'} value={profile?.department} />
        <Row label={isEn ? 'Job Title' : 'المسمى الوظيفي'} value={profile?.jobTitle} />
      </Card>

      {/* Telegram */}
      <Card className="rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#229ED9]/10 text-[#229ED9] text-xl">✈️</div>
          <div>
            <div className="font-bold text-[#152625]">{isEn ? 'Link Telegram' : 'ربط Telegram'}</div>
            <div className="text-xs text-[#61706f]">{isEn ? 'Receive request and custody notifications directly on Telegram' : 'استلم إشعارات الطلبات والعهد مباشرة على تيليغرام'}</div>
          </div>
        </div>

        {profile?.telegramChatId ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <span className="text-green-600 font-bold">✅ {isEn ? 'Linked successfully' : 'مرتبط بنجاح'}</span>
            </div>
            <Button variant="ghost" onClick={unlink} disabled={unlinking}
              className="w-full border border-red-200 text-red-600 hover:bg-red-50">
              {unlinking ? (isEn ? 'Unlinking...' : 'جارٍ فك الربط...') : (isEn ? 'Unlink' : 'فك الربط')}
            </Button>
          </div>
        ) : linkToken ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#e8f0ef] bg-[#f6fbfb] p-4">
              <div className="text-sm font-semibold text-[#152625] mb-2">{isEn ? 'Steps:' : 'الخطوات:'}</div>
              <ol className="text-sm text-[#536866] space-y-2 list-none">
                <li>1. {isEn ? 'Open Telegram and search for' : 'افتح تيليغرام وابحث عن'} <span className="font-bold text-[#229ED9]">@{botUsername}</span></li>
                <li>2. {isEn ? 'Send this command to the bot:' : 'أرسل هذا الأمر للبوت:'}</li>
              </ol>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#d0e8e6] bg-white px-3 py-2 font-mono text-sm text-[#016564]">
                <span className="flex-1 select-all">/start {linkToken}</span>
                <button onClick={copyCommand}
                  className="shrink-0 rounded-lg bg-[#016564] px-3 py-1 text-xs font-bold text-white hover:bg-[#014f4f]">
                  {copied ? '✓' : (isEn ? 'Copy' : 'نسخ')}
                </button>
              </div>
              <div className="mt-2 text-xs text-[#8a9a98]">{isEn ? 'After sending, you will receive a confirmation and notifications will start.' : 'بعد الإرسال ستصلك رسالة تأكيد وتبدأ الإشعارات فوراً.'}</div>
            </div>
            <Button variant="ghost" onClick={generateLinkToken} disabled={linking} className="w-full text-sm">
              {isEn ? 'Refresh token' : 'تجديد الرمز'}
            </Button>
          </div>
        ) : (
          <Button onClick={generateLinkToken} disabled={linking} className="w-full">
            {linking ? (isEn ? 'Creating...' : 'جارٍ الإنشاء...') : (isEn ? 'Link Telegram account' : 'ربط حساب Telegram')}
          </Button>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-32 shrink-0 font-semibold text-[#5c7272]">{label}</span>
      <span className="text-[#1a2e2d]">{value || '—'}</span>
    </div>
  );
}
