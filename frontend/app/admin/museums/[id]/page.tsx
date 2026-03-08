'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { adminFetch } from '@/lib/adminAuth'
import { useAdminI18n } from '@/lib/i18n/admin'
import { FaQrcode, FaDownload, FaLink } from 'react-icons/fa'

type Exhibit = {
  id: string
  name: string
  period?: string
  primary_image_url?: string
  image_url?: string
  location?: { hall?: string } | string
  status?: 'published' | 'draft'
}

export default function MuseumDetailPage() {
  const router = useRouter()
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)
  const params = useParams()
  const museumId = params.id as string
  
  const [exhibits, setExhibits] = useState<Exhibit[]>([])
  const [loading, setLoading] = useState(true)
  const [museumName, setMuseumName] = useState('')
  const [museumQr, setMuseumQr] = useState<{ qr_data_url: string; qr_url: string } | null>(null)
  const [showQrModal, setShowQrModal] = useState(false)

  useEffect(() => {
    loadExhibits()
  }, [])

  const loadExhibits = async () => {
    try {
      const [data, museums, qrRes] = await Promise.all([
        adminFetch(`/admin/exhibits/?museum_id=${museumId}`),
        adminFetch('/admin/museums/'),
        adminFetch(`/admin/qr/museum/${museumId}`),
      ])
      setExhibits(data)
      setMuseumQr(qrRes?.museum_qr || null)

      const museum = museums.find((m: any) => m.id === museumId)
      if (museum) setMuseumName(museum.name)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(tr('Xóa hiện vật này?', 'Delete this exhibit?'))) return
    await adminFetch(`/admin/exhibits/${id}`, { method: 'DELETE' })
    loadExhibits()
  }

  return (
    <div style={{ flex: 1, padding: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                fontFamily: 'Cormorant Garamond, serif',
                fontSize: 28,
                color: '#C9A84C',
              }}>
                {museumName || museumId}
              </div>
              <button
                onClick={() => setShowQrModal(true)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#C9A84C',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title={tr('QR bảo tàng', 'Museum QR')}
              >
                <FaQrcode size={16} />
              </button>
            </div>
            <div style={{
              fontSize: 12,
              color: 'rgba(245,240,232,0.4)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}>
              {exhibits.length} {tr('hiện vật', 'exhibits')}
            </div>
          </div>
          <button
            onClick={() => router.push(`/admin/exhibits/new?museum=${museumId}`)}
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
            + {tr('Thêm hiện vật', 'Add exhibit')}
          </button>
        </div>
      </div>

      {/* Exhibits grid */}
      {loading ? (
        <div style={{
          color: 'rgba(245,240,232,0.4)',
          textAlign: 'center',
          paddingTop: 80,
        }}>
          {tr('Đang tải...', 'Loading...')}
        </div>
      ) : exhibits.length === 0 ? (
        <div style={{
          color: 'rgba(245,240,232,0.4)',
          textAlign: 'center',
          paddingTop: 80,
        }}>
          {tr('Chưa có hiện vật nào', 'No exhibits yet')}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}>
          {exhibits.map(a => (
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
              onClick={() => router.push(`/admin/exhibits/${a.id}`)}
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
                {a.primary_image_url || a.image_url ? (
                  <img
                    src={a.primary_image_url || a.image_url}
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
                <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', marginBottom: 6 }}>
                  {a.period || tr('Chưa có thời kỳ', 'No period')}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', marginBottom: 12 }}>
                  {typeof a.location === 'object' ? a.location?.hall : a.location || tr('Chưa có vị trí', 'No location')} · {a.status || 'draft'}
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
                  {tr('Xóa', 'Delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showQrModal && museumQr && (
        <div
          onClick={() => setShowQrModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#111111',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#C9A84C', fontWeight: 600 }}>
                <FaQrcode size={16} />
                <span>{tr('QR bảo tàng', 'Museum QR')}</span>
              </div>
              <button onClick={() => setShowQrModal(false)} style={{ ...modalBtn, width: 32, padding: 0 }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <img src={museumQr.qr_data_url} alt={`Museum QR ${museumName || museumId}`} style={{ width: 180, height: 180, background: '#fff', borderRadius: 8 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{tr('Đường dẫn', 'URL')}</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, wordBreak: 'break-all', marginBottom: 12, color: 'rgba(245,240,232,0.86)' }}>
                  {museumQr.qr_url}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href={museumQr.qr_data_url} download={`museum-${museumId}.png`} style={{ ...modalBtn, textDecoration: 'none' }}>
                    <FaDownload size={12} /> PNG
                  </a>
                  <button onClick={() => navigator.clipboard.writeText(museumQr.qr_url)} style={modalBtn}>
                    <FaLink size={12} /> {tr('Sao chép link', 'Copy link')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const modalBtn: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  color: '#F5F0E8',
  fontSize: 13,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}
