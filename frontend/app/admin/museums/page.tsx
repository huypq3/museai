'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch, clearAdminToken } from '@/lib/adminAuth'

type Museum = {
  id: string
  name: string
  description: string
  address: string
  artifact_count: number
  logo_url: string
}

export default function MuseumsPage() {
  const router = useRouter()
  const [museums, setMuseums] = useState<Museum[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', name_en: '', description: '', address: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadMuseums()
  }, [])

  const loadMuseums = async () => {
    try {
      const data = await adminFetch('/admin/museums/')
      setMuseums(data)
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
      setForm({ name: '', name_en: '', description: '', address: '' })
      loadMuseums()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa bảo tàng này?')) return
    await adminFetch(`/admin/museums/${id}`, { method: 'DELETE' })
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
          <div style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 28,
            color: '#C9A84C',
          }}>
            MuseAI Admin
          </div>
          <div style={{
            fontSize: 12,
            color: 'rgba(245,240,232,0.4)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}>
            Quản lý bảo tàng
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '10px 20px',
              background: '#C9A84C',
              color: '#0A0A0A',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            + Thêm bảo tàng
          </button>
          <button
            onClick={() => {
              clearAdminToken()
              router.push('/admin/login')
            }}
            style={{
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: 'rgba(245,240,232,0.6)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Đăng xuất
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
          Đang tải...
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
              <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
                {m.name}
              </div>
              <div style={{
                fontSize: 12,
                color: 'rgba(245,240,232,0.4)',
                marginBottom: 12,
              }}>
                {m.address || 'Chưa có địa chỉ'}
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
                  {m.artifact_count || 0} hiện vật
                </span>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    handleDelete(m.id)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(248,113,113,0.6)',
                    cursor: 'pointer',
                    fontSize: 18,
                  }}
                >
                  ✕
                </button>
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
              Thêm bảo tàng
            </div>
            <input
              placeholder="Tên bảo tàng (tiếng Việt)"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Tên tiếng Anh (dùng làm ID)"
              value={form.name_en}
              onChange={e => setForm({ ...form, name_en: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Địa chỉ"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              style={inputStyle}
            />
            <textarea
              placeholder="Mô tả"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              style={{ ...inputStyle, height: 80, resize: 'none' as const }}
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
                Hủy
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
                {saving ? 'Đang lưu...' : 'Tạo bảo tàng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
