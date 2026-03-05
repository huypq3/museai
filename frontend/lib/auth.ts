import {
  adminFetch,
  clearAdminToken as clearToken,
  getAdminSession,
  getAdminToken,
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
  const token = getAdminToken()
  if (!token) return null
  const session = getAdminSession()
  if (!session) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload?.exp && payload.exp * 1000 < Date.now()) {
      clearToken()
      return null
    }
  } catch {
    clearToken()
    return null
  }
  return session
}

export const isSuperAdmin = (): boolean => getCurrentUser()?.role === 'super_admin'

export const canAccessMuseum = (museumId: string): boolean => {
  const user = getCurrentUser()
  if (!user) return false
  if (user.role === 'super_admin') return true
  return user.museum_id === museumId
}

export { adminFetch, clearToken, saveToken, setAdminSession }
