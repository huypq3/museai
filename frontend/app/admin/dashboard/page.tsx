'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch, getAdminSession } from '@/lib/adminAuth'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { useAdminI18n } from '@/lib/adminI18n'

type Overview = {
  total_museums: number
  total_artifacts: number
  total_events: number
  top_museums: { museum_id: string; name: string; count: number }[]
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const { t, locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [museums, setMuseums] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

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

  return (
    <div style={{ flex: 1, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: '#C9A84C', fontFamily: 'Cormorant Garamond, serif' }}>Super Admin {t('dashboard')}</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => router.push('/admin/museums/new')} style={btnGhost}>+ {tr('Bảo tàng', 'Museum')}</button>
          <button onClick={() => router.push('/admin/users')} style={btnGhost}>+ {tr('Tài khoản', 'User')}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
        <Card title={tr('Bảo tàng', 'Museums')} value={overview?.total_museums ?? 0} />
        <Card title={tr('Hiện vật', 'Artifacts')} value={overview?.total_artifacts ?? 0} />
        <Card title={tr('Sự kiện', 'Events')} value={overview?.total_events ?? 0} />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
        <div style={{ marginBottom: 12, color: '#F5F0E8', fontWeight: 600 }}>{tr('Top bảo tàng', 'Top Museums')}</div>
        <div style={{ width: '100%', height: 220, marginBottom: 10 }}>
          <ResponsiveContainer>
            <BarChart data={overview?.top_museums || []}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" stroke="rgba(245,240,232,0.65)" />
              <YAxis stroke="rgba(245,240,232,0.65)" />
              <Tooltip />
              <Bar dataKey="count" fill="#C9A84C" radius={[6, 6, 0, 0]} />
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
        <div style={{ marginBottom: 10, color: '#F5F0E8', fontWeight: 600 }}>{tr('Danh sách bảo tàng', 'Museum list')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 2fr 1fr 2fr', gap: 8, fontSize: 12, opacity: 0.65, paddingBottom: 8 }}>
          <span>{tr('Tên', 'Name')}</span><span>{tr('Địa chỉ', 'Address')}</span><span>{tr('Hiện vật', 'Artifacts')}</span><span>{tr('Lượt xem', 'Visits')}</span><span>Admin</span><span>Status</span><span>{tr('Hành động', 'Actions')}</span>
        </div>
        {museums.map((m) => (
          <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 2fr 1fr 2fr', gap: 8, alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 0' }}>
            <span>{m.name}</span>
            <span style={{ fontSize: 12, opacity: 0.75 }}>{m.address || '-'}</span>
            <span>{m.artifact_count || 0}</span>
            <span>{m.total_visits || 0}</span>
            <span>{museumAdminName(m.id) ? `${museumAdminName(m.id)} ●` : <button style={btnGhost} onClick={() => router.push(`/admin/users?museum_id=${m.id}`)}>+ {tr('Tạo admin', 'Create admin')}</button>}</span>
            <span>{m.status || 'active'}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={btnGhost} onClick={() => router.push(`/admin/museum/${m.id}`)}>Edit</button>
              <button style={btnGhost} onClick={() => router.push(`/admin/analytics?museum_id=${m.id}`)}>Analytics</button>
              <button style={btnGhost} onClick={() => router.push(`/admin/qr?museum_id=${m.id}`)}>QR</button>
            </div>
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
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  color: '#F5F0E8',
  cursor: 'pointer',
}
