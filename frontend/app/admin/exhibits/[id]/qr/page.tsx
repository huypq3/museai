'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import QRCode from 'qrcode'
import { adminFetch } from '@/lib/adminAuth'
import { useAdminI18n } from '@/lib/i18n/admin'

export default function ArtifactQRPage() {
  const router = useRouter()
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)
  const params = useParams()
  const artifactId = params.id as string
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [artifactName, setArtifactName] = useState('')
  const [museumId, setMuseumId] = useState('')
  const [url, setUrl] = useState('')

  useEffect(() => {
    loadArtifact()
  }, [])

  const loadArtifact = async () => {
    try {
      const data = await adminFetch(`/admin/exhibits/${artifactId}`)
      setArtifactName(data.name)
      setMuseumId(data.museum_id)
      
      // Generate URL
      const qrUrl = `${window.location.origin}/welcome?museum=${data.museum_id}&exhibit=${artifactId}`
      setUrl(qrUrl)
      
      // Generate QR code
      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, qrUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDownload = () => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.href = canvasRef.current.toDataURL('image/png')
    link.download = `qr-${artifactId}.png`
    link.click()
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    }}>
      <div style={{
        maxWidth: 400,
        width: '100%',
        textAlign: 'center',
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(245,240,232,0.5)',
            fontSize: 14,
            cursor: 'pointer',
            marginBottom: 24,
          }}
        >
          ← {tr('Quay lại', 'Back')}
        </button>

        <div style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 24,
          color: '#C9A84C',
          marginBottom: 8,
        }}>
          {tr('Mã QR', 'QR Code')}
        </div>

        <div style={{
          fontSize: 16,
          color: 'rgba(245,240,232,0.9)',
          marginBottom: 32,
        }}>
          {artifactName}
        </div>

        {/* QR Code on white background */}
        <div style={{
          background: '#ffffff',
          padding: 24,
          borderRadius: 16,
          display: 'inline-block',
          marginBottom: 24,
        }}>
          <canvas ref={canvasRef} />
        </div>

        {/* URL */}
        <div style={{
          fontSize: 11,
          color: 'rgba(245,240,232,0.4)',
          wordBreak: 'break-all',
          marginBottom: 24,
          fontFamily: 'monospace',
        }}>
          {url}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleDownload}
            style={{
              flex: 1,
              padding: '12px',
              background: '#C9A84C',
              border: 'none',
              borderRadius: 10,
              color: '#0A0A0A',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            📥 {tr('Tải PNG', 'Download PNG')}
          </button>
          <button
            onClick={() => router.back()}
            style={{
              flex: 1,
              padding: '12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: '#F5F0E8',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {tr('Đóng', 'Close')}
          </button>
        </div>
      </div>
    </div>
  )
}
