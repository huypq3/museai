'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FaEdit, FaPowerOff, FaQrcode, FaTrash, FaDownload, FaLink } from 'react-icons/fa'
import { adminFetch, getAdminSession } from '@/lib/adminAuth'
import { useAdminI18n } from '@/lib/i18n/admin'

type ExhibitRecord = {
  id: string
  name: string
  image_url?: string
  primary_image_url?: string
  location?: { hall?: string } | string
  status?: 'published' | 'draft'
  total_scans?: number
  created_at?: unknown
  updated_at?: unknown
}

type MuseumRecord = {
  id: string
  name?: string
  address?: string
  total_visits?: number
  supported_languages?: string[]
  logo_url?: string
}

type MuseumQr = {
  qr_data_url: string
  qr_url: string
}

export default function MuseumAdminHome() {
  const params = useParams()
  const router = useRouter()
  const museumId = params.id as string
  const session = useMemo(() => getAdminSession(), [])
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)

  const [museum, setMuseum] = useState<MuseumRecord | null>(null)
  const [exhibits, setExhibits] = useState<ExhibitRecord[]>([])
  const [museumQr, setMuseumQr] = useState<MuseumQr | null>(null)
  const [showQrModal, setShowQrModal] = useState(false)

  async function loadMuseumAndExhibits() {
    const [museumData, exhibitData] = await Promise.all([
      adminFetch(`/admin/museums/${museumId}`),
      adminFetch(`/admin/exhibits?museum_id=${museumId}`),
    ])
    setMuseum(museumData)
    setExhibits(exhibitData)
  }

  useEffect(() => {
    if (!session) {
      router.replace('/admin/login')
      return
    }
    if (session.role === 'museum_admin' && session.museum_id !== museumId) {
      router.replace(`/admin/museum/${session.museum_id}`)
      return
    }
    loadMuseumAndExhibits().catch(() => router.replace('/admin/login'))
  }, [museumId, router, session])

  async function openMuseumQr() {
    if (!museumQr) {
      const qrRes = await adminFetch(`/admin/qr/museum/${museumId}`)
      setMuseumQr(qrRes?.museum_qr || null)
    }
    setShowQrModal(true)
  }

  async function toggleExhibitStatus(exhibit: ExhibitRecord) {
    const nextStatus = exhibit.status === 'published' ? 'draft' : 'published'
    try {
      await adminFetch(`/admin/exhibits/${exhibit.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      })
      await loadMuseumAndExhibits()
    } catch (error: unknown) {
      const message = extractApiError(error, tr)
      alert(message)
    }
  }

  async function deleteExhibit(exhibitId: string) {
    if (!confirm(tr('Delete this exhibit?', 'Delete this exhibit?'))) return
    await adminFetch(`/admin/exhibits/${exhibitId}`, { method: 'DELETE' })
    await loadMuseumAndExhibits()
  }

  return (
    <div style={{ flex: 1, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {museum?.logo_url ? (
              <img
                src={museum.logo_url}
                alt={museum?.name || museumId}
                style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'cover', background: 'rgba(255,255,255,0.08)' }}
              />
            ) : null}
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#C9A84C' }}>
              {museum?.name || museumId}
            </div>
            <button
              onClick={openMuseumQr}
              style={iconBtn(false)}
              title={tr('Museum entrance QR code', 'Museum entrance QR code')}
            >
              <FaQrcode size={16} />
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 4 }}>
            {museumId}
          </div>
          <div style={{ color: 'rgba(245,240,232,0.65)', fontSize: 13, marginTop: 6 }}>{museum?.address || ''}</div>
        </div>

        <button onClick={() => router.push(`/admin/exhibits/new?museum=${museumId}`)} style={btnPrimary}>
          + {tr('Add exhibit', 'Add exhibit')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
        <Stat title={tr('Exhibits', 'Exhibits')} value={exhibits.length} />
        <Stat title={tr('QR visits', 'QR visits')} value={museum?.total_visits || 0} />
        <Stat title={tr('Languages', 'Languages')} value={(museum?.supported_languages || []).length} />
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
          <div style={{ fontWeight: 600 }}>{tr('Exhibit list', 'Exhibit list')}</div>
        </div>

        <div style={tableHeader}>
          <div>{tr('Exhibit', 'Exhibit')}</div>
          <div>{tr('Status', 'Status')}</div>
          <div>{tr('Scans', 'Scans')}</div>
          <div>{tr('Created', 'Created')}</div>
          <div>{tr('Updated', 'Updated')}</div>
          <div style={{ textAlign: 'right' }}>{tr('Actions', 'Actions')}</div>
        </div>

        {exhibits.map((exhibit) => {
          const isActive = exhibit.status === 'published'
          return (
            <div key={exhibit.id} style={tableRow}>
              <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12, alignItems: 'center' }}>
                {(exhibit.primary_image_url || exhibit.image_url) ? (
                  <img
                    src={exhibit.primary_image_url || exhibit.image_url || ''}
                    alt={exhibit.name}
                    style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, background: '#111' }}
                  />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A84C' }}>
                    🏛
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 500 }}>{exhibit.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.65)' }}>
                    {typeof exhibit.location === 'object' ? exhibit.location?.hall : exhibit.location || '-'}
                  </div>
                </div>
              </div>
              <div>
                <span style={statusPill(isActive)}>
                  {isActive ? tr('Active', 'Active') : tr('Inactive', 'Inactive')}
                </span>
              </div>
              <div style={{ color: '#C9A84C', fontSize: 13 }}>{exhibit.total_scans || 0}</div>
              <div style={mutedCell}>{formatDate(exhibit.created_at)}</div>
              <div style={mutedCell}>{formatDate(exhibit.updated_at)}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <IconButton title={tr('Edit', 'Edit')} onClick={() => router.push(`/admin/exhibits/${exhibit.id}`)}>
                  <FaEdit size={14} />
                </IconButton>
                <IconButton
                  title={isActive ? tr('Set inactive', 'Set inactive') : tr('Set active', 'Set active')}
                  onClick={() => toggleExhibitStatus(exhibit)}
                >
                  <FaPowerOff size={14} />
                </IconButton>
                <IconButton title="QR Code" onClick={() => router.push(`/admin/exhibits/${exhibit.id}/qr`)}>
                  <FaQrcode size={14} />
                </IconButton>
                <IconButton title={tr('Delete', 'Delete')} danger onClick={() => deleteExhibit(exhibit.id)}>
                  <FaTrash size={14} />
                </IconButton>
              </div>
            </div>
          )
        })}
      </div>

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
                <span>{tr('Museum entrance QR', 'Museum entrance QR')}</span>
              </div>
              <button onClick={() => setShowQrModal(false)} style={{ ...modalBtn, width: 32, padding: 0 }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <img src={museumQr.qr_data_url} alt={`Museum QR ${museum?.name || museumId}`} style={{ width: 180, height: 180, background: '#fff', borderRadius: 8 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{tr('URL', 'URL')}</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, wordBreak: 'break-all', marginBottom: 12, color: 'rgba(245,240,232,0.86)' }}>
                  {museumQr.qr_url}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href={museumQr.qr_data_url} download={`museum-${museumId}.png`} style={{ ...modalBtn, textDecoration: 'none' }}>
                    <FaDownload size={12} /> PNG
                  </a>
                  <button onClick={() => navigator.clipboard.writeText(museumQr.qr_url)} style={modalBtn}>
                    <FaLink size={12} /> {tr('Copy link', 'Copy link')}
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

function extractApiError(error: unknown, tr: (vi: string, en: string) => string) {
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { message?: string; detail?: unknown }
    if (typeof maybe.message === 'string') return maybe.message
    if (typeof maybe.detail === 'string') return maybe.detail
    if (typeof maybe.detail === 'object' && maybe.detail !== null) {
      const detail = maybe.detail as { message?: string; missing?: string[]; knowledge_base_count?: number }
      if (detail.message) {
        const suffix = Array.isArray(detail.missing) && detail.missing.length
          ? `\n${tr('Missing:', 'Missing:')} ${detail.missing.join(', ')}`
          : typeof detail.knowledge_base_count === 'number'
            ? `\nKB: ${detail.knowledge_base_count}`
            : ''
        return `${detail.message}${suffix}`
      }
    }
  }
  return tr('Update failed', 'Update failed')
}

function formatDate(value: unknown): string {
  if (!value) return '-'
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
  }
  if (typeof value === 'object' && value !== null) {
    const maybeSeconds = (value as { seconds?: number }).seconds
    if (typeof maybeSeconds === 'number') {
      return new Date(maybeSeconds * 1000).toLocaleString()
    }
    const maybeAltSeconds = (value as { _seconds?: number })._seconds
    if (typeof maybeAltSeconds === 'number') {
      return new Date(maybeAltSeconds * 1000).toLocaleString()
    }
    const maybeDate = value as { toDate?: () => Date }
    if (typeof maybeDate.toDate === 'function') {
      return maybeDate.toDate().toLocaleString()
    }
  }
  return '-'
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
      <div style={{ color: 'rgba(245,240,232,0.6)', fontSize: 12 }}>{title}</div>
      <div style={{ color: '#C9A84C', fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function IconButton({
  children,
  title,
  onClick,
  danger = false,
}: {
  children: ReactNode
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button onClick={onClick} title={title} style={iconBtn(danger)}>
      {children}
    </button>
  )
}

function iconBtn(danger: boolean): CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: `1px solid ${danger ? 'rgba(248,113,113,0.28)' : 'rgba(255,255,255,0.14)'}`,
    background: danger ? 'rgba(127,29,29,0.3)' : 'rgba(255,255,255,0.04)',
    color: danger ? '#fca5a5' : '#F5F0E8',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
}

function statusPill(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    color: active ? '#86efac' : '#fcd34d',
    border: `1px solid ${active ? 'rgba(134,239,172,0.28)' : 'rgba(252,211,77,0.28)'}`,
    background: active ? 'rgba(22,101,52,0.18)' : 'rgba(133,77,14,0.18)',
  }
}

const card: CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14 }
const btnPrimary: CSSProperties = { padding: '10px 14px', borderRadius: 10, border: 'none', background: '#C9A84C', color: '#0A0A0A', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const modalBtn: CSSProperties = { padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#F5F0E8', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }
const tableHeader: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(280px,2fr) 110px 80px 150px 150px 180px', gap: 10, padding: '0 0 10px', color: 'rgba(245,240,232,0.55)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }
const tableRow: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(280px,2fr) 110px 80px 150px 150px 180px', gap: 10, alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 0' }
const mutedCell: CSSProperties = { fontSize: 12, color: 'rgba(245,240,232,0.65)' }
