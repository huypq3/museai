'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminDownload, adminFetch, getAdminSession } from '@/lib/adminAuth'
import { useAdminI18n } from '@/lib/i18n/admin'

export default function QRManagementPage() {
  const router = useRouter()
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)
  const [museumFromQuery, setMuseumFromQuery] = useState<string | null>(null)
  const session = useMemo(() => getAdminSession(), [])
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      setMuseumFromQuery(params.get('museum_id'))
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      if (!session) {
        router.replace('/admin/login')
        return
      }

      try {
        setLoading(true)
        setError('')
        const museumId = session.role === 'museum_admin' ? session.museum_id : museumFromQuery

        // QR phải gắn theo museum cụ thể.
        if (!museumId && session.role === 'super_admin') {
          router.replace('/admin/museums')
          return
        }

        if (!museumId) {
          setError(tr('Thiếu museum_id.', 'Missing museum_id.'))
          setData(null)
          return
        }

        const qrData = await adminFetch(`/admin/qr/museum/${museumId}`)
        setData(qrData)
      } catch (e: any) {
        const msg = typeof e?.message === 'string' ? e.message : ''
        if (msg.includes('Unauthorized')) {
          router.replace('/admin/login')
          return
        }
        setError(msg || tr('Không tải được QR.', 'Failed to load QR.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [museumFromQuery, router, session])

  if (loading) return <div style={{ flex: 1, padding: 24 }}>{tr('Đang tải...', 'Loading...')}</div>
  if (error) return <div style={{ flex: 1, padding: 24, color: '#fca5a5' }}>{error}</div>
  if (!data) return <div style={{ flex: 1, padding: 24 }}>{tr('Không có dữ liệu QR.', 'No QR data available.')}</div>

  return (
    <div style={{ flex: 1, padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#C9A84C' }}>QR Codes</div>
        <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>QR Codes</div>
      </div>
      <div style={card}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>{tr('QR bảo tàng', 'Museum QR')}</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <img src={data.museum_qr.qr_data_url} style={{ width: 180, height: 180 }} />
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8, marginBottom: 8 }}>{data.museum_qr.qr_url}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={data.museum_qr.qr_data_url} download={`museum-${data.museum_id}.png`} style={btnLink}>{tr('Tải PNG', 'Download PNG')}</a>
              <button onClick={() => navigator.clipboard.writeText(data.museum_qr.qr_url)} style={btn}>{tr('Sao chép link', 'Copy link')}</button>
              <button onClick={() => adminDownload(`/admin/qr/museum/${data.museum_id}/zip`, `qr-${data.museum_id}.zip`).catch((e) => alert(e?.message || 'Download failed'))} style={btnPrimary}>{tr('Tải ZIP', 'Download ZIP')}</button>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {data.exhibits.map((a: any) => (
          <div key={a.exhibit_id} style={card}>
            <div style={{ marginBottom: 8 }}>{a.name}</div>
            <img src={a.qr_data_url} style={{ width: 160, height: 160 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <a href={a.qr_data_url} download={`${a.exhibit_id}.png`} style={btnLink}>↓ PNG</a>
              <button onClick={() => navigator.clipboard.writeText(a.qr_url)} style={btn}>📋 {tr('Sao chép', 'Copy')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const card: any = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
}
const btn: any = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  color: '#F5F0E8',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
}
const btnPrimary: any = {
  ...btn,
  background: '#C9A84C',
  color: '#0A0A0A',
  border: 'none',
  fontWeight: 600,
}
const btnLink: any = { ...btn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }
