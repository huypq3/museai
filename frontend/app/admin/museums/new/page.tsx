'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/adminAuth'
import { MUSEUM_REQUIRED_FIELDS, calculateCompletion } from '@/lib/validation'
import ImageUpload from '@/components/admin/ImageUpload'
import { useAdminI18n } from '@/lib/adminI18n'

type Tab = 'basic' | 'ops' | 'ai' | 'account'

const LANGS = ['vi', 'en', 'fr', 'ja', 'ko', 'zh']

export default function NewMuseumPage() {
  const router = useRouter()
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)
  const [tab, setTab] = useState<Tab>('basic')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState<any>({
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
      sunday: 'Đóng cửa',
    },
    ticket_price: {
      adult_vnd: 30000,
      child_vnd: 15000,
      foreign_adult_usd: 2,
      free_for: 'Trẻ em dưới 6 tuổi',
    },
    supported_languages: ['vi', 'en'],
    default_language: 'vi',
    ai_persona: 'Hướng dẫn viên thân thiện, am hiểu lịch sử',
    welcome_message: { vi: 'Xin chào! Tôi là trợ lý AI của bảo tàng.', en: "Welcome! I'm your AI museum guide." },
    admin_username: '',
    admin_password: '',
    admin_email: '',
  })
  const [result, setResult] = useState<any>(null)

  const completion = useMemo(() => calculateCompletion(form, MUSEUM_REQUIRED_FIELDS), [form])

  const onCreate = async () => {
    setSubmitted(true)
    if (completion.missing.length > 0) {
      alert(`${tr('Thiếu trường bắt buộc', 'Missing required fields')}: ${completion.missing.join(', ')}`)
      return
    }
    if (!form.admin_username || !form.admin_password || form.admin_password.length < 8) {
      alert(tr('Thông tin tài khoản admin chưa hợp lệ (password >= 8 ký tự)', 'Invalid admin account info (password >= 8 chars)'))
      return
    }
    setSaving(true)
    try {
      const data = await adminFetch('/admin/museums/', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setResult(data)
      alert(tr('Tạo bảo tàng thành công', 'Museum created successfully'))
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ flex: 1, padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={{ margin: 0, color: '#C9A84C', fontFamily: 'Cormorant Garamond, serif' }}>{tr('Tạo bảo tàng mới', 'Create new museum')}</h1>
        <button onClick={() => router.push('/admin/museums')} style={btnGhost}>← {tr('Quay lại', 'Back')}</button>
      </div>

      <div style={{ marginBottom: 14, color: completion.missing.length ? '#fca5a5' : '#86efac', fontSize: 13 }}>
        {tr('Hồ sơ bảo tàng', 'Museum profile')}: {completion.completed}/{completion.total} {completion.missing.length ? '⚠️' : '✅'}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TabBtn active={tab === 'basic'} onClick={() => setTab('basic')}>{tr('Thông tin cơ bản', 'Basic info')}</TabBtn>
        <TabBtn active={tab === 'ops'} onClick={() => setTab('ops')}>{tr('Giờ & Giá vé', 'Hours & Ticket')}</TabBtn>
        <TabBtn active={tab === 'ai'} onClick={() => setTab('ai')}>{tr('Cấu hình AI', 'AI Config')}</TabBtn>
        <TabBtn active={tab === 'account'} onClick={() => setTab('account')}>{tr('Tài khoản Admin', 'Admin account')}</TabBtn>
      </div>

      <div style={card}>
        {tab === 'basic' && (
          <div style={grid2}>
            <Field label={tr('Tên bảo tàng (vi) *', 'Museum name (vi) *')}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} /></Field>
            {submitted && !form.name && <ErrorText>Vui lòng nhập tên bảo tàng (vi)</ErrorText>}
            <Field label={tr('Tên bảo tàng (en) *', 'Museum name (en) *')}><input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} style={input} /></Field>
            {submitted && !form.name_en && <ErrorText>Vui lòng nhập tên bảo tàng (en)</ErrorText>}
            <Field label="Slug"><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} style={input} /></Field>
            <Field label={tr('Địa chỉ *', 'Address *')}><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={input} /></Field>
            {submitted && !form.address && <ErrorText>Vui lòng nhập địa chỉ</ErrorText>}
            <Field label={tr('Thành phố *', 'City *')}><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={input} /></Field>
            {submitted && !form.city && <ErrorText>Vui lòng nhập thành phố</ErrorText>}
            <Field label={tr('Quốc gia', 'Country')}><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={input} /></Field>
            <Field label={tr('Số điện thoại *', 'Phone *')}><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={input} /></Field>
            {submitted && !form.phone && <ErrorText>Vui lòng nhập số điện thoại</ErrorText>}
            <Field label={tr('Email *', 'Email *')}><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} /></Field>
            {submitted && !form.email && <ErrorText>Vui lòng nhập email</ErrorText>}
            <Field label={tr('Website', 'Website')}><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={input} /></Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <ImageUpload value={form.logo_url} onChange={(logo_url) => setForm({ ...form, logo_url })} label={tr('Logo *', 'Logo *')} />
              {submitted && !form.logo_url && <ErrorText>Thiếu logo</ErrorText>}
              <ImageUpload value={form.cover_image_url} onChange={(cover_image_url) => setForm({ ...form, cover_image_url })} label={tr('Ảnh bìa *', 'Cover image *')} />
              {submitted && !form.cover_image_url && <ErrorText>Thiếu ảnh bìa</ErrorText>}
            </div>
          </div>
        )}

        {tab === 'ops' && (
          <div style={grid2}>
            {Object.keys(form.opening_hours).map((k) => (
              <Field key={k} label={`${tr('Giờ mở cửa', 'Opening hours')} - ${k}`}>
                <input
                  value={form.opening_hours[k]}
                  onChange={(e) => setForm({ ...form, opening_hours: { ...form.opening_hours, [k]: e.target.value } })}
                  style={input}
                />
              </Field>
            ))}
            <Field label={tr('Giá vé người lớn (VND)', 'Adult ticket (VND)')}>
              <input type="number" value={form.ticket_price.adult_vnd} onChange={(e) => setForm({ ...form, ticket_price: { ...form.ticket_price, adult_vnd: Number(e.target.value) } })} style={input} />
            </Field>
            <Field label={tr('Giá vé trẻ em (VND)', 'Child ticket (VND)')}>
              <input type="number" value={form.ticket_price.child_vnd} onChange={(e) => setForm({ ...form, ticket_price: { ...form.ticket_price, child_vnd: Number(e.target.value) } })} style={input} />
            </Field>
            <Field label={tr('Giá vé khách quốc tế (USD)', 'Foreign adult ticket (USD)')}>
              <input type="number" value={form.ticket_price.foreign_adult_usd} onChange={(e) => setForm({ ...form, ticket_price: { ...form.ticket_price, foreign_adult_usd: Number(e.target.value) } })} style={input} />
            </Field>
            <Field label={tr('Miễn phí cho', 'Free for')}>
              <input value={form.ticket_price.free_for} onChange={(e) => setForm({ ...form, ticket_price: { ...form.ticket_price, free_for: e.target.value } })} style={input} />
            </Field>
          </div>
        )}

        {tab === 'ai' && (
          <div>
            <Field label={tr('Ngôn ngữ hỗ trợ *', 'Supported languages *')}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {LANGS.map((lang) => {
                  const active = form.supported_languages.includes(lang)
                  return (
                    <button
                      key={lang}
                      onClick={() => {
                        const next = active
                          ? form.supported_languages.filter((x: string) => x !== lang)
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
            <Field label={tr('Ngôn ngữ mặc định', 'Default language')}>
              <select value={form.default_language} onChange={(e) => setForm({ ...form, default_language: e.target.value })} style={input}>
                {LANGS.map((lang) => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
              </select>
            </Field>
            <Field label={tr('Persona AI *', 'AI Persona *')}>
              <select value={form.ai_persona} onChange={(e) => setForm({ ...form, ai_persona: e.target.value })} style={input}>
                <option>Hướng dẫn viên thân thiện, am hiểu lịch sử</option>
                <option>Hướng dẫn viên chuyên nghiệp, súc tích</option>
                <option>Hướng dẫn viên học thuật, chuyên sâu</option>
              </select>
            </Field>
            <Field label={tr('Welcome message (VI)', 'Welcome message (VI)')}>
              <textarea value={form.welcome_message.vi} onChange={(e) => setForm({ ...form, welcome_message: { ...form.welcome_message, vi: e.target.value } })} style={{ ...input, minHeight: 80 }} />
            </Field>
            <Field label={tr('Welcome message (EN)', 'Welcome message (EN)')}>
              <textarea value={form.welcome_message.en} onChange={(e) => setForm({ ...form, welcome_message: { ...form.welcome_message, en: e.target.value } })} style={{ ...input, minHeight: 80 }} />
            </Field>
          </div>
        )}

        {tab === 'account' && (
          <div style={grid2}>
            <Field label={tr('Username museum admin *', 'Museum admin username *')}><input value={form.admin_username} onChange={(e) => setForm({ ...form, admin_username: e.target.value })} style={input} /></Field>
            {submitted && !form.admin_username && <ErrorText>{tr('Thiếu username admin', 'Missing admin username')}</ErrorText>}
            <Field label={tr('Password * (>=8)', 'Password * (>=8)')}><input value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} style={input} /></Field>
            {submitted && (!form.admin_password || form.admin_password.length < 8) && <ErrorText>{tr('Password tối thiểu 8 ký tự', 'Password must be at least 8 characters')}</ErrorText>}
            <Field label={tr('Email admin', 'Admin email')}><input value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} style={input} /></Field>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, gap: 10 }}>
        <div style={{ color: 'rgba(245,240,232,0.65)', fontSize: 12 }}>
          {completion.missing.length > 0 ? `${tr('Thiếu', 'Missing')}: ${completion.missing.join(', ')}` : tr('Đã đủ trường bắt buộc', 'All required fields are complete')}
        </div>
        <button onClick={onCreate} disabled={saving} style={btnPrimary}>
          {saving ? tr('Đang tạo...', 'Creating...') : tr('Tạo bảo tàng', 'Create museum')}
        </button>
      </div>

      {result && (
        <div style={{ ...card, marginTop: 16 }}>
          <div style={{ color: '#86efac', marginBottom: 8 }}>{tr('Đã tạo museum thành công', 'Museum created successfully')}</div>
          <div>Museum ID: {result.museum_id}</div>
          <div>Admin username: {result.admin_credentials?.username}</div>
          <div>Admin password: {result.admin_credentials?.password}</div>
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, children, onClick }: any) {
  return (
    <button onClick={onClick} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: active ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)', color: active ? '#C9A84C' : '#F5F0E8', cursor: 'pointer' }}>
      {children}
    </button>
  )
}

function Field({ label, children }: any) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.7)', marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  )
}
function ErrorText({ children }: any) {
  return <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 8 }}>{children}</div>
}

const card: any = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 14,
}
const grid2: any = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }
const input: any = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#F5F0E8', boxSizing: 'border-box' }
const btnPrimary: any = { padding: '10px 14px', borderRadius: 8, border: 'none', background: '#C9A84C', color: '#0A0A0A', cursor: 'pointer', fontWeight: 600 }
const btnGhost: any = { padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#F5F0E8', cursor: 'pointer' }
const chip: any = { padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }
