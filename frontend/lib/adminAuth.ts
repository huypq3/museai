import { getBackendUrl } from './constants'

function getBackendBase(): string {
  const backend = getBackendUrl()
  if (!backend) throw new Error('NEXT_PUBLIC_BACKEND_URL is not configured')
  return backend
}

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.href = '/admin/login'
  }
}

export type AdminRole = 'super_admin' | 'museum_admin'

export type AdminSession = {
  token?: string
  username?: string
  uid?: string
  role?: AdminRole
  museum_id?: string | null
  museum_name?: string | null
  exp?: number
}

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('admin_token')
}

export function setAdminToken(token: string) {
  localStorage.setItem('admin_token', token)
}

export function setAdminSession(session: AdminSession) {
  const { token, ...safeSession } = session || {}
  if (typeof window !== 'undefined') {
    localStorage.setItem('admin_session', JSON.stringify(safeSession))
    // Dual-mode auth: keep HttpOnly cookie as primary and Bearer token fallback
    // for deployments where cross-site cookies may be blocked.
    if (token) {
      localStorage.setItem('admin_token', token)
    } else {
      localStorage.removeItem('admin_token')
    }
  }
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

export async function hydrateAdminSessionFromCookie(): Promise<AdminSession | null> {
  try {
    const res = await fetch(`${getBackendBase()}/admin/auth/me`, {
      method: 'GET',
      credentials: 'include',
    })
    if (!res.ok) return null
    const session = (await res.json()) as AdminSession
    setAdminSession(session)
    return session
  } catch {
    return null
  }
}

export function clearAdminToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_session')
  }
}

export async function logoutAdmin(): Promise<void> {
  const legacyToken = getAdminToken()
  try {
    await fetch(`${getBackendBase()}/admin/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: legacyToken ? { Authorization: `Bearer ${legacyToken}` } : undefined,
    })
  } catch {
    // Best-effort logout; local state still gets cleared.
  }
  clearAdminToken()
}

export async function adminFetch(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const token = getAdminToken()
  let headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers = {
      ...headers,
      Authorization: `Bearer ${token}`,
    }
  }

  const res = await fetch(`${getBackendBase()}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })

  if (res.status === 401 || res.status === 403) {
    clearAdminToken()
    redirectToLogin()
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
  const formData = new FormData()
  formData.append('file', file)
  if (museumId) formData.append('museum_id', museumId)
  const res = await fetch(`${getBackendBase()}/admin/upload/image`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  })
  if (res.status === 401 || res.status === 403) {
    clearAdminToken()
    redirectToLogin()
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.url
}

export async function adminDownload(path: string, filename: string): Promise<void> {
  const token = getAdminToken()
  const res = await fetch(`${getBackendBase()}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (res.status === 401 || res.status === 403) {
    clearAdminToken()
    redirectToLogin()
    throw new Error('Unauthorized')
  }
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
