'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setAdminToken } from '@/lib/adminAuth'

export default function AdminLogin() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        }
      )
      if (!res.ok) throw new Error('Sai tên đăng nhập hoặc mật khẩu')
      const data = await res.json()
      setAdminToken(data.token)
      router.push('/admin/museums')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 360,
        padding: 40,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
      }}>
        {/* Logo */}
        <div style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 32,
          color: '#C9A84C',
          textAlign: 'center',
          marginBottom: 4,
        }}>
          MuseAI
        </div>
        <div style={{
          fontSize: 12,
          color: 'rgba(245,240,232,0.4)',
          textAlign: 'center',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: 32,
        }}>
          Admin Panel
        </div>

        {/* Username */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            fontSize: 12,
            color: 'rgba(245,240,232,0.5)',
            display: 'block',
            marginBottom: 6,
          }}>
            Tên đăng nhập
          </label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: '#F5F0E8',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            fontSize: 12,
            color: 'rgba(245,240,232,0.5)',
            display: 'block',
            marginBottom: 6,
          }}>
            Mật khẩu
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: '#F5F0E8',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div style={{
            color: '#f87171',
            fontSize: 13,
            marginBottom: 16,
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: '#C9A84C',
            color: '#0A0A0A',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </div>
    </div>
  )
}
