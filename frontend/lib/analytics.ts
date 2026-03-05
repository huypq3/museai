import { BACKEND_URL } from './constants'

function getSessionId() {
  if (typeof window === 'undefined') return 'server'
  const key = 'museai_session_id'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(key, id)
  return id
}

function getCurrentLanguage() {
  if (typeof window === 'undefined') return 'vi'
  return localStorage.getItem('language') || 'vi'
}

export const trackEvent = async (
  event_type: string,
  museum_id: string,
  artifact_id?: string,
  extra?: Record<string, unknown>
) => {
  try {
    await fetch(`${BACKEND_URL}/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type,
        museum_id,
        artifact_id,
        language: getCurrentLanguage(),
        timestamp: new Date().toISOString(),
        session_id: getSessionId(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        ...extra,
      }),
    })
  } catch {
    // best-effort
  }
}
