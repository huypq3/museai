'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { adminFetch, getAdminSession, clearAdminToken } from '@/lib/adminAuth'
import { useAdminI18n } from '@/lib/i18n/admin'

type Tab = 'artifacts' | 'analytics' | 'qr' | 'settings'

export default function MuseumAdminHome() {
  const params = useParams()
  const router = useRouter()
  const museumId = params.id as string
  const session = useMemo(() => getAdminSession(), [])
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)
  const [tab, setTab] = useState<Tab>('artifacts')
  const [museum, setMuseum] = useState<any>(null)
  const [artifacts, setArtifacts] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [qrData, setQrData] = useState<any>(null)
  const [password, setPassword] = useState('')

  const loadAll = async () => {
    const [m, a] = await Promise.all([
      adminFetch(`/admin/museums/${museumId}`),
      adminFetch(`/admin/exhibits?museum_id=${museumId}`),
    ])
    setMuseum(m)
    setArtifacts(a)
  }

  useEffect(() => {
    if (!session) return router.replace('/admin/login')
    if (session.role === 'museum_admin' && session.museum_id !== museumId) {
      return router.replace(`/admin/museum/${session.museum_id}`)
    }
    loadAll().catch(() => router.replace('/admin/login'))
  }, [museumId, router, session])

  useEffect(() => {
    if (tab === 'analytics') {
      adminFetch(`/admin/analytics/museum/${museumId}`).then(setAnalytics).catch(() => {})
    }
    if (tab === 'qr') {
      adminFetch(`/admin/qr/museum/${museumId}`).then(setQrData).catch(() => {})
    }
  }, [museumId, tab])

  return (
    <div style={{ flex: 1, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, color: '#C9A84C', fontFamily: 'Cormorant Garamond, serif' }}>{museum?.name || museumId}</h1>
          <div style={{ color: 'rgba(245,240,232,0.65)', fontSize: 13 }}>{museum?.address || ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/admin/museums')} style={btn}>{tr('Bảo tàng', 'Museums')}</button>
          <button onClick={() => { clearAdminToken(); router.push('/admin/login') }} style={btn}>{tr('Đăng xuất', 'Logout')}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
        <Stat title={tr('Hiện vật', 'Artifacts')} value={artifacts.length} />
        <Stat title={tr('Lượt QR', 'QR visits')} value={museum?.total_visits || 0} />
        <Stat title={tr('Ngôn ngữ', 'Languages')} value={(museum?.supported_languages || []).length} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <TabBtn active={tab === 'artifacts'} onClick={() => setTab('artifacts')}>{tr('Hiện vật', 'Artifacts')}</TabBtn>
        <TabBtn active={tab === 'analytics'} onClick={() => setTab('analytics')}>Analytics</TabBtn>
        <TabBtn active={tab === 'qr'} onClick={() => setTab('qr')}>QR Codes</TabBtn>
        <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')}>{tr('Cài đặt', 'Settings')}</TabBtn>
      </div>

      {tab === 'artifacts' && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>{tr('Danh sách hiện vật', 'Artifact list')}</div>
            <button onClick={() => router.push(`/admin/exhibits/new?museum=${museumId}`)} style={btnPrimary}>+ {tr('Thêm hiện vật', 'Add exhibit')}</button>
          </div>
          {artifacts.map((a) => (
            <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto auto', gap: 10, alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 0' }}>
              <img src={a.primary_image_url || a.image_url || ''} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, background: '#111' }} />
              <div>
                <div>{a.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.65)' }}>{typeof a.location === 'object' ? a.location?.hall : a.location || '-'}</div>
              </div>
              <div style={{ fontSize: 12, color: '#C9A84C' }}>Scans: {a.total_scans || 0}</div>
              <button onClick={() => router.push(`/admin/exhibits/${a.id}`)} style={btn}>{tr('Sửa', 'Edit')}</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'analytics' && (
        <div style={card}>
          {!analytics ? <div>{tr('Đang tải analytics...', 'Loading analytics...')}</div> : (
            <>
              <SectionTitle>{tr('Lượt quét QR (7 ngày)', 'QR scans (7 days)')}</SectionTitle>
              {(analytics.daily_visits || []).map((d: any) => (
                <div key={d.date} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 40px', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>{d.date}</span>
                  <div style={{ background: 'rgba(255,255,255,0.08)', height: 8, borderRadius: 8 }}>
                    <div style={{ width: `${Math.min(100, (d.count || 0) * 10)}%`, height: '100%', borderRadius: 8, background: '#C9A84C' }} />
                  </div>
                  <span style={{ fontSize: 12 }}>{d.count}</span>
                </div>
              ))}
              <SectionTitle>{tr('Heatmap hiện vật', 'Artifact heatmap')}</SectionTitle>
              {(analytics.heatmap || []).map((h: any, idx: number) => (
                <div key={h.artifact_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <span>{idx + 1}. {h.artifact_id}</span>
                  <span style={{ color: '#C9A84C' }}>{h.scan_count}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'qr' && (
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
                    <button onClick={() => window.open(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/qr/museum/${museumId}/zip`, '_blank')} style={btnPrimary}>Download ZIP</button>
                  </div>
                </div>
              </div>
              <SectionTitle>{tr('QR từng hiện vật', 'Artifact QR codes')}</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
                {qrData.artifacts.map((a: any) => (
                  <div key={a.artifact_id} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 10 }}>
                    <img src={a.qr_data_url} style={{ width: 120, height: 120 }} />
                    <div style={{ fontSize: 13, margin: '6px 0' }}>{a.name}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a href={a.qr_data_url} download={`${a.artifact_id}.png`} style={btnLink}>↓ PNG</a>
                      <button onClick={() => navigator.clipboard.writeText(a.qr_url)} style={btn}>📋</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div style={card}>
          <SectionTitle>{tr('Thông tin bảo tàng (readonly cho museum admin)', 'Museum info (readonly for museum admin)')}</SectionTitle>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>{museum?.name} - {museum?.address}</div>
          <SectionTitle>{tr('Cấu hình AI', 'AI config')}</SectionTitle>
          <input value={museum?.ai_persona || ''} readOnly style={input} />
          <SectionTitle>{tr('Đổi mật khẩu', 'Change password')}</SectionTitle>
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tr('Mật khẩu mới (min 8)', 'New password (min 8)')} style={input} />
          <button
            onClick={async () => {
              if (password.length < 8) return alert(tr('Mật khẩu phải >= 8 ký tự', 'Password must be >= 8 chars'))
              await adminFetch('/admin/auth/change-password', { method: 'POST', body: JSON.stringify({ password }) }).catch(() => {})
              alert(tr('Đã gửi yêu cầu đổi mật khẩu', 'Password change request sent'))
            }}
            style={btnPrimary}
          >
            {tr('Đổi mật khẩu', 'Change password')}
          </button>
        </div>
      )}
    </div>
  )
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
      <div style={{ color: 'rgba(245,240,232,0.6)', fontSize: 12 }}>{title}</div>
      <div style={{ color: '#C9A84C', fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: any) {
  return <button onClick={onClick} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: active ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)', color: active ? '#C9A84C' : '#F5F0E8', cursor: 'pointer' }}>{children}</button>
}
function SectionTitle({ children }: any) {
  return <div style={{ margin: '12px 0 8px', fontWeight: 600 }}>{children}</div>
}

const card: any = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14 }
const btn: any = { padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#F5F0E8', cursor: 'pointer' }
const btnPrimary: any = { ...btn, background: '#C9A84C', color: '#0A0A0A', border: 'none', fontWeight: 600 }
const btnLink: any = { ...btn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }
const input: any = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#F5F0E8', boxSizing: 'border-box', marginBottom: 8 }
