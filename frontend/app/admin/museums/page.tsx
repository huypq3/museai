'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch, getAdminSession } from '@/lib/adminAuth'
import { useAdminI18n } from '@/lib/i18n/admin'

type Museum = {
  id: string
  name: string
  description?: string
  address?: string
  exhibit_count?: number
  logo_url?: string
  status?: string
}

export default function MuseumsPage() {
  const router = useRouter()
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)
  const [museums, setMuseums] = useState<Museum[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    name: '',
    name_en: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    admin_username: '',
    admin_password: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const s = getAdminSession()
    if (s?.role === 'museum_admin' && s.museum_id) {
      router.replace(`/admin/museum/${s.museum_id}`)
      return
    }
    loadMuseums()
  }, [])

  const loadMuseums = async () => {
    try {
      const data = await adminFetch('/admin/museums/?include_inactive=true')
      setMuseums(data || [])
    } catch {
      router.push('/admin/login')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      await adminFetch('/admin/museums/', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setShowModal(false)
      setForm({
        name: '',
        name_en: '',
        address: '',
        city: '',
        phone: '',
        email: '',
        admin_username: '',
        admin_password: '',
      })
      loadMuseums()
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (museum: Museum) => {
    const current = String(museum.status || 'active').toLowerCase()
    const next = current === 'inactive' ? 'active' : 'inactive'
    const ask = next === 'inactive'
      ? tr('Chuyển bảo tàng sang Inactive?', 'Set museum to Inactive?')
      : tr('Kích hoạt lại bảo tàng (Active)?', 'Set museum back to Active?')
    if (!confirm(ask)) return
    await adminFetch(`/admin/museums/${museum.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: next }),
    })
    loadMuseums()
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#F5F0E8',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginBottom: 12,
  }

  return (
    <div style={{ flex: 1, padding: 32 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
      }}>
        <div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#C9A84C' }}>
            {tr('Bảo tàng', 'Museums')}
          </div>
          <div style={{
            fontSize: 12,
            color: 'rgba(245,240,232,0.4)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}>
            {tr('Quản lý bảo tàng', 'Museum management')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => router.push('/admin/museums/new')}
            style={{
              padding: '10px 16px',
              background: '#C9A84C',
              color: '#0A0A0A',
              border: '1px solid rgba(201,168,76,0.35)',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + {tr('Thêm bảo tàng', 'Add museum')}
          </button>
        </div>
      </div>

      {/* Museum grid */}
      {loading ? (
        <div style={{
          color: 'rgba(245,240,232,0.4)',
          textAlign: 'center',
          paddingTop: 80,
        }}>
          {tr('Đang tải...', 'Loading...')}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {museums.map(m => (
            <div
              key={m.id}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: 20,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onClick={() => router.push(`/admin/museums/${m.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <img
                  src={m.logo_url || ''}
                  alt={m.name}
                  style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', background: 'rgba(255,255,255,0.08)' }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
                <div style={{ fontSize: 18, fontWeight: 500 }}>
                  {m.name}
                </div>
              </div>
              <div style={{
                fontSize: 12,
                color: 'rgba(245,240,232,0.4)',
                marginBottom: 12,
              }}>
                {m.address || tr('Chưa có địa chỉ', 'No address')}
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{
                  fontSize: 12,
                  color: '#C9A84C',
                  background: 'rgba(201,168,76,0.1)',
                  padding: '3px 10px',
                  borderRadius: 20,
                }}>
                  {m.exhibit_count || 0} {tr('hiện vật', 'exhibits')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: String(m.status || 'active').toLowerCase() === 'inactive' ? '#fca5a5' : '#86efac',
                    background: String(m.status || 'active').toLowerCase() === 'inactive' ? 'rgba(127,29,29,0.3)' : 'rgba(22,101,52,0.25)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    {String(m.status || 'active').toLowerCase() === 'inactive' ? 'Inactive' : 'Active'}
                  </span>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleToggleStatus(m)
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: '#F5F0E8',
                      cursor: 'pointer',
                      fontSize: 12,
                      padding: '6px 10px',
                      borderRadius: 8,
                    }}
                  >
                    {String(m.status || 'active').toLowerCase() === 'inactive' ? tr('Kích hoạt', 'Activate') : tr('Tạm ngưng', 'Deactivate')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              width: 440,
              background: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20,
              padding: 32,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 24 }}>
              {tr('Thêm bảo tàng', 'Add museum')}
            </div>
            <input
              placeholder={tr('Tên bảo tàng (tiếng Việt)', 'Museum name (Vietnamese)')}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder={tr('Tên tiếng Anh (dùng làm ID)', 'English name (used as ID)')}
              value={form.name_en}
              onChange={e => setForm({ ...form, name_en: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder={tr('Địa chỉ', 'Address')}
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder={tr('Thành phố', 'City')}
              value={form.city}
              onChange={e => setForm({ ...form, city: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder={tr('Số điện thoại', 'Phone')}
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder={tr('Email', 'Email')}
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Museum admin username"
              value={form.admin_username}
              onChange={e => setForm({ ...form, admin_username: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Museum admin password"
              value={form.admin_password}
              onChange={e => setForm({ ...form, admin_password: e.target.value })}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: '#F5F0E8',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {tr('Hủy', 'Cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '11px',
                  background: '#C9A84C',
                  border: 'none',
                  borderRadius: 10,
                  color: '#0A0A0A',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {saving ? tr('Đang lưu...', 'Saving...') : tr('Tạo bảo tàng', 'Create museum')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
