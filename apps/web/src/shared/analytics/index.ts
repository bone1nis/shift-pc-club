/**
 * Анонимная статистика сайта: просмотры страниц и начало бронирования.
 * Без cookie и персональных данных; идентификатор вкладки живёт только в sessionStorage.
 * Ошибки отправки никогда не мешают пользователю.
 */
export type SiteEvent = 'page_view' | 'booking_started'
const TRACKED_PATHS = new Set(['/', '/booking', '/auth', '/account'])
const STORAGE_KEY = 'shift-visitor'

function visitorId(): string {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) return stored
    const created = crypto.randomUUID()
    sessionStorage.setItem(STORAGE_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

export function track(type: SiteEvent, path = window.location.pathname): void {
  if (typeof window === 'undefined' || !TRACKED_PATHS.has(path)) return
  void fetch('/api/booking/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, path, visitor: visitorId() }),
    credentials: 'omit',
    keepalive: true,
  }).catch(() => undefined)
}
