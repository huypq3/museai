'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { FaEdit, FaPowerOff, FaQrcode, FaTrash } from 'react-icons/fa'
import { adminDownload, adminFetch, getAdminSession } from '@/lib/adminAuth'
import { useAdminI18n } from '@/lib/i18n/admin'

type MuseumTab = 'exhibits' | 'qr' | 'settings'
type SettingsTab = 'ai' | 'password'

type ExhibitRecord = {
  id: string
  name: string
  image_url?: string
  primary_image_url?: string
  location?: { hall?: string } | string
  status?: 'published' | 'draft'
  total_scans?: number
  created_at?: unknown
  updated_at?: unknown
}

type MuseumRecord = {
  id: string
  name?: string
  address?: string
  total_visits?: number
  supported_languages?: string[]
  ai_persona?: string
  welcome_message?: Record<string, string>
  default_language?: string
}

type QrPayload = {
  museum_qr: { qr_data_url: string; qr_url: string }
  exhibits: Array<{ exhibit_id: string; name: string; qr_data_url: string; qr_url: string }>
}

export default function MuseumAdminHome() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const museumId = params.id as string
  const session = useMemo(() => getAdminSession(), [])
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)

  const currentTab = (searchParams.get('tab') as MuseumTab | null) || 'exhibits'
  const currentSettingsTab = (searchParams.get('settingsTab') as SettingsTab | null) || 'ai'

  const [museum, setMuseum] = useState<MuseumRecord | null>(null)
  const [exhibits, setExhibits] = useState<ExhibitRecord[]>([])
  const [qrData, setQrData] = useState<QrPayload | null>(null)
  const [password, setPassword] = useState('')
  const [aiPersona, setAiPersona] = useState('')
  const [welcomeEn, setWelcomeEn] = useState('')
  const [welcomeVi, setWelcomeVi] = useState('')
  const [defaultLanguage, setDefaultLanguage] = useState('vi')
  const [savingAi, setSavingAi] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  function setTab(tab: MuseumTab, settingsTab?: SettingsTab) {
    const next = new URLSearchParams(searchParams.toString())
    next.set('tab', tab)
    if (tab === 'settings') {
      next.set('settingsTab', settingsTab || currentSettingsTab)
    } else {
      next.delete('settingsTab')
    }
    router.replace(`/admin/museum/${museumId}?${next.toString()}`)
  }

  function setSettingsTab(tab: SettingsTab) {
    const next = new URLSearchParams(searchParams.toString())
    next.set('tab', 'settings')
    next.set('settingsTab', tab)
    router.replace(`/admin/museum/${museumId}?${next.toString()}`)
  }

  async function loadMuseumAndExhibits() {
    const [m, a] = await Promise.all([
      adminFetch(`/admin/museums/${museumId}`),
      adminFetch(`/admin/exhibits?museum_id=${museumId}`),
    ])
    setMuseum(m)
    setAiPersona(m?.ai_persona || '')
    setWelcomeEn(m?.welcome_message?.en || '')
    setWelcomeVi(m?.welcome_message?.vi || '')
    setDefaultLanguage(m?.default_language || 'vi')
    setExhibits(a)
  }

  useEffect(() => {
    if (!session) {
      router.replace('/admin/login')
      return
    }
    if (session.role === 'museum_admin' && session.museum_id !== museumId) {
      router.replace(`/admin/museum/${session.museum_id}`)
      return
    }
    loadMuseumAndExhibits().catch(() => router.replace('/admin/login'))
  }, [museumId, router, session])

  useEffect(() => {
    if (currentTab === 'qr') {
      adminFetch(`/admin/qr/museum/${museumId}`).then(setQrData).catch(() => {})
    }
  }, [currentTab, museumId])

  async function toggleExhibitStatus(exhibit: ExhibitRecord) {
    const nextStatus = exhibit.status === 'published' ? 'draft' : 'published'
    await adminFetch(`/admin/exhibits/${exhibit.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: nextStatus }),
    })
    await loadMuseumAndExhibits()
  }

  async function deleteExhibit(exhibitId: string) {
    if (!confirm(tr('Xóa hiện vật này?', 'Delete this exhibit?'))) return
    await adminFetch(`/admin/exhibits/${exhibitId}`, { method: 'DELETE' })
    await loadMuseumAndExhibits()
  }

  async function saveAiConfig() {
    setSavingAi(true)
    try {
      await adminFetch(`/admin/museums/${museumId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ai_persona: aiPersona,
          welcome_message: { vi: welcomeVi, en: welcomeEn },
          default_language: defaultLanguage,
        }),
      })
      alert(tr('Đã lưu AI config', 'AI config saved'))
      await loadMuseumAndExhibits()
    } catch (error: any) {
      alert(error?.message || tr('Lưu thất bại', 'Save failed'))
    } finally {
      setSavingAi(false)
    }
  }

  async function changePassword() {
    if (password.length < 8) {
      alert(tr('Mật khẩu phải có ít nhất 8 ký tự', 'Password must be at least 8 characters'))
      return
    }
    setSavingPassword(true)
    try {
      await adminFetch('/admin/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      setPassword('')
      alert(tr('Đổi mật khẩu thành công', 'Password changed successfully'))
    } catch (error: any) {
      alert(error?.message || tr('Đổi mật khẩu thất bại', 'Password change failed'))
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div style={{ flex: 1, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#C9A84C' }}>{museum?.name || museumId}</div>
          <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {museum?.name || museumId}
          </div>
          <div style={{ color: 'rgba(245,240,232,0.65)', fontSize: 13, marginTop: 6 }}>{museum?.address || ''}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
        <Stat title={tr('Hiện vật', 'Exhibits')} value={exhibits.length} />
        <Stat title={tr('Lượt QR', 'QR visits')} value={museum?.total_visits || 0} />
        <Stat title={tr('Ngôn ngữ', 'Languages')} value={(museum?.supported_languages || []).length} />
      </div>

      {currentTab !== 'settings' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <TabBtn active={currentTab === 'exhibits'} onClick={() => setTab('exhibits')}>{tr('Hiện vật', 'Exhibits')}</TabBtn>
          <TabBtn active={currentTab === 'qr'} onClick={() => setTab('qr')}>QR Codes</TabBtn>
        </div>
      )}

      {currentTab === 'exhibits' && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>{tr('Danh sách hiện vật', 'Exhibit list')}</div>
            <button onClick={() => router.push(`/admin/exhibits/new?museum=${museumId}`)} style={btnPrimary}>+ {tr('Thêm hiện vật', 'Add exhibit')}</button>
          </div>

          <div style={tableHeader}>
            <div>{tr('Exhibit', 'Exhibit')}</div>
            <div>{tr('Trạng thái', 'Status')}</div>
            <div>{tr('Lượt quét', 'Scans')}</div>
            <div>{tr('Ngày tạo', 'Created')}</div>
            <div>{tr('Cập nhật', 'Updated')}</div>
            <div style={{ textAlign: 'right' }}>{tr('Hành động', 'Actions')}</div>
          </div>

          {exhibits.map((exhibit) => (
            <div key={exhibit.id} style={tableRow}>
              <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12, alignItems: 'center' }}>
                <img
                  src={exhibit.primary_image_url || exhibit.image_url || ''}
                  alt={exhibit.name}
                  style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, background: '#111' }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>{exhibit.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.65)' }}>
                    {typeof exhibit.location === 'object' ? exhibit.location?.hall : exhibit.location || '-'}
                  </div>
                </div>
              </div>
              <div>
                <span style={statusPill(exhibit.status === 'published')}>
                  {exhibit.status === 'published' ? tr('Active', 'Active') : tr('Inactive', 'Inactive')}
                </span>
              </div>
              <div style={{ color: '#C9A84C', fontSize: 13 }}>{exhibit.total_scans || 0}</div>
              <div style={mutedCell}>{formatDate(exhibit.created_at)}</div>
              <div style={mutedCell}>{formatDate(exhibit.updated_at)}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <IconButton title={tr('Sửa', 'Edit')} onClick={() => router.push(`/admin/exhibits/${exhibit.id}`)}><FaEdit size={14} /></IconButton>
                <IconButton
                  title={exhibit.status === 'published' ? tr('Chuyển sang inactive', 'Set inactive') : tr('Chuyển sang active', 'Set active')}
                  onClick={() => toggleExhibitStatus(exhibit)}
                >
                  <FaPowerOff size={14} />
                </IconButton>
                <IconButton title="QR Code" onClick={() => router.push(`/admin/exhibits/${exhibit.id}/qr`)}>
                  <FaQrcode size={14} />
                </IconButton>
                <IconButton title={tr('Xóa', 'Delete')} danger onClick={() => deleteExhibit(exhibit.id)}>
                  <FaTrash size={14} />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {currentTab === 'qr' && (
        <div style={card}>
          {!qrData ? <div>{tr('Đang tải QR...', 'Loading QR...')}</div> : (
            <>
              <SectionTitle>{tr('QR bảo tàng', 'Museum QR')}</SectionTitle>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
                <img src={qrData.museum_qr.qr_data_url} style={{ width: 140, height: 140 }} />
                <div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{qrData.museum_qr.qr_url}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={qrData.museum_qr.qr_data_url} download={`museum-${museumId}.png`} style={btnLink}>{tr('Tải PNG', 'Download PNG')}</a>
                    <button onClick={() => navigator.clipboard.writeText(qrData.museum_qr.qr_url)} style={btn}>{tr('Sao chép link', 'Copy link')}</button>
                    <button onClick={() => adminDownload(`/admin/qr/museum/${museumId}/zip`, `qr-${museumId}.zip`).catch((e) => alert(e?.message || 'Download failed'))} style={btnPrimary}>Download ZIP</button>
                  </div>
                </div>
              </div>
              <SectionTitle>{tr('QR từng hiện vật', 'Exhibit QR codes')}</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
                {qrData.exhibits.map((exhibit) => (
                  <div key={exhibit.exhibit_id} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 10 }}>
                    <img src={exhibit.qr_data_url} style={{ width: 120, height: 120 }} />
                    <div style={{ fontSize: 13, margin: '6px 0' }}>{exhibit.name}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a href={exhibit.qr_data_url} download={`${exhibit.exhibit_id}.png`} style={btnLink}>↓ PNG</a>
                      <button onClick={() => navigator.clipboard.writeText(exhibit.qr_url)} style={btn}>QR</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {currentTab === 'settings' && (
        <div style={card}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <TabBtn active={currentSettingsTab === 'ai'} onClick={() => setSettingsTab('ai')}>{tr('AI config', 'AI config')}</TabBtn>
            <TabBtn active={currentSettingsTab === 'password'} onClick={() => setSettingsTab('password')}>{tr('Đổi mật khẩu', 'Change password')}</TabBtn>
          </div>

          {currentSettingsTab === 'ai' && (
            <div style={{ display: 'grid', gap: 12 }}>
              <SectionTitle>{tr('Cấu hình AI cho bảo tàng của bạn', 'AI configuration for your museum')}</SectionTitle>
              <label style={labelStyle}>{tr('AI Persona', 'AI Persona')}</label>
              <textarea value={aiPersona} onChange={(e) => setAiPersona(e.target.value)} style={{ ...input, minHeight: 120, resize: 'vertical' }} />

              <label style={labelStyle}>{tr('Lời chào tiếng Việt', 'Vietnamese welcome message')}</label>
              <textarea value={welcomeVi} onChange={(e) => setWelcomeVi(e.target.value)} style={{ ...input, minHeight: 90, resize: 'vertical' }} />

              <label style={labelStyle}>{tr('Lời chào tiếng Anh', 'English welcome message')}</label>
              <textarea value={welcomeEn} onChange={(e) => setWelcomeEn(e.target.value)} style={{ ...input, minHeight: 90, resize: 'vertical' }} />

              <label style={labelStyle}>{tr('Ngôn ngữ mặc định', 'Default language')}</label>
              <select value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)} style={input}>
                <option value="vi">Vietnamese</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="zh">Chinese</option>
              </select>

              <div>
                <button onClick={saveAiConfig} disabled={savingAi} style={btnPrimary}>
                  {savingAi ? tr('Đang lưu...', 'Saving...') : tr('Lưu AI config', 'Save AI config')}
                </button>
              </div>
            </div>
          )}

          {currentSettingsTab === 'password' && (
            <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
              <SectionTitle>{tr('Đổi mật khẩu tài khoản', 'Change account password')}</SectionTitle>
              <label style={labelStyle}>{tr('Mật khẩu mới', 'New password')}</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tr('Ít nhất 8 ký tự, có chữ hoa và số', 'At least 8 chars, with uppercase and number')}
                style={input}
                type="password"
              />
              <div>
                <button onClick={changePassword} disabled={savingPassword} style={btnPrimary}>
                  {savingPassword ? tr('Đang cập nhật...', 'Updating...') : tr('Đổi mật khẩu', 'Change password')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatDate(value: unknown): string {
  if (!value) return '-'
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
  }
  if (typeof value === 'object' && value !== null) {
    const maybeSeconds = (value as { seconds?: number }).seconds
    if (typeof maybeSeconds === 'number') {
      return new Date(maybeSeconds * 1000).toLocaleString()
    }
    const maybeIso = (value as { _seconds?: number })._seconds
    if (typeof maybeIso === 'number') {
      return new Date(maybeIso * 1000).toLocaleString()
    }
    const maybeDate = value as { toDate?: () => Date }
    if (typeof maybeDate.toDate === 'function') {
      return maybeDate.toDate().toLocaleString()
    }
  }
  return '-'
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
      <div style={{ color: 'rgba(245,240,232,0.6)', fontSize: 12 }}>{title}</div>
      <div style={{ color: '#C9A84C', fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: active ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)', color: active ? '#C9A84C' : '#F5F0E8', cursor: 'pointer' }}>{children}</button>
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={{ margin: '12px 0 8px', fontWeight: 600 }}>{children}</div>
}

function IconButton({
  children,
  title,
  onClick,
  danger = false,
}: {
  children: ReactNode
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        border: `1px solid ${danger ? 'rgba(248,113,113,0.28)' : 'rgba(255,255,255,0.14)'}`,
        background: danger ? 'rgba(127,29,29,0.3)' : 'rgba(255,255,255,0.04)',
        color: danger ? '#fca5a5' : '#F5F0E8',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

function statusPill(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    color: active ? '#86efac' : '#fcd34d',
    border: `1px solid ${active ? 'rgba(134,239,172,0.28)' : 'rgba(252,211,77,0.28)'}`,
    background: active ? 'rgba(22,101,52,0.18)' : 'rgba(133,77,14,0.18)',
  }
}

const card: CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14 }
const btn: CSSProperties = { padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#F5F0E8', fontSize: 14, fontWeight: 500, cursor: 'pointer' }
const btnPrimary: CSSProperties = { ...btn, background: '#C9A84C', color: '#0A0A0A', border: 'none', fontWeight: 600 }
const btnLink: CSSProperties = { ...btn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#F5F0E8', boxSizing: 'border-box' }
const labelStyle: CSSProperties = { fontSize: 12, color: 'rgba(245,240,232,0.68)', letterSpacing: '0.08em', textTransform: 'uppercase' }
const tableHeader: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(280px,2fr) 110px 80px 150px 150px 180px', gap: 10, padding: '0 0 10px', color: 'rgba(245,240,232,0.55)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }
const tableRow: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(280px,2fr) 110px 80px 150px 150px 180px', gap: 10, alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 0' }
const mutedCell: CSSProperties = { fontSize: 12, color: 'rgba(245,240,232,0.65)' }
