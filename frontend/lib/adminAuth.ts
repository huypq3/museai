import { getBackendUrl } from './constants'

function getBackendBase(): string {
  const backend = getBackendUrl()
  if (!backend) throw new Error('NEXT_PUBLIC_BACKEND_URL is not configured')
  return backend
}

export type AdminRole = 'super_admin' | 'museum_admin'

export type AdminSession = {
  token: string
  username?: string
  uid?: string
  role?: AdminRole
  museum_id?: string | null
  museum_name?: string | null
}

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('admin_token')
}

export function setAdminToken(token: string) {
  localStorage.setItem('admin_token', token)
}

export function setAdminSession(session: AdminSession) {
  setAdminToken(session.token)
  localStorage.setItem('admin_session', JSON.stringify(session))
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('admin_session')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminSession
  } catch {
    return null
  }
}

export function clearAdminToken() {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_session')
}

export async function adminFetch(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const token = getAdminToken()
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(`${getBackendBase()}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (res.status === 401 || res.status === 403) {
    clearAdminToken()
    window.location.href = '/admin/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function getAdminRole(): AdminRole | null {
  return (getAdminSession()?.role as AdminRole | undefined) || null
}

export function getAdminMuseumId(): string | null {
  return getAdminSession()?.museum_id || null
}

export async function adminUpload(file: File, museumId?: string): Promise<string> {
  const token = getAdminToken()
  if (!token) throw new Error('Not authenticated')
  const formData = new FormData()
  formData.append('file', file)
  if (museumId) formData.append('museum_id', museumId)
  const res = await fetch(`${getBackendBase()}/admin/upload/image`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.url
}


export async function adminDownload(path: string, filename: string): Promise<void> {
  const token = getAdminToken()
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(`${getBackendBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
