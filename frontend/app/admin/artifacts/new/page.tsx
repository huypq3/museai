'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { adminFetch } from '@/lib/adminAuth'
import ImageUpload from '@/components/admin/ImageUpload'

export default function NewArtifactPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const museumId = searchParams.get('museum') || ''
  
  const [form, setForm] = useState({
    name: '',
    name_en: '',
    era: '',
    location: '',
    description: '',
    image_url: '',
    system_prompt: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!form.name || !form.name_en) {
      alert('Vui lòng điền tên hiện vật')
      return
    }
    
    setSaving(true)
    try {
      const data = await adminFetch('/admin/artifacts/', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          museum_id: museumId,
        }),
      })
      router.push(`/admin/artifacts/${data.id}`)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
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
    marginBottom: 16,
  }

  return (
    <div style={{ flex: 1, padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <button
        onClick={() => router.back()}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(245,240,232,0.5)',
          fontSize: 14,
          cursor: 'pointer',
          marginBottom: 16,
        }}
      >
        ← Quay lại
      </button>

      <div style={{
        fontFamily: 'Cormorant Garamond, serif',
        fontSize: 28,
        color: '#C9A84C',
        marginBottom: 32,
      }}>
        Thêm hiện vật mới
      </div>

      <ImageUpload
        value={form.image_url}
        onChange={url => setForm({ ...form, image_url: url })}
        label="Ảnh đại diện"
      />

      <label style={{
        fontSize: 12,
        color: 'rgba(245,240,232,0.5)',
        display: 'block',
        marginBottom: 6,
      }}>
        Tên hiện vật (tiếng Việt) *
      </label>
      <input
        value={form.name}
        onChange={e => setForm({ ...form, name: e.target.value })}
        style={inputStyle}
      />

      <label style={{
        fontSize: 12,
        color: 'rgba(245,240,232,0.5)',
        display: 'block',
        marginBottom: 6,
      }}>
        Tên tiếng Anh (dùng làm ID) *
      </label>
      <input
        value={form.name_en}
        onChange={e => setForm({ ...form, name_en: e.target.value })}
        style={inputStyle}
      />

      <label style={{
        fontSize: 12,
        color: 'rgba(245,240,232,0.5)',
        display: 'block',
        marginBottom: 6,
      }}>
        Thời kỳ
      </label>
      <input
        value={form.era}
        onChange={e => setForm({ ...form, era: e.target.value })}
        placeholder="VD: Thế kỷ XIII"
        style={inputStyle}
      />

      <label style={{
        fontSize: 12,
        color: 'rgba(245,240,232,0.5)',
        display: 'block',
        marginBottom: 6,
      }}>
        Vị trí
      </label>
      <input
        value={form.location}
        onChange={e => setForm({ ...form, location: e.target.value })}
        placeholder="VD: Sảnh chính"
        style={inputStyle}
      />

      <label style={{
        fontSize: 12,
        color: 'rgba(245,240,232,0.5)',
        display: 'block',
        marginBottom: 6,
      }}>
        Mô tả
      </label>
      <textarea
        value={form.description}
        onChange={e => setForm({ ...form, description: e.target.value })}
        style={{ ...inputStyle, height: 100, resize: 'vertical' as const }}
      />

      <label style={{
        fontSize: 12,
        color: 'rgba(245,240,232,0.5)',
        display: 'block',
        marginBottom: 6,
      }}>
        System Prompt (AI persona)
      </label>
      <textarea
        value={form.system_prompt}
        onChange={e => setForm({ ...form, system_prompt: e.target.value })}
        placeholder="Bạn là hướng dẫn viên ảo đóng vai..."
        style={{ ...inputStyle, height: 120, resize: 'vertical' as const }}
      />

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          onClick={() => router.back()}
          style={{
            flex: 1,
            padding: '12px',
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
          onClick={handleSubmit}
          disabled={saving}
          style={{
            flex: 1,
            padding: '12px',
            background: '#C9A84C',
            border: 'none',
            borderRadius: 10,
            color: '#0A0A0A',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Đang lưu...' : 'Tạo hiện vật'}
        </button>
      </div>
    </div>
  )
}
