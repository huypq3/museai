'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ImageUpload from '@/components/admin/ImageUpload'
import { adminFetch, getAdminSession } from '@/lib/adminAuth'
import { useAdminI18n } from '@/lib/i18n/admin'
import { MUSEUM_REQUIRED_FIELDS, calculateCompletion } from '@/lib/validation'

type Tab = 'museum' | 'password'

type MuseumForm = {
  name: string
  name_en: string
  slug: string
  address: string
  city: string
  country: string
  phone: string
  email: string
  website: string
  logo_url: string
  cover_image_url: string
  opening_hours: Record<string, string>
  ticket_price: {
    adult_vnd: number
    child_vnd: number
    foreign_adult_usd: number
    free_for: string
  }
  supported_languages: string[]
  default_language: string
  ai_persona: string
  welcome_message: Record<string, string>
}

const LANGS = ['vi', 'en', 'de', 'ru', 'ar', 'es', 'fr', 'ja', 'ko', 'zh']

const EMPTY_FORM: MuseumForm = {
  name: '',
  name_en: '',
  slug: '',
  address: '',
  city: '',
  country: 'Vietnam',
  phone: '',
  email: '',
  website: '',
  logo_url: '',
  cover_image_url: '',
  opening_hours: {
    monday: '08:00-17:00',
    tuesday: '08:00-17:00',
    wednesday: '08:00-17:00',
    thursday: '08:00-17:00',
    friday: '08:00-17:00',
    saturday: '08:00-17:00',
    sunday: 'Closed',
  },
  ticket_price: {
    adult_vnd: 30000,
    child_vnd: 15000,
    foreign_adult_usd: 2,
    free_for: 'Children under 6',
  },
  supported_languages: ['vi', 'en'],
  default_language: 'vi',
  ai_persona: 'Friendly and knowledgeable museum guide',
  welcome_message: {
    vi: 'Xin chao! Toi la tro ly AI cua bao tang.',
    en: "Welcome! I'm your AI museum guide.",
  },
}

export default function MuseumAdminSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const museumId = params.id as string
  const session = useMemo(() => getAdminSession(), [])
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)

  const [tab, setTab] = useState<Tab>('museum')
  const [form, setForm] = useState<MuseumForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [password, setPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const completion = useMemo(() => calculateCompletion(form, MUSEUM_REQUIRED_FIELDS), [form])

  useEffect(() => {
    if (!session) {
      router.replace('/admin/login')
      return
    }
    if (session.role === 'museum_admin' && session.museum_id !== museumId) {
      router.replace(`/admin/museum/${session.museum_id}`)
      return
    }

    adminFetch(`/admin/museums/${museumId}`)
      .then((data) => {
        setForm({
          ...EMPTY_FORM,
          ...data,
          opening_hours: { ...EMPTY_FORM.opening_hours, ...(data?.opening_hours || {}) },
          ticket_price: { ...EMPTY_FORM.ticket_price, ...(data?.ticket_price || {}) },
          supported_languages: data?.supported_languages || EMPTY_FORM.supported_languages,
          welcome_message: { ...EMPTY_FORM.welcome_message, ...(data?.welcome_message || {}) },
        })
      })
      .catch(() => router.replace('/admin/login'))
      .finally(() => setLoading(false))
  }, [museumId, router, session])

  async function saveMuseumInfo() {
    setSaving(true)
    try {
      await adminFetch(`/admin/museums/${museumId}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      })
      alert(tr('Museum information updated', 'Museum information updated'))
    } catch (error: unknown) {
      alert(extractApiError(error, tr))
    } finally {
      setSaving(false)
    }
  }

  async function changePassword() {
    if (password.length < 8) {
      alert(tr('Password must be at least 8 characters', 'Password must be at least 8 characters'))
      return
    }
    setSavingPassword(true)
    try {
      await adminFetch('/admin/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      setPassword('')
      alert(tr('Password changed successfully', 'Password changed successfully'))
    } catch (error: unknown) {
      alert(extractApiError(error, tr))
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return <div style={{ flex: 1, padding: 24, color: 'rgba(245,240,232,0.65)' }}>{tr('Loading...', 'Loading...')}</div>
  }

  return (
    <div style={{ flex: 1, padding: 24, maxWidth: 1100 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#C9A84C' }}>
          {tr('Museum settings', 'Museum settings')}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          {museumId}
        </div>
      </div>

      <div style={{ marginBottom: 14, color: completion.missing.length ? '#fca5a5' : '#86efac', fontSize: 13 }}>
        {tr('Museum profile', 'Museum profile')}: {completion.completed}/{completion.total}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TabBtn active={tab === 'museum'} onClick={() => setTab('museum')}>
          {tr('Museum info', 'Museum info')}
        </TabBtn>
        <TabBtn active={tab === 'password'} onClick={() => setTab('password')}>
          {tr('Change password', 'Change password')}
        </TabBtn>
      </div>

      {tab === 'museum' && (
        <>
          <div style={card}>
            <div style={grid2}>
              <Field label={tr('Museum name (vi) *', 'Museum name (vi) *')}>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} />
              </Field>
              <Field label={tr('Museum name (en) *', 'Museum name (en) *')}>
                <input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} style={input} />
              </Field>
              <Field label="Slug">
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} style={input} />
              </Field>
              <Field label={tr('Address *', 'Address *')}>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={input} />
              </Field>
              <Field label={tr('City *', 'City *')}>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={input} />
              </Field>
              <Field label={tr('Country', 'Country')}>
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={input} />
              </Field>
              <Field label={tr('Phone *', 'Phone *')}>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={input} />
              </Field>
              <Field label={tr('Email *', 'Email *')}>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} />
              </Field>
              <Field label={tr('Website', 'Website')}>
                <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={input} />
              </Field>
              <div />
              <div style={{ gridColumn: '1 / -1' }}>
                <ImageUpload value={form.logo_url} onChange={(logo_url) => setForm({ ...form, logo_url })} label={tr('Logo *', 'Logo *')} />
                <ImageUpload value={form.cover_image_url} onChange={(cover_image_url) => setForm({ ...form, cover_image_url })} label={tr('Cover image *', 'Cover image *')} />
              </div>
            </div>
          </div>

          <div style={{ ...card, marginTop: 14 }}>
            <div style={grid2}>
              {Object.keys(form.opening_hours).map((day) => (
                <Field key={day} label={`${tr('Opening hours', 'Opening hours')} - ${day}`}>
                  <input
                    value={form.opening_hours[day]}
                    onChange={(e) => setForm({ ...form, opening_hours: { ...form.opening_hours, [day]: e.target.value } })}
                    style={input}
                  />
                </Field>
              ))}
              <Field label={tr('Adult ticket (VND)', 'Adult ticket (VND)')}>
                <input type="number" value={form.ticket_price.adult_vnd} onChange={(e) => setForm({ ...form, ticket_price: { ...form.ticket_price, adult_vnd: Number(e.target.value) } })} style={input} />
              </Field>
              <Field label={tr('Child ticket (VND)', 'Child ticket (VND)')}>
                <input type="number" value={form.ticket_price.child_vnd} onChange={(e) => setForm({ ...form, ticket_price: { ...form.ticket_price, child_vnd: Number(e.target.value) } })} style={input} />
              </Field>
              <Field label={tr('Foreign adult ticket (USD)', 'Foreign adult ticket (USD)')}>
                <input type="number" value={form.ticket_price.foreign_adult_usd} onChange={(e) => setForm({ ...form, ticket_price: { ...form.ticket_price, foreign_adult_usd: Number(e.target.value) } })} style={input} />
              </Field>
              <Field label={tr('Free for', 'Free for')}>
                <input value={form.ticket_price.free_for} onChange={(e) => setForm({ ...form, ticket_price: { ...form.ticket_price, free_for: e.target.value } })} style={input} />
              </Field>
            </div>
          </div>

          <div style={{ ...card, marginTop: 14 }}>
            <Field label={tr('Supported languages *', 'Supported languages *')}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {LANGS.map((lang) => {
                  const active = form.supported_languages.includes(lang)
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? form.supported_languages.filter((x) => x !== lang)
                          : [...form.supported_languages, lang]
                        setForm({ ...form, supported_languages: next })
                      }}
                      style={{ ...chip, background: active ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)', color: active ? '#C9A84C' : '#F5F0E8' }}
                    >
                      {lang.toUpperCase()}
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label={tr('Default language', 'Default language')}>
              <select value={form.default_language} onChange={(e) => setForm({ ...form, default_language: e.target.value })} style={input}>
                {LANGS.map((lang) => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
              </select>
            </Field>
            <Field label={tr('AI persona *', 'AI persona *')}>
              <textarea value={form.ai_persona} onChange={(e) => setForm({ ...form, ai_persona: e.target.value })} style={{ ...input, minHeight: 100, resize: 'vertical' }} />
            </Field>
            <Field label={tr('Welcome message (VI)', 'Welcome message (VI)')}>
              <textarea value={form.welcome_message.vi || ''} onChange={(e) => setForm({ ...form, welcome_message: { ...form.welcome_message, vi: e.target.value } })} style={{ ...input, minHeight: 80, resize: 'vertical' }} />
            </Field>
            <Field label={tr('Welcome message (EN)', 'Welcome message (EN)')}>
              <textarea value={form.welcome_message.en || ''} onChange={(e) => setForm({ ...form, welcome_message: { ...form.welcome_message, en: e.target.value } })} style={{ ...input, minHeight: 80, resize: 'vertical' }} />
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, gap: 10 }}>
            <div style={{ color: 'rgba(245,240,232,0.65)', fontSize: 12 }}>
              {completion.missing.length > 0
                ? `${tr('Missing', 'Missing')}: ${completion.missing.join(', ')}`
                : tr('All required fields are complete', 'All required fields are complete')}
            </div>
            <button onClick={saveMuseumInfo} disabled={saving} style={btnPrimary}>
              {saving ? tr('Saving...', 'Saving...') : tr('Save museum info', 'Save museum info')}
            </button>
          </div>
        </>
      )}

      {tab === 'password' && (
        <div style={{ ...card, maxWidth: 520 }}>
          <Field label={tr('New password', 'New password')}>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tr('At least 8 characters, with uppercase and number', 'At least 8 characters, with uppercase and number')}
              style={input}
              type="password"
            />
          </Field>
          <button onClick={changePassword} disabled={savingPassword} style={btnPrimary}>
            {savingPassword ? tr('Updating...', 'Updating...') : tr('Change password', 'Change password')}
          </button>
        </div>
      )}
    </div>
  )
}

function extractApiError(error: unknown, tr: (vi: string, en: string) => string) {
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { message?: string; detail?: unknown }
    if (typeof maybe.message === 'string') return maybe.message
    if (typeof maybe.detail === 'string') return maybe.detail
    if (typeof maybe.detail === 'object' && maybe.detail !== null) {
      const detail = maybe.detail as { message?: string; missing?: string[] }
      if (detail.message) {
        const suffix = Array.isArray(detail.missing) && detail.missing.length
          ? `\n${tr('Missing:', 'Missing:')} ${detail.missing.join(', ')}`
          : ''
        return `${detail.message}${suffix}`
      }
    }
  }
  return tr('Update failed', 'Update failed')
}

function TabBtn({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: active ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)', color: active ? '#C9A84C' : '#F5F0E8', cursor: 'pointer' }}>
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.7)', marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  )
}

const card: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 14,
}

const grid2: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
}

const input: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.04)',
  color: '#F5F0E8',
  boxSizing: 'border-box',
}

const chip: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.12)',
  cursor: 'pointer',
}

const btnPrimary: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#C9A84C',
  color: '#0A0A0A',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}
