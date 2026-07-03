'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { t, direction, language } = useI18n();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);
  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(form.email, form.password);
      router.replace('/portal');
      router.refresh();
    } catch (err: any) {
      setError(
        language === 'en'
          ? 'Unable to sign in. Please check your email and password.'
          : err.message || 'تعذر تسجيل الدخول'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={direction}
      className="min-h-screen overflow-x-hidden bg-[#edf3f2]"
      style={{
        background:
          'radial-gradient(circle at top right, rgba(1,101,100,0.08), transparent 22%), radial-gradient(circle at bottom left, rgba(208,178,132,0.10), transparent 22%), linear-gradient(180deg, #f6f8f8 0%, #edf3f2 100%)',
      }}
    >
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden min-h-screen overflow-hidden lg:flex lg:items-center lg:justify-center">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#015f5f_0%,#016564_42%,#014948_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(208,178,132,0.20),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.07),transparent_18%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:34px_34px]" />

          <div className="relative z-10 flex w-full max-w-[760px] flex-col items-center justify-center px-10 text-center text-white">
            <div className="relative flex min-h-[240px] w-[520px] items-center justify-center rounded-[40px] border border-white/10 bg-white/8 px-10 backdrop-blur-md">
              <img
                src="/nauss-gold-logo.png"
                alt={t('portal.naussLogoAlt')}
                className="max-h-[170px] w-auto object-contain"
              />
            </div>

            <div className="mt-10 rounded-[28px] border border-white/10 bg-white/10 px-8 py-6 backdrop-blur-md">
              <p className="text-[34px] font-normal leading-[1.6]">
                {t('common.platform')}
                <br />
                {t('common.agency')}
              </p>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-4 py-5 sm:px-5 sm:py-8 lg:px-8 xl:px-12">
          <div className="absolute inset-0 opacity-50">
            <div className="absolute right-6 top-6 h-28 w-28 rounded-full bg-[#016564]/6 blur-3xl sm:right-10 sm:top-10 sm:h-40 sm:w-40" />
            <div className="absolute bottom-6 left-6 h-24 w-24 rounded-full bg-[#d0b284]/16 blur-3xl sm:bottom-10 sm:left-10 sm:h-32 sm:w-32" />
          </div>

          <div className="relative z-10 w-full max-w-[480px]">
            <div className="mb-4 lg:hidden">
              <div className="rounded-[26px] border border-white/15 bg-[linear-gradient(135deg,#015857_0%,#016564_50%,#0b7f7c_100%)] p-4 sm:rounded-[30px] sm:p-5">
                <div className="flex items-center justify-center rounded-[22px] border border-white/10 bg-white/5 px-4 py-5 sm:rounded-[24px] sm:px-5 sm:py-6">
                  <img
                    src="/nauss-gold-logo.png"
                    alt={t('portal.naussLogoAlt')}
                    className="max-h-[72px] w-auto object-contain sm:max-h-[82px]"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/80 bg-white/92 p-5 shadow-soft sm:rounded-[32px] sm:p-8">
              <div className="mb-6 text-center sm:mb-7">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#016564]/10 text-[#016564] sm:h-14 sm:w-14">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true">
                    <path d="M12 3L19 6V11C19 15.5 16.2 19.74 12 21C7.8 19.74 5 15.5 5 11V6L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9.5 12.2L11.2 13.9L14.8 10.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <h1 className="text-2xl font-normal text-[#0f1d3b] sm:text-4xl">
                  {t('auth.loginTitle')}
                </h1>
                <div className="mt-4 flex justify-center">
                  <LanguageToggle />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="min-w-0">
                  <label className="mb-2 block text-[14px] font-normal text-[#1d2640]">
                    {t('auth.loginEmail')}
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder={t('auth.loginEmailPlaceholder')}
                    className="min-h-[54px] w-full rounded-[18px] border border-[#d8dee1] bg-white px-4 text-[15px] font-normal text-[#1d2640] outline-none transition placeholder:text-[#9aa3b2] focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10"
                    required
                  />
                </div>

                <div className="min-w-0">
                  <label className="mb-2 block text-[14px] font-normal text-[#1d2640]">
                    {t('auth.password')}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    placeholder={t('auth.passwordPlaceholder')}
                    className="min-h-[54px] w-full rounded-[18px] border border-[#d8dee1] bg-white px-4 text-[15px] font-normal text-[#1d2640] outline-none transition placeholder:text-[#9aa3b2] focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10"
                    required
                  />
                </div>

                <label className="flex items-center gap-2 text-[13px] text-[#5f687b]">
                  <input
                    type="checkbox"
                    checked={keepConnected}
                    onChange={(event) => setKeepConnected(event.target.checked)}
                    className="h-4 w-4 rounded border-[#cbd5d4] text-[#016564] focus:ring-[#016564]"
                  />
                  <span>{t('auth.keepConnected')}</span>
                </label>

                {error ? (
                  <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-6 text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-[54px] w-full items-center justify-center rounded-[18px] bg-[#016564] px-4 text-[15px] font-semibold text-white shadow-[0_16px_28px_rgba(1,101,100,0.18)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? t('auth.loginLoading') : t('auth.loginButton')}
                </button>
              </form>

              <div className="mt-5 text-center text-[14px] text-[#5f687b]">
                {t('auth.requestAccountPrompt')}
                <Link href="/request-account" className="mx-2 font-semibold text-[#016564] hover:underline">
                  {t('auth.requestAccountLink')}
                </Link>
              </div>

              <div className="mt-3 grid gap-3">
                <Link
                  href="/training-kit"
                  className="group flex items-center gap-4 rounded-[20px] border border-[#d8e3e1] bg-[#f8fbfb] px-4 py-4 text-right transition hover:border-[#016564] hover:bg-white"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#016564] text-white shadow-[0_14px_24px_rgba(1,101,100,0.18)]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
                      <path d="M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M4 7.5v8.8L12 21l8-4.7V7.5" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M8.5 13.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-extrabold text-[#163e44]">مساعد تجهيز الدورة</span>
                    <span className="mt-1 block text-[12px] leading-6 text-[#687b79]">دخول مباشر للمدربين لاختيار مستلزمات التدريب</span>
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
