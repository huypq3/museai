'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { adminFetch } from '@/lib/adminAuth'

type Artifact = {
  id: string
  name: string
  era: string
  image_url: string
}

export default function MuseumDetailPage() {
  const router = useRouter()
  const params = useParams()
  const museumId = params.id as string
  
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(true)
  const [museumName, setMuseumName] = useState('')

  useEffect(() => {
    loadArtifacts()
  }, [])

  const loadArtifacts = async () => {
    try {
      const data = await adminFetch(`/admin/artifacts/?museum_id=${museumId}`)
      setArtifacts(data)
      
      // Get museum name
      const museums = await adminFetch('/admin/museums/')
      const museum = museums.find((m: any) => m.id === museumId)
      if (museum) setMuseumName(museum.name)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa hiện vật này?')) return
    await adminFetch(`/admin/artifacts/${id}`, { method: 'DELETE' })
    loadArtifacts()
  }

  return (
    <div style={{ flex: 1, padding: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => router.push('/admin/museums')}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(245,240,232,0.5)',
            fontSize: 14,
            cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          ← Bảo tàng
        </button>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 28,
              color: '#C9A84C',
            }}>
              {museumName || museumId}
            </div>
            <div style={{
              fontSize: 12,
              color: 'rgba(245,240,232,0.4)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}>
              {artifacts.length} hiện vật
            </div>
          </div>
          <button
            onClick={() => router.push(`/admin/artifacts/new?museum=${museumId}`)}
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
            + Thêm hiện vật
          </button>
        </div>
      </div>

      {/* Artifacts grid */}
      {loading ? (
        <div style={{
          color: 'rgba(245,240,232,0.4)',
          textAlign: 'center',
          paddingTop: 80,
        }}>
          Đang tải...
        </div>
      ) : artifacts.length === 0 ? (
        <div style={{
          color: 'rgba(245,240,232,0.4)',
          textAlign: 'center',
          paddingTop: 80,
        }}>
          Chưa có hiện vật nào
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}>
          {artifacts.map(a => (
            <div
              key={a.id}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onClick={() => router.push(`/admin/artifacts/${a.id}`)}
            >
              {/* Image */}
              <div style={{
                width: '100%',
                height: 160,
                background: 'rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {a.image_url ? (
                  <img
                    src={a.image_url}
                    alt={a.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 40, opacity: 0.3 }}>🏛️</span>
                )}
              </div>
              
              {/* Info */}
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
                  {a.name}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'rgba(245,240,232,0.4)',
                  marginBottom: 12,
                }}>
                  {a.era || 'Chưa có thời kỳ'}
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    handleDelete(a.id)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(248,113,113,0.6)',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
