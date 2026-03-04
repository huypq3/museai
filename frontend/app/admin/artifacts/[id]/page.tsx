'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { adminFetch } from '@/lib/adminAuth'
import ImageUpload from '@/components/admin/ImageUpload'
import TagInput from '@/components/admin/TagInput'

type Scene = {
  keyword: string
  image_url: string
  trigger_words: string[]
}

export default function EditArtifactPage() {
  const router = useRouter()
  const params = useParams()
  const artifactId = params.id as string
  
  const [form, setForm] = useState({
    name: '',
    era: '',
    location: '',
    description: '',
    image_url: '',
    system_prompt: '',
  })
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadArtifact()
  }, [])

  const loadArtifact = async () => {
    try {
      const data = await adminFetch(`/admin/artifacts/${artifactId}`)
      setForm({
        name: data.name || '',
        era: data.era || '',
        location: data.location || '',
        description: data.description || '',
        image_url: data.image_url || '',
        system_prompt: data.system_prompt || '',
      })
      setScenes(data.scenes || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveInfo = async () => {
    setSaving(true)
    try {
      await adminFetch(`/admin/artifacts/${artifactId}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      })
      alert('Đã lưu thông tin')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveScenes = async () => {
    setSaving(true)
    try {
      await adminFetch(`/admin/artifacts/${artifactId}`, {
        method: 'PUT',
        body: JSON.stringify({ scenes }),
      })
      alert('Đã lưu scenes')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const addScene = () => {
    setScenes([...scenes, { keyword: '', image_url: '', trigger_words: [] }])
  }

  const updateScene = (index: number, field: keyof Scene, value: any) => {
    const updated = [...scenes]
    updated[index] = { ...updated[index], [field]: value }
    setScenes(updated)
  }

  const removeScene = (index: number) => {
    setScenes(scenes.filter((_, i) => i !== index))
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

  if (loading) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        Đang tải...
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div style={{
        padding: '16px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(245,240,232,0.5)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ← Quay lại
          </button>
          <div style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 20,
            color: '#C9A84C',
          }}>
            {form.name || 'Chỉnh sửa hiện vật'}
          </div>
        </div>
        <button
          onClick={() => router.push(`/admin/artifacts/${artifactId}/qr`)}
          style={{
            padding: '8px 16px',
            background: 'rgba(201,168,76,0.15)',
            border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: 8,
            color: '#C9A84C',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          📱 Xem QR
        </button>
      </div>

      {/* Content — 2 panels */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        overflow: 'hidden',
      }}>
        {/* Left panel — Info */}
        <div style={{
          padding: 32,
          overflowY: 'auto',
          borderRight: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            fontSize: 16,
            fontWeight: 500,
            marginBottom: 20,
            color: 'rgba(245,240,232,0.9)',
          }}>
            Thông tin hiện vật
          </div>

          <ImageUpload
            value={form.image_url}
            onChange={url => setForm({ ...form, image_url: url })}
          />

          <label style={{
            fontSize: 12,
            color: 'rgba(245,240,232,0.5)',
            display: 'block',
            marginBottom: 6,
          }}>
            Tên hiện vật
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
            Thời kỳ
          </label>
          <input
            value={form.era}
            onChange={e => setForm({ ...form, era: e.target.value })}
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
            style={{ ...inputStyle, height: 80, resize: 'vertical' as const }}
          />

          <label style={{
            fontSize: 12,
            color: 'rgba(245,240,232,0.5)',
            display: 'block',
            marginBottom: 6,
          }}>
            System Prompt
          </label>
          <textarea
            value={form.system_prompt}
            onChange={e => setForm({ ...form, system_prompt: e.target.value })}
            placeholder="Bạn là hướng dẫn viên ảo đóng vai..."
            style={{ ...inputStyle, height: 100, resize: 'vertical' as const }}
          />

          <button
            onClick={handleSaveInfo}
            disabled={saving}
            style={{
              width: '100%',
              padding: '12px',
              background: '#C9A84C',
              border: 'none',
              borderRadius: 10,
              color: '#0A0A0A',
              fontSize: 14,
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        </div>

        {/* Right panel — Scenes */}
        <div style={{
          padding: 32,
          overflowY: 'auto',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}>
            <div style={{
              fontSize: 16,
              fontWeight: 500,
              color: 'rgba(245,240,232,0.9)',
            }}>
              Scenes ({scenes.length})
            </div>
            <button
              onClick={addScene}
              style={{
                padding: '6px 12px',
                background: 'rgba(201,168,76,0.15)',
                border: '1px solid rgba(201,168,76,0.3)',
                borderRadius: 8,
                color: '#C9A84C',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              + Thêm scene
            </button>
          </div>

          {scenes.length === 0 ? (
            <div style={{
              color: 'rgba(245,240,232,0.4)',
              textAlign: 'center',
              paddingTop: 40,
              fontSize: 14,
            }}>
              Chưa có scene nào
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {scenes.map((scene, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}>
                    <span style={{ fontSize: 13, color: 'rgba(245,240,232,0.6)' }}>
                      Scene {i + 1}
                    </span>
                    <button
                      onClick={() => removeScene(i)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(248,113,113,0.6)',
                        cursor: 'pointer',
                        fontSize: 14,
                      }}
                    >
                      Xóa
                    </button>
                  </div>

                  <ImageUpload
                    value={scene.image_url}
                    onChange={url => updateScene(i, 'image_url', url)}
                    label="Ảnh scene"
                  />

                  <label style={{
                    fontSize: 11,
                    color: 'rgba(245,240,232,0.5)',
                    display: 'block',
                    marginBottom: 6,
                  }}>
                    Keyword
                  </label>
                  <input
                    value={scene.keyword}
                    onChange={e => updateScene(i, 'keyword', e.target.value)}
                    placeholder="VD: Trận Bạch Đằng"
                    style={{
                      ...inputStyle,
                      fontSize: 13,
                      marginBottom: 12,
                    }}
                  />

                  <label style={{
                    fontSize: 11,
                    color: 'rgba(245,240,232,0.5)',
                    display: 'block',
                    marginBottom: 6,
                  }}>
                    Trigger words (Enter hoặc dấu phẩy để thêm)
                  </label>
                  <TagInput
                    tags={scene.trigger_words}
                    onChange={tags => updateScene(i, 'trigger_words', tags)}
                    placeholder="VD: bạch đằng, thủy chiến..."
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleSaveScenes}
            disabled={saving}
            style={{
              width: '100%',
              padding: '12px',
              background: '#C9A84C',
              border: 'none',
              borderRadius: 10,
              color: '#0A0A0A',
              fontSize: 14,
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              marginTop: 16,
            }}
          >
            {saving ? 'Đang lưu...' : 'Lưu scenes'}
          </button>
        </div>
      </div>
    </div>
  )
}
