'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch, getAdminSession } from '@/lib/adminAuth'
import { useAdminI18n } from '@/lib/i18n/admin'

type AdminUser = {
  uid: string
  username: string
  email?: string
  role: 'super_admin' | 'museum_admin'
  museum_id?: string | null
  museum_name?: string | null
  status?: 'active' | 'suspended'
  last_login?: string | null
  login_count?: number
}

type Museum = {
  id: string
  name: string
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [museums, setMuseums] = useState<Museum[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [showCreds, setShowCreds] = useState(false)
  const [createdCreds, setCreatedCreds] = useState<any>(null)
  const [createForm, setCreateForm] = useState({
    museum_id: '',
    username: '',
    password: '',
    email: '',
  })

  const load = async () => {
    const [usersRes, museumsRes] = await Promise.all([
      adminFetch('/admin/users/'),
      adminFetch('/admin/museums/'),
    ])
    setUsers(usersRes.users || [])
    setMuseums(museumsRes || [])
  }

  useEffect(() => {
    const session = getAdminSession()
    if (!session) {
      router.replace('/admin/login')
      return
    }
    if (session.role !== 'super_admin') {
      router.replace(session.museum_id ? `/admin/museum/${session.museum_id}` : '/admin/login')
      return
    }
    load()
      .catch(() => router.replace('/admin/login'))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    const museumId = new URLSearchParams(window.location.search).get('museum_id')
    if (museumId) {
      setShowCreate(true)
      setCreateForm((f) => ({ ...f, museum_id: museumId, username: f.username || suggestUsername(museumId) }))
    }
  }, [])

  const activeMuseumAdminMap = useMemo(() => {
    const map = new Map<string, AdminUser>()
    users
      .filter((u) => u.role === 'museum_admin' && u.status !== 'suspended' && u.museum_id)
      .forEach((u) => map.set(String(u.museum_id), u))
    return map
  }, [users])

  const availableMuseums = useMemo(
    () => museums.filter((m) => !activeMuseumAdminMap.has(m.id)),
    [museums, activeMuseumAdminMap]
  )

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      if (statusFilter !== 'all' && (u.status || 'active') !== statusFilter) return false
      if (!q) return true
      return (
        u.username?.toLowerCase().includes(q) ||
        String(u.museum_name || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q)
      )
    })
  }, [users, query, statusFilter])

  const suggestUsername = (museumId: string) => {
    const museum = museums.find((m) => m.id === museumId)
    if (!museum) return ''
    const slug = museum.id.replace(/-/g, '_')
    return `${slug}_admin`
  }

  const randomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
    let out = ''
    for (let i = 0; i < 12; i += 1) out += chars[Math.floor(Math.random() * chars.length)]
    return out
  }

  const handleCreate = async () => {
    if (!createForm.museum_id || !createForm.username || createForm.password.length < 8) {
      alert(tr('Vui lòng nhập đủ thông tin hợp lệ', 'Please enter valid required information'))
      return
    }
    const res = await adminFetch('/admin/users/', {
      method: 'POST',
      body: JSON.stringify(createForm),
    })
    setCreatedCreds(res)
    setShowCreate(false)
    setShowCreds(true)
    setCreateForm({ museum_id: '', username: '', password: '', email: '' })
    await load()
  }

  const handleSuspend = async (u: AdminUser) => {
    if (!confirm(`Suspend account ${u.username}?`)) return
    await adminFetch(`/admin/users/${u.uid}`, { method: 'DELETE' })
    await load()
  }

  const handleReactivate = async (u: AdminUser) => {
    await adminFetch(`/admin/users/${u.uid}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'active' }),
    })
    await load()
  }

  const handleResetPassword = async (u: AdminUser) => {
    if (!confirm(`Reset password cho ${u.username}?`)) return
    const res = await adminFetch(`/admin/users/${u.uid}/reset-password`, { method: 'POST' })
    alert(`${tr('Mật khẩu mới', 'New password')}: ${res.new_password}`)
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    alert(tr('Đã copy', 'Copied'))
  }

  const downloadCredentials = () => {
    if (!createdCreds) return
    const content = [
      `Museum: ${createdCreds.museum_name}`,
      `Museum ID: ${createdCreds.museum_id}`,
      `Username: ${createdCreds.username}`,
      `Password: ${createdCreds.password}`,
      `Login URL: ${window.location.origin}/admin/login`,
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `credentials-${createdCreds.username}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ flex: 1, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, color: '#C9A84C', fontFamily: 'Cormorant Garamond, serif' }}>{tr('Quản lý tài khoản', 'User management')}</h1>
          <div style={{ opacity: 0.7, fontSize: 13 }}>{tr('Super Admin tạo và quản lý Museum Admin', 'Super admin creates and manages museum admins')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/admin/dashboard')} style={btn}>{tr('Bảng điều khiển', 'Dashboard')}</button>
          <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ {tr('Tạo', 'Create')}</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={input}>
          <option value="all">{tr('Tất cả', 'All')}</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <input
          style={{ ...input, flex: 1 }}
          placeholder={tr('Tìm username / bảo tàng / email', 'Search username / museum / email')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div style={card}>
        {loading ? (
          <div>{tr('Đang tải...', 'Loading...')}</div>
        ) : (
          filteredUsers.map((u) => (
            <div key={u.uid} style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{u.username} {u.role === 'super_admin' ? '🛡️' : '🏛️'}</div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>{u.museum_name || (u.role === 'super_admin' ? 'System' : '-')}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{u.email || tr('Chưa có email', 'No email')}</div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    {tr('Lần đăng nhập gần nhất', 'Last login')}: {u.last_login || tr('Chưa đăng nhập', 'Never logged in')} · {tr('Số lần', 'Count')}: {u.login_count || 0}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: u.status === 'suspended' ? '#f87171' : '#34d399' }}>
                    ● {u.status || 'active'}
                  </span>
                  {u.role !== 'super_admin' && (
                    <>
                      <button onClick={() => handleResetPassword(u)} style={btn}>{tr('Đổi MK', 'Reset password')}</button>
                      {u.status === 'suspended' ? (
                        <button onClick={() => handleReactivate(u)} style={btnPrimary}>{tr('Kích hoạt lại', 'Reactivate')}</button>
                      ) : (
                        <button onClick={() => handleSuspend(u)} style={btnDanger}>Suspend</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <div style={overlay} onClick={() => setShowCreate(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{tr('Tạo tài khoản Museum Admin', 'Create Museum Admin account')}</h3>
            <label style={label}>{tr('Bảo tàng *', 'Museum *')}</label>
            <select
              style={input}
              value={createForm.museum_id}
              onChange={(e) => {
                const museum_id = e.target.value
                setCreateForm((f) => ({ ...f, museum_id, username: suggestUsername(museum_id) }))
              }}
            >
              <option value="">{tr('Chọn bảo tàng...', 'Select museum...')}</option>
              {availableMuseums.map((m) => (
                <option value={m.id} key={m.id}>{m.name}</option>
              ))}
            </select>
            <label style={label}>Username *</label>
            <input style={input} value={createForm.username} onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} />
            <label style={label}>{tr('Mật khẩu *', 'Password *')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...input, marginBottom: 0 }} value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
              <button style={btn} onClick={() => setCreateForm((f) => ({ ...f, password: randomPassword() }))}>🔀 Random</button>
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{tr('Tối thiểu 8 ký tự', 'Minimum 8 characters')}</div>
            <label style={{ ...label, marginTop: 8 }}>{tr('Email (tùy chọn)', 'Email (optional)')}</label>
            <input style={input} value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={btn} onClick={() => setShowCreate(false)}>{tr('Hủy', 'Cancel')}</button>
              <button style={btnPrimary} onClick={handleCreate}>{tr('Tạo tài khoản', 'Create account')}</button>
            </div>
          </div>
        </div>
      )}

      {showCreds && createdCreds && (
        <div style={overlay} onClick={() => setShowCreds(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{tr('Tài khoản đã được tạo', 'Account created')}</h3>
            <div style={{ color: '#fbbf24', marginBottom: 8 }}>{tr('Lưu thông tin này ngay. Mật khẩu sẽ không hiển thị lại.', 'Save this now. Password will not be shown again.')}</div>
            <p style={{ margin: '4px 0' }}>{tr('Bảo tàng', 'Museum')}: {createdCreds.museum_name}</p>
            <p style={{ margin: '4px 0' }}>
              Username: {createdCreds.username} <button style={btn} onClick={() => handleCopy(createdCreds.username)}>📋</button>
            </p>
            <p style={{ margin: '4px 0' }}>
              Password: {createdCreds.password} <button style={btn} onClick={() => handleCopy(createdCreds.password)}>📋</button>
            </p>
            <p style={{ margin: '4px 0' }}>
              Login URL: {window.location.origin}/admin/login <button style={btn} onClick={() => handleCopy(`${window.location.origin}/admin/login`)}>📋</button>
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <button style={btn} onClick={downloadCredentials}>📥 {tr('Download thông tin đăng nhập', 'Download credentials')}</button>
              <button style={btnPrimary} onClick={() => setShowCreds(false)}>{tr('Đóng', 'Close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const card: any = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }
const input: any = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#F5F0E8', boxSizing: 'border-box', marginBottom: 8 }
const btn: any = { padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#F5F0E8', cursor: 'pointer' }
const btnPrimary: any = { ...btn, background: '#C9A84C', color: '#0A0A0A', border: 'none', fontWeight: 600 }
const btnDanger: any = { ...btn, background: 'rgba(127,29,29,0.8)', border: '1px solid rgba(248,113,113,0.5)' }
const label: any = { display: 'block', fontSize: 13, opacity: 0.8, marginBottom: 4 }
const overlay: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modal: any = { width: 560, maxWidth: '95vw', background: '#111', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 16 }
