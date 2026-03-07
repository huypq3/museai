'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch, getAdminSession } from '@/lib/adminAuth'
import { DailyVisitsChart, HeatmapBars, LanguagePie } from '@/components/admin/Charts'
import { useAdminI18n } from '@/lib/i18n/admin'

export default function AnalyticsPage() {
  const router = useRouter()
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)
  const [museumFromQuery, setMuseumFromQuery] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)
  const session = useMemo(() => getAdminSession(), [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      setMuseumFromQuery(params.get('museum_id'))
    }
  }, [])

  useEffect(() => {
    if (!session) return router.replace('/admin/login')
    const museumId = session.role === 'museum_admin' ? session.museum_id : museumFromQuery
    const path = museumId ? `/admin/analytics/museum/${museumId}` : '/admin/analytics/overview'
    adminFetch(path).then(setData).catch(() => router.replace('/admin/login'))
  }, [museumFromQuery, router, session])

  return (
    <div style={{ flex: 1, padding: 28 }}>
      <h1 style={{ marginTop: 0, color: '#C9A84C', fontFamily: 'Cormorant Garamond, serif' }}>Analytics</h1>
      {!data ? <p>{tr('Đang tải...', 'Loading...')}</p> : (
        <>
          {'daily_visits' in data && (
            <div style={card}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>{tr('Lượt truy cập theo ngày (7 ngày)', 'Daily visits (7 days)')}</div>
              <DailyVisitsChart data={data.daily_visits || []} />
            </div>
          )}
          {'top_museums' in data && (
            <div style={card}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>{tr('Top bảo tàng', 'Top museums')}</div>
              {data.top_museums.map((m: any) => (
                <div key={m.museum_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{m.name}</span><span>{m.count}</span>
                </div>
              ))}
            </div>
          )}
          {'heatmap' in data && (
            <div style={card}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>{tr('Heatmap (hiện vật)', 'Heatmap (artifacts)')}</div>
              <HeatmapBars data={data.heatmap || []} />
            </div>
          )}
          {'language_distribution' in data && (
            <div style={card}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>{tr('Phân bố ngôn ngữ', 'Language distribution')}</div>
              <LanguagePie data={data.language_distribution || []} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

const card: any = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 16,
  marginBottom: 14,
}
