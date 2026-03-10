'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch, getAdminSession } from '@/lib/adminAuth'
import { useAdminI18n } from '@/lib/i18n/admin'

type UserAgentParsed = {
  browser: string
  os: string
  device_type: string
}

type RequestLogEntry = {
  id: string
  timestamp: string
  ip: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | string
  path: string
  status_code: number
  duration_ms: number
  user_agent: string
  user_agent_parsed: UserAgentParsed
  api_category: string
  is_blocked: boolean
  museum_id?: string | null
  exhibit_id?: string | null
}

type LogsResponse = {
  items: RequestLogEntry[]
  page: number
  page_size: number
  total: number
  total_pages: number
  has_prev: boolean
  has_next: boolean
}

type StatsResponse = {
  total_requests_24h: number
  blocked_requests_24h: number
  avg_response_time_ms_24h: number
  unique_ips_24h: number
}

const METHOD_OPTIONS = ['ALL', 'GET', 'POST', 'PUT', 'DELETE'] as const
const STATUS_OPTIONS = ['ALL', '2xx', '3xx', '4xx', '5xx'] as const
const CATEGORY_OPTIONS = ['ALL', 'auth', 'exhibit', 'museum', 'vision', 'websocket', 'session', 'admin', 'other'] as const

export default function AdminLogsPage() {
  const router = useRouter()
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)

  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [logsData, setLogsData] = useState<LogsResponse | null>(null)
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [selectedLog, setSelectedLog] = useState<RequestLogEntry | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [method, setMethod] = useState<(typeof METHOD_OPTIONS)[number]>('ALL')
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('ALL')
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>('ALL')
  const [ip, setIp] = useState('')
  const [pathContains, setPathContains] = useState('')
  const [blockedOnly, setBlockedOnly] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('page_size', String(pageSize))
    params.set('method', method)
    params.set('status', status)
    params.set('category', category)
    params.set('is_blocked', blockedOnly ? 'true' : 'all')
    params.set('sort', sort)
    if (ip.trim()) params.set('ip', ip.trim())
    if (pathContains.trim()) params.set('path_contains', pathContains.trim())
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    return params.toString()
  }, [page, pageSize, method, status, category, blockedOnly, sort, ip, pathContains, dateFrom, dateTo])

  const loadLogs = useCallback(async () => {
    const data = (await adminFetch(`/admin/logs?${queryString}`)) as LogsResponse
    setLogsData(data)
  }, [queryString])

  const loadStats = useCallback(async () => {
    const data = (await adminFetch('/admin/logs/stats')) as StatsResponse
    setStats(data)
  }, [])

  const loadAll = useCallback(async () => {
    try {
      setError(null)
      await Promise.all([loadLogs(), loadStats()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs')
    } finally {
      setLoading(false)
      setStatsLoading(false)
    }
  }, [loadLogs, loadStats])

  useEffect(() => {
    const session = getAdminSession()
    if (!session) {
      router.replace('/admin/login')
      return
    }
    if (session.role !== 'super_admin') {
      router.replace('/admin/dashboard')
      return
    }
    void loadAll()
  }, [router, loadAll])

  useEffect(() => {
    if (loading) return
    void loadLogs()
  }, [queryString, loadLogs, loading])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(() => {
      void Promise.all([loadLogs(), loadStats()])
    }, 10000)
    return () => window.clearInterval(timer)
  }, [autoRefresh, loadLogs, loadStats])

  const resetFilters = () => {
    setPage(1)
    setMethod('ALL')
    setStatus('ALL')
    setCategory('ALL')
    setIp('')
    setPathContains('')
    setBlockedOnly(false)
    setDateFrom('')
    setDateTo('')
    setSort('newest')
  }

  const clearOldLogs = async () => {
    const ok = window.confirm(tr('Xóa log cũ hơn 30 ngày?', 'Clear logs older than 30 days?'))
    if (!ok) return
    try {
      await adminFetch('/admin/logs/clear', { method: 'DELETE' })
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear logs')
    }
  }

  const methodColor = (m: string) => {
    if (m === 'GET') return '#34d399'
    if (m === 'POST') return '#C9A84C'
    if (m === 'PUT') return '#f59e0b'
    if (m === 'DELETE') return '#f87171'
    return '#9ca3af'
  }

  const statusColor = (code: number) => {
    if (code >= 200 && code < 300) return '#34d399'
    if (code >= 300 && code < 400) return '#9ca3af'
    if (code >= 400 && code < 500) return '#f59e0b'
    return '#f87171'
  }

  const exportCurrentPageCsv = () => {
    const rows = logsData?.items || []
    if (!rows.length) return
    const header = [
      'time',
      'ip',
      'method',
      'path',
      'status_code',
      'duration_ms',
      'browser',
      'os',
      'device_type',
      'category',
      'is_blocked',
      'museum_id',
      'exhibit_id',
      'user_agent',
    ]
    const escapeCsv = (value: string | number | boolean | null | undefined) =>
      `"${String(value ?? '').replace(/"/g, '""')}"`
    const lines = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.timestamp,
          r.ip,
          r.method,
          r.path,
          r.status_code,
          r.duration_ms,
          r.user_agent_parsed?.browser || '',
          r.user_agent_parsed?.os || '',
          r.user_agent_parsed?.device_type || '',
          r.api_category,
          r.is_blocked,
          r.museum_id || '',
          r.exhibit_id || '',
          r.user_agent || '',
        ].map(escapeCsv).join(',')
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `request-logs-page-${page}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ flex: 1, padding: 20, background: '#0A0A0A', color: '#F5F0E8', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ margin: 0, color: '#C9A84C', fontSize: 28 }}>Request Logs</h1>
          <span style={badge}>{logsData?.total ?? 0}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn} onClick={() => setAutoRefresh((v) => !v)}>
            {autoRefresh ? tr('Tự động làm mới: Bật', 'Auto-refresh: On') : tr('Tự động làm mới: Tắt', 'Auto-refresh: Off')}
          </button>
          <button style={btn} onClick={exportCurrentPageCsv}>Export CSV</button>
          <button style={btnDanger} onClick={clearOldLogs}>{tr('Clear old logs', 'Clear old logs')}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
        <StatCard title={tr('Total Requests (24h)', 'Total Requests (24h)')} value={statsLoading ? '...' : String(stats?.total_requests_24h ?? 0)} />
        <StatCard
          title={tr('Blocked Requests (24h)', 'Blocked Requests (24h)')}
          value={statsLoading ? '...' : String(stats?.blocked_requests_24h ?? 0)}
          valueColor={(stats?.blocked_requests_24h || 0) > 0 ? '#f87171' : '#F5F0E8'}
        />
        <StatCard
          title={tr('Avg Response Time (ms)', 'Avg Response Time (ms)')}
          value={statsLoading ? '...' : String(stats?.avg_response_time_ms_24h ?? 0)}
        />
        <StatCard title={tr('Unique IPs (24h)', 'Unique IPs (24h)')} value={statsLoading ? '...' : String(stats?.unique_ips_24h ?? 0)} />
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showFilters ? 10 : 0 }}>
          <div style={{ fontWeight: 600 }}>{tr('Bộ lọc', 'Filters')}</div>
          <button style={btn} onClick={() => setShowFilters((v) => !v)}>
            {showFilters ? tr('Thu gọn', 'Collapse') : tr('Mở bộ lọc', 'Expand filters')}
          </button>
        </div>
        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            <select value={method} onChange={(e) => { setPage(1); setMethod(e.target.value as (typeof METHOD_OPTIONS)[number]) }} style={input}>
              {METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as (typeof STATUS_OPTIONS)[number]) }} style={input}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={category} onChange={(e) => { setPage(1); setCategory(e.target.value as (typeof CATEGORY_OPTIONS)[number]) }} style={input}>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input style={input} value={ip} onChange={(e) => { setPage(1); setIp(e.target.value) }} placeholder="IP" />
            <input style={input} value={pathContains} onChange={(e) => { setPage(1); setPathContains(e.target.value) }} placeholder="Path contains" />
            <input style={input} type="date" value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value) }} />
            <input style={input} type="date" value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value) }} />
            <select value={sort} onChange={(e) => { setPage(1); setSort(e.target.value as 'newest' | 'oldest') }} style={input}>
              <option value="newest">{tr('Mới nhất', 'Newest')}</option>
              <option value="oldest">{tr('Cũ nhất', 'Oldest')}</option>
            </select>
            <label style={{ ...input, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={blockedOnly} onChange={(e) => { setPage(1); setBlockedOnly(e.target.checked) }} />
              {tr('Chỉ hiện blocked', 'Blocked only')}
            </label>
            <button style={btn} onClick={resetFilters}>{tr('Reset filters', 'Reset filters')}</button>
          </div>
        )}
      </div>

      {error && <div style={{ ...card, borderColor: 'rgba(248,113,113,0.5)', color: '#fca5a5' }}>{error}</div>}

      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
          <thead>
            <tr>
              {['Time', 'IP', 'Method', 'Path', 'Status', 'Duration', 'Browser/OS', 'Category', 'Blocked'].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(logsData?.items || []).map((log) => (
              <tr
                key={log.id}
                style={{
                  ...trRow,
                  background: hoveredRowId === log.id ? 'rgba(201,168,76,0.08)' : 'transparent',
                }}
                onMouseEnter={() => setHoveredRowId(log.id)}
                onMouseLeave={() => setHoveredRowId(null)}
                onClick={() => setSelectedLog(log)}
              >
                <td style={td}>{new Date(log.timestamp).toLocaleString()}</td>
                <td style={td}>{log.ip}</td>
                <td style={td}>
                  <span style={{ ...pill, borderColor: `${methodColor(log.method)}80`, color: methodColor(log.method) }}>{log.method}</span>
                </td>
                <td style={{ ...td, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.path}</td>
                <td style={td}>
                  <span style={{ ...pill, borderColor: `${statusColor(log.status_code)}80`, color: statusColor(log.status_code) }}>
                    {log.status_code}
                  </span>
                </td>
                <td style={td}>{Math.round(log.duration_ms)} ms</td>
                <td style={td}>{log.user_agent_parsed?.browser || 'Unknown'} / {log.user_agent_parsed?.os || 'Unknown'}</td>
                <td style={td}>{log.api_category}</td>
                <td style={td}>{log.is_blocked ? <span style={{ color: '#f87171' }}>🚫</span> : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logsData?.items?.length && !loading && (
          <div style={{ padding: '16px 4px', opacity: 0.75 }}>{tr('Không có log', 'No logs found')}</div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <button style={btn} disabled={!logsData?.has_prev} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
        <div style={{ opacity: 0.85 }}>
          {tr('Trang', 'Page')} {logsData?.page || page} / {logsData?.total_pages || 1}
        </div>
        <button style={btn} disabled={!logsData?.has_next} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>

      {selectedLog && (
        <div style={overlay} onClick={() => setSelectedLog(null)}>
          <div
            style={{
              ...modal,
              border: selectedLog.is_blocked ? '1px solid rgba(248,113,113,0.5)' : modal.border,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: '#C9A84C' }}>Log Detail</h3>
              <button style={btn} onClick={() => setSelectedLog(null)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Detail label="ID" value={selectedLog.id} />
              <Detail label="Timestamp" value={selectedLog.timestamp} />
              <Detail label="IP" value={selectedLog.ip} />
              <Detail label="Method" value={selectedLog.method} />
              <Detail label="Path" value={selectedLog.path} />
              <Detail label="Status" value={String(selectedLog.status_code)} />
              <Detail label="Duration (ms)" value={String(selectedLog.duration_ms)} />
              <Detail label="Category" value={selectedLog.api_category} />
              <Detail label="Blocked" value={String(selectedLog.is_blocked)} />
              <Detail label="Museum ID" value={selectedLog.museum_id || '-'} />
              <Detail label="Exhibit ID" value={selectedLog.exhibit_id || '-'} />
              <Detail label="Browser / OS" value={`${selectedLog.user_agent_parsed?.browser || 'Unknown'} / ${selectedLog.user_agent_parsed?.os || 'Unknown'}`} />
              <Detail label="Device Type" value={selectedLog.user_agent_parsed?.device_type || 'Unknown'} />
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>User Agent</div>
              <div style={{ ...input, minHeight: 44, height: 'auto', padding: 12 }}>{selectedLog.user_agent || '-'}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                style={btn}
                onClick={async () => {
                  await navigator.clipboard.writeText(selectedLog.ip)
                }}
              >
                Copy IP
              </button>
              <button
                style={btn}
                onClick={() => {
                  setIp(selectedLog.ip)
                  setPage(1)
                  setSelectedLog(null)
                }}
              >
                Filter by IP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, valueColor }: { title: string; value: string; valueColor?: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: valueColor || '#F5F0E8' }}>{value}</div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}

const card: CSSProperties = {
  background: '#111',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 12,
}

const btn: CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.14)',
  background: '#1a1a1a',
  color: '#F5F0E8',
  cursor: 'pointer',
  padding: '0 12px',
  fontFamily: 'DM Sans, sans-serif',
}

const btnDanger: CSSProperties = {
  ...btn,
  border: '1px solid rgba(248,113,113,0.45)',
  color: '#fca5a5',
}

const input: CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.14)',
  background: '#1a1a1a',
  color: '#F5F0E8',
  padding: '0 12px',
  fontFamily: 'DM Sans, sans-serif',
}

const badge: CSSProperties = {
  minWidth: 28,
  height: 28,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 8px',
  background: 'rgba(201,168,76,0.2)',
  border: '1px solid rgba(201,168,76,0.45)',
  color: '#C9A84C',
  fontWeight: 700,
  fontSize: 13,
}

const th: CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  fontSize: 12,
  opacity: 0.85,
}

const td: CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  fontSize: 13,
}

const trRow: CSSProperties = {
  cursor: 'pointer',
}

const pill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 52,
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.2)',
  padding: '2px 8px',
  fontSize: 12,
  fontWeight: 600,
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 60,
  padding: 16,
}

const modal: CSSProperties = {
  width: 'min(960px, 100%)',
  maxHeight: '88vh',
  overflowY: 'auto',
  background: '#111',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 14,
}
