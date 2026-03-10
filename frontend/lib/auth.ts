import {
  adminFetch,
  clearAdminToken as clearToken,
  getAdminSession,
  hydrateAdminSessionFromCookie,
  setAdminSession,
  setAdminToken as saveToken,
} from './adminAuth'

export interface AdminUser {
  uid?: string
  username?: string
  role?: 'super_admin' | 'museum_admin'
  museum_id?: string | null
  museum_name?: string | null
}

export const getCurrentUser = (): AdminUser | null => {
  const session = getAdminSession()
  return session || null
}

export const isSuperAdmin = (): boolean => getCurrentUser()?.role === 'super_admin'

export const canAccessMuseum = (museumId: string): boolean => {
  const user = getCurrentUser()
  if (!user) return false
  if (user.role === 'super_admin') return true
  return user.museum_id === museumId
}

export { adminFetch, clearToken, saveToken, setAdminSession, hydrateAdminSessionFromCookie }
