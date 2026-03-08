'use client'

import { useState, useRef } from 'react'
import { adminUpload } from '@/lib/adminAuth'

export default function ImageUpload({
  value,
  onChange,
  label = 'Image',
}: {
  value: string
  onChange: (url: string) => void
  label?: string
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const url = await adminUpload(file)
      onChange(url)
    } catch (e) {
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        fontSize: 12,
        color: 'rgba(245,240,232,0.5)',
        display: 'block',
        marginBottom: 8,
      }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Preview */}
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 10,
          overflow: 'hidden',
          flexShrink: 0,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {value ? (
            <img
              src={value}
              alt="Preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <span style={{ fontSize: 24, opacity: 0.3 }}>🖼️</span>
          )}
        </div>

        <div style={{ flex: 1 }}>
          {/* URL input */}
          <input
            placeholder="Image URL or upload..."
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#F5F0E8',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: 8,
            }}
          />
          {/* Upload button */}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '6px 14px',
              background: 'rgba(201,168,76,0.15)',
              border: '1px solid rgba(201,168,76,0.3)',
              borderRadius: 8,
              color: '#C9A84C',
              fontSize: 12,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'Uploading...' : '📁 Upload image'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      </div>
    </div>
  )
}
