'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch, getAdminSession } from '@/lib/adminAuth'
import { useAdminI18n } from '@/lib/i18n/admin'

type SystemSettings = {
  app_env: string
  enforce_https: boolean
  allowed_origins: string[]
  ws_require_ephemeral_token: boolean
  ws_max_per_ip: number
  ws_max_per_hour: number
  login_max_attempts: number
  login_lockout_minutes: number
}

const defaultSettings: SystemSettings = {
  app_env: 'development',
  enforce_https: false,
  allowed_origins: ['http://localhost:3000'],
  ws_require_ephemeral_token: true,
  ws_max_per_ip: 3,
  ws_max_per_hour: 20,
  login_max_attempts: 5,
  login_lockout_minutes: 15,
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)
  const session = useMemo(() => getAdminSession(), [])

  const [settings, setSettings] = useState<SystemSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!session) {
        router.replace('/admin/login')
        return
      }
      if (session.role !== 'super_admin') {
        router.replace(session.museum_id ? `/admin/museum/${session.museum_id}` : '/admin/login')
        return
      }

      try {
        const res = await adminFetch('/admin/settings/system')
        if (res?.settings) {
          setSettings({
            app_env: res.settings.app_env || 'development',
            enforce_https: !!res.settings.enforce_https,
            allowed_origins: Array.isArray(res.settings.allowed_origins) ? res.settings.allowed_origins : ['http://localhost:3000'],
            ws_require_ephemeral_token: !!res.settings.ws_require_ephemeral_token,
            ws_max_per_ip: Number(res.settings.ws_max_per_ip || 3),
            ws_max_per_hour: Number(res.settings.ws_max_per_hour || 20),
            login_max_attempts: Number(res.settings.login_max_attempts || 5),
            login_lockout_minutes: Number(res.settings.login_lockout_minutes || 15),
          })
        }
      } catch {
        router.replace('/admin/login')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, session])

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      await adminFetch('/admin/settings/system', {
        method: 'PUT',
        body: JSON.stringify(settings),
      })
      setMessage(tr('Đã lưu cài đặt hệ thống.', 'System settings saved.'))
    } catch (e: unknown) {
      if (e instanceof Error) setMessage(e.message)
      else setMessage(tr('Lưu thất bại.', 'Save failed.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ flex: 1, padding: 24 }}>{tr('Đang tải...', 'Loading...')}</div>

  return (
    <div style={{ flex: 1, padding: 24, maxWidth: 860 }}>
      <h1 style={{ marginTop: 0, color: '#C9A84C', fontFamily: 'Cormorant Garamond, serif' }}>
        {tr('System Settings', 'System Settings')}
      </h1>

      <div style={card}>
        <Label>{tr('Môi trường', 'Environment')}</Label>
        <input value={settings.app_env} onChange={(e) => setSettings((s) => ({ ...s, app_env: e.target.value }))} style={input} />

        <Label>{tr('Allowed Origins (mỗi dòng 1 domain)', 'Allowed Origins (one domain per line)')}</Label>
        <textarea
          value={settings.allowed_origins.join('\n')}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              allowed_origins: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean),
            }))
          }
          style={{ ...input, minHeight: 110, resize: 'vertical' as const }}
        />

        <div style={row}>
          <Toggle
            label={tr('Bật HTTPS redirect', 'Enable HTTPS redirect')}
            checked={settings.enforce_https}
            onChange={(checked) => setSettings((s) => ({ ...s, enforce_https: checked }))}
          />
          <Toggle
            label={tr('Bắt buộc WS ephemeral token', 'Require WS ephemeral token')}
            checked={settings.ws_require_ephemeral_token}
            onChange={(checked) => setSettings((s) => ({ ...s, ws_require_ephemeral_token: checked }))}
          />
        </div>

        <div style={row}>
          <NumberField
            label={tr('WS max/concurrent per IP', 'WS max/concurrent per IP')}
            value={settings.ws_max_per_ip}
            onChange={(v) => setSettings((s) => ({ ...s, ws_max_per_ip: v }))}
          />
          <NumberField
            label={tr('WS max/hour per IP', 'WS max/hour per IP')}
            value={settings.ws_max_per_hour}
            onChange={(v) => setSettings((s) => ({ ...s, ws_max_per_hour: v }))}
          />
        </div>

        <div style={row}>
          <NumberField
            label={tr('Login max attempts', 'Login max attempts')}
            value={settings.login_max_attempts}
            onChange={(v) => setSettings((s) => ({ ...s, login_max_attempts: v }))}
          />
          <NumberField
            label={tr('Lockout minutes', 'Lockout minutes')}
            value={settings.login_lockout_minutes}
            onChange={(v) => setSettings((s) => ({ ...s, login_lockout_minutes: v }))}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={save} disabled={saving} style={btnPrimary}>
            {saving ? tr('Đang lưu...', 'Saving...') : tr('Lưu cài đặt', 'Save settings')}
          </button>
          {message && <span style={{ fontSize: 13, color: '#86efac' }}>{message}</span>}
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>{children}</div>
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div style={{ flex: 1 }}>
      <Label>{label}</Label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value || 0))} style={input} />
    </div>
  )
}

const card: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}
const row: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }
const input: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.04)',
  color: '#F5F0E8',
  boxSizing: 'border-box',
}
const btnPrimary: CSSProperties = {
  padding: '9px 14px',
  borderRadius: 8,
  border: 'none',
  background: '#C9A84C',
  color: '#0A0A0A',
  fontWeight: 600,
  cursor: 'pointer',
}
