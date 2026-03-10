'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAdminSession, hydrateAdminSessionFromCookie } from '@/lib/adminAuth'

export default function AdminIndex() {
  const router = useRouter()
  
  useEffect(() => {
    const redirectBySession = (session: ReturnType<typeof getAdminSession>) => {
      if (session?.role === 'super_admin') {
        router.replace('/admin/dashboard')
      } else if (session?.role === 'museum_admin' && session?.museum_id) {
        router.replace(`/admin/museum/${session.museum_id}`)
      } else {
        router.replace('/admin/museums')
      }
    }

    const existing = getAdminSession()
    if (existing) {
      redirectBySession(existing)
      return
    }

    hydrateAdminSessionFromCookie()
      .then((session) => {
        if (!session) {
          router.replace('/admin/login')
          return
        }
        redirectBySession(session)
      })
      .catch(() => router.replace('/admin/login'))
  }, [router])
  
  return null
}
