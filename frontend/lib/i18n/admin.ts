'use client'

import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type AdminLocale = 'vi' | 'en'

type Dictionary = Record<string, string>

const MESSAGES: Record<AdminLocale, Dictionary> = {
  vi: {
    nav_overview: 'Tổng quan',
    nav_museums: 'Bảo tàng',
    nav_users: 'Tài khoản',
    nav_analytics: 'Analytics',
    nav_qr: 'QR Codes',
    nav_settings: 'Cài đặt',
    back: 'Quay lại',
    logout: 'Đăng xuất',
    language: 'Ngôn ngữ',
    dashboard: 'Bảng điều khiển',
  },
  en: {
    nav_overview: 'Overview',
    nav_museums: 'Museums',
    nav_users: 'Users',
    nav_analytics: 'Analytics',
    nav_qr: 'QR Codes',
    nav_settings: 'Settings',
    back: 'Back',
    logout: 'Logout',
    language: 'Language',
    dashboard: 'Dashboard',
  },
}

type AdminI18nState = {
  locale: AdminLocale
  setLocale: (next: AdminLocale) => void
  t: (key: string) => string
}

const AdminI18nContext = createContext<AdminI18nState | null>(null)

const STORAGE_KEY = 'admin_language'

export function AdminI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>('en')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('admin_locale')
    if (saved === 'vi' || saved === 'en') {
      setLocaleState(saved)
    }
  }, [])

  const value = useMemo<AdminI18nState>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocaleState(next)
        localStorage.setItem(STORAGE_KEY, next)
        // Backward compatibility for older builds/pages that still read old key.
        localStorage.setItem('admin_locale', next)
      },
      t: (key: string) => MESSAGES[locale][key] || key,
    }),
    [locale]
  )

  return createElement(AdminI18nContext.Provider, { value }, children)
}

export function useAdminI18n() {
  const ctx = useContext(AdminI18nContext)
  if (!ctx) throw new Error('useAdminI18n must be used within AdminI18nProvider')
  return ctx
}
