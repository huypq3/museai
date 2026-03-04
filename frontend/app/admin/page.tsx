'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAdminToken } from '@/lib/adminAuth'

export default function AdminIndex() {
  const router = useRouter()
  
  useEffect(() => {
    if (getAdminToken()) {
      router.replace('/admin/museums')
    } else {
      router.replace('/admin/login')
    }
  }, [router])
  
  return null
}
