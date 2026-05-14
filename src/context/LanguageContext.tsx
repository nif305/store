'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth, type AppLanguage } from '@/context/AuthContext';
import { StaticUiTranslator } from '@/components/layout/StaticUiTranslator';

type LanguageContextType = {
  language: AppLanguage;
  direction: 'rtl' | 'ltr';
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const LANGUAGE_STORAGE_KEY = 'inventory-ui-language';

function normalizeLanguage(value?: string | null): AppLanguage {
  return String(value || '').trim().toLowerCase() === 'en' ? 'en' : 'ar';
}

function readStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'ar';

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored) return normalizeLanguage(stored);

  const cookieMatch = document.cookie.match(/(?:^|;\s*)preferred_language=([^;]+)/);
  if (cookieMatch?.[1]) return normalizeLanguage(decodeURIComponent(cookieMatch[1]));

  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'ar';
}

function persistLanguage(language: AppLanguage) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  document.cookie = `preferred_language=${language}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

function applyDocumentLanguage(language: AppLanguage) {
  if (typeof document === 'undefined') return;

  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.body.dataset.language = language;
  document.title =
    language === 'ar'
      ? 'منصة مواد التدريب'
      : 'Training Materials Platform';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<AppLanguage>(() => readStoredLanguage());

  useLayoutEffect(() => {
    const explicitStoredLanguage =
      typeof window !== 'undefined' ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
    const storedLanguage = explicitStoredLanguage ? normalizeLanguage(explicitStoredLanguage) : null;
    const preferredLanguage = user?.preferredLanguage;
    const nextLanguage = storedLanguage || (preferredLanguage ? normalizeLanguage(preferredLanguage) : readStoredLanguage());
    setLanguageState(nextLanguage);
    persistLanguage(nextLanguage);
    applyDocumentLanguage(nextLanguage);
  }, [user?.preferredLanguage]);

  useLayoutEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    const normalized = normalizeLanguage(nextLanguage);
    setLanguageState(normalized);
    persistLanguage(normalized);
    applyDocumentLanguage(normalized);

    fetch('/api/auth/language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ preferredLanguage: normalized }),
    }).catch(() => null);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  }, [language, setLanguage]);

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      direction: language === 'ar' ? 'rtl' : 'ltr',
      setLanguage,
      toggleLanguage,
    }),
    [language, setLanguage, toggleLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>
      <StaticUiTranslator language={language} />
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
}

