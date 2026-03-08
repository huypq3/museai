'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch, getAdminSession } from '@/lib/adminAuth'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { useAdminI18n } from '@/lib/i18n/admin'
import { FaQrcode, FaRegCopy, FaDownload } from 'react-icons/fa'

type MuseumRow = { id: string; name: string; address?: string; exhibit_count?: number; total_visits?: number; status?: string; logo_url?: string }

type Overview = {
  total_museums: number
  total_exhibits?: number
  total_events: number
  top_museums: { museum_id: string; name: string; count: number }[]
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const { t, locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [museums, setMuseums] = useState<MuseumRow[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [museumTab, setMuseumTab] = useState<'active' | 'inactive'>('active')
  const [qrOpenMuseumId, setQrOpenMuseumId] = useState<string | null>(null)
  const [museumQrMap, setMuseumQrMap] = useState<Record<string, { qr_data_url: string; qr_url: string }>>({})

  useEffect(() => {
    const s = getAdminSession()
    if (!s) {
      router.replace('/admin/login')
      return
    }
    if (s.role !== 'super_admin') {
      router.replace(s.museum_id ? `/admin/museum/${s.museum_id}` : '/admin/login')
      return
    }
    Promise.all([
      adminFetch('/admin/analytics/overview'),
      adminFetch('/admin/museums/'),
      adminFetch('/admin/users/'),
    ])
      .then(([ov, ms, us]) => {
        setOverview(ov)
        setMuseums(ms)
        setUsers(us?.users || [])
      })
      .catch(() => router.replace('/admin/login'))
  }, [router])

  const museumAdminName = (museumId: string) =>
    users.find((u) => u.role === 'museum_admin' && u.museum_id === museumId && (u.status || 'active') === 'active')?.username

  const filteredMuseums = museums.filter((m) => {
    const st = String(m.status || 'active').toLowerCase()
    return museumTab === 'active' ? st !== 'inactive' : st === 'inactive'
  })

  return (
    <div style={{ flex: 1, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#C9A84C' }}>{tr('Bảng điều khiển', 'Dashboard')}</div>
          <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {tr('Bảng điều khiển Super Admin', 'Super admin dashboard')}
          </div>
        </div>
        <div />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
        <Card title={tr('Bảo tàng', 'Museums')} value={overview?.total_museums ?? 0} />
        <Card title={tr('Hiện vật', 'Exhibits')} value={overview?.total_exhibits ?? 0} />
        <Card title={tr('Sự kiện', 'Events')} value={overview?.total_events ?? 0} />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
        <div style={{ marginBottom: 12, color: '#F5F0E8', fontWeight: 600 }}>{tr('Top bảo tàng', 'Top Museums')}</div>
        <div style={{ width: '100%', minHeight: 260, height: 260, marginBottom: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overview?.top_museums || []} margin={{ top: 8, right: 8, left: -10, bottom: 16 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(245,240,232,0.65)" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={48} />
              <YAxis allowDecimals={false} width={34} stroke="rgba(245,240,232,0.65)" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#C9A84C" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {(overview?.top_museums || []).map((m) => (
          <div key={m.museum_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span>{m.name}</span>
            <span style={{ color: '#C9A84C' }}>{m.count}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
        <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ color: '#F5F0E8', fontWeight: 600 }}>{tr('Danh sách bảo tàng', 'Museum list')}</div><div style={{ display: 'flex', gap: 8 }}><button style={{ ...btnGhost, background: museumTab === 'active' ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)', color: museumTab === 'active' ? '#C9A84C' : '#F5F0E8' }} onClick={() => setMuseumTab('active')}>{tr('Active', 'Active')}</button><button style={{ ...btnGhost, background: museumTab === 'inactive' ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)', color: museumTab === 'inactive' ? '#C9A84C' : '#F5F0E8' }} onClick={() => setMuseumTab('inactive')}>{tr('Inactive', 'Inactive')}</button></div></div>
        <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 2fr 1fr 1fr 2fr 1fr 2fr', gap: 8, fontSize: 12, opacity: 0.65, paddingBottom: 8 }}>
          <span>{tr('Tên', 'Name')}</span><span>{tr('Địa chỉ', 'Address')}</span><span>{tr('Hiện vật', 'Exhibits')}</span><span>{tr('Lượt xem', 'Visits')}</span><span>Admin</span><span>Status</span><span>{tr('Hành động', 'Actions')}</span>
        </div>
        {filteredMuseums.map((m) => (
          <div key={m.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 2fr 1fr 1fr 2fr 1fr 2fr', gap: 8, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><img src={m.logo_url || ''} alt={m.name} style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', background: 'rgba(255,255,255,0.08)' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /><strong style={{ fontWeight: 500 }}>{m.name}</strong></span>
              <span style={{ fontSize: 12, opacity: 0.75 }}>{m.address || '-'}</span>
              <span>{m.exhibit_count || 0}</span>
              <span>{m.total_visits || 0}</span>
              <span>{museumAdminName(m.id) ? `${museumAdminName(m.id)} ●` : <button style={btnGhost} onClick={() => router.push(`/admin/users?museum_id=${m.id}`)}>+ {tr('Tạo admin', 'Create admin')}</button>}</span>
              <span>{m.status || 'active'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={btnGhost} title="Edit" onClick={() => router.push(`/admin/museums/${m.id}`)}>✏️</button>
                <button style={btnGhost} title="Analytics" onClick={() => router.push(`/admin/analytics?museum_id=${m.id}`)}>📊</button>
                <button
                  style={btnGhost}
                  title="QR"
                  onClick={async () => {
                    if (qrOpenMuseumId === m.id) {
                      setQrOpenMuseumId(null)
                      return
                    }
                    if (!museumQrMap[m.id]) {
                      const qrRes = await adminFetch(`/admin/qr/museum/${m.id}`)
                      setMuseumQrMap((prev) => ({ ...prev, [m.id]: qrRes?.museum_qr }))
                    }
                    setQrOpenMuseumId(m.id)
                  }}
                >
                  <FaQrcode size={14} />
                </button>
              </div>
            </div>
            {qrOpenMuseumId === m.id && museumQrMap[m.id] && (
              <div style={{ marginTop: 10, marginLeft: 6, padding: 10, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, background: 'rgba(255,255,255,0.03)', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <img src={museumQrMap[m.id].qr_data_url} alt={`Museum QR ${m.name}`} style={{ width: 96, height: 96 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <a href={museumQrMap[m.id].qr_data_url} download={`museum-${m.id}.png`} style={{ ...btnGhost, textDecoration: 'none', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><FaDownload size={12} /> PNG</a>
                  <button style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => navigator.clipboard.writeText(museumQrMap[m.id].qr_url)}><FaRegCopy size={12} /> {tr('Sao chép', 'Copy')}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.6)' }}>{title}</div>
      <div style={{ fontSize: 28, color: '#C9A84C', fontWeight: 700 }}>{value}</div>
    </div>
  )
}

const btnGhost: any = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  color: '#F5F0E8',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
}
