'use client'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      color: '#F5F0E8',
      fontFamily: 'DM Sans, sans-serif',
      display: 'flex',
    }}>
      {children}
    </div>
  )
}
