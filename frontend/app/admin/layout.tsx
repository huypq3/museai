'use client'

import { useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { clearAdminToken, getAdminSession } from '@/lib/adminAuth'
import { AdminI18nProvider, useAdminI18n } from '@/lib/i18n/admin'
import MuseAILogo from '@/components/MuseAILogo'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminI18nProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminI18nProvider>
  )
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const session = getAdminSession()
  const { locale, setLocale, t } = useAdminI18n()

  const hideChrome = pathname === '/admin/login'
  const canBack = !['/admin', '/admin/login', '/admin/dashboard'].includes(pathname)
  const isSuper = session?.role === 'super_admin'
  const museumHome = session?.museum_id ? `/admin/museum/${session.museum_id}` : '/admin/dashboard'

  const navItems = useMemo(
    () =>
      isSuper
        ? [
            { icon: '🏠', label: t('nav_overview'), href: '/admin/dashboard', activePrefixes: ['/admin/dashboard'] },
            { icon: '🏛️', label: t('nav_museums'), href: '/admin/museums', activePrefixes: ['/admin/museums'] },
            { icon: '👥', label: t('nav_users'), href: '/admin/users', activePrefixes: ['/admin/users'] },
            { icon: '📊', label: t('nav_analytics'), href: '/admin/analytics', activePrefixes: ['/admin/analytics'] },
            { icon: '⚙️', label: t('nav_settings'), href: '/admin/settings', activePrefixes: ['/admin/settings'] },
          ]
        : [
            { icon: '🏛️', label: t('nav_exhibits'), href: museumHome, activePrefixes: [museumHome], excludePrefixes: [`${museumHome}/settings`] },
            { icon: '📊', label: t('nav_analytics'), href: '/admin/analytics', activePrefixes: ['/admin/analytics'] },
            { icon: '⚙️', label: t('nav_settings'), href: `${museumHome}/settings`, activePrefixes: [`${museumHome}/settings`] },
          ],
    [isSuper, museumHome, session?.museum_id, t]
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      color: '#F5F0E8',
      fontFamily: 'DM Sans, sans-serif',
      display: 'flex',
    }}>
      {hideChrome ? (
        children
      ) : (
        <>
          <aside
            style={{
              width: 230,
              borderRight: '1px solid rgba(255,255,255,0.08)',
              padding: 12,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <MuseAILogo variant="horizontal" theme="dark" iconSize={30} />
            </div>
            {navItems.map((item) => (
              (() => {
                const matchesPath = (item.activePrefixes || []).some((p: string) =>
                  p.endsWith('/') ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)
                )
                const matchesExclude = (item.excludePrefixes || []).some((p: string) => pathname.includes(p))
                const isActive = matchesPath && !matchesExclude
                return (
              <button
                key={item.href + item.label}
                onClick={() => router.push(item.href)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: isActive ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)',
                  color: '#F5F0E8',
                  marginBottom: 6,
                  cursor: 'pointer',
                }}
              >
                {item.icon} {item.label}
              </button>
                )
              })()
            ))}
          </aside>

          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {canBack && (
                  <button
                    onClick={() => router.back()}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#F5F0E8',
                      cursor: 'pointer',
                    }}
                  >
                    ← {t('back')}
                  </button>
                )}
                <span style={{ opacity: 0.75, fontSize: 13 }}>{t('dashboard')}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, opacity: 0.75 }}>{t('language')}</span>
                <button
                  onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#F5F0E8',
                    cursor: 'pointer',
                  }}
                >
                  {locale.toUpperCase()}
                </button>
                <button
                  onClick={() => {
                    clearAdminToken()
                    router.push('/admin/login')
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(127,29,29,0.45)',
                    color: '#F5F0E8',
                    cursor: 'pointer',
                  }}
                >
                  {t('logout')}
                </button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
          </main>
        </>
      )}
    </div>
  )
}
