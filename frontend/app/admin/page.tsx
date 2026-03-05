'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAdminSession, getAdminToken } from '@/lib/adminAuth'

export default function AdminIndex() {
  const router = useRouter()
  
  useEffect(() => {
    if (getAdminToken()) {
      const session = getAdminSession()
      if (session?.role === 'super_admin') {
        router.replace('/admin/dashboard')
      } else if (session?.role === 'museum_admin' && session?.museum_id) {
        router.replace(`/admin/museum/${session.museum_id}`)
      } else {
        router.replace('/admin/museums')
      }
    } else {
      router.replace('/admin/login')
    }
  }, [router])
  
  return null
}
