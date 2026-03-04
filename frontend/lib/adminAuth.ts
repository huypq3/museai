const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('admin_token')
}

export function setAdminToken(token: string) {
  localStorage.setItem('admin_token', token)
}

export function clearAdminToken() {
  localStorage.removeItem('admin_token')
}

export async function adminFetch(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const token = getAdminToken()
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(`${BACKEND}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (res.status === 401) {
    clearAdminToken()
    window.location.href = '/admin/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function adminUpload(file: File): Promise<string> {
  const token = getAdminToken()
  if (!token) throw new Error('Not authenticated')
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BACKEND}/admin/upload/image`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.url
}
