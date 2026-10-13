import { afterEach, describe, expect, it, vi } from 'vitest'
import { api as webApi } from '../../apps/web/src/shared/api'
import { api as adminApi } from '../../apps/admin/src/shared/api'

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe.each([
  ['web', webApi],
  ['admin', adminApi],
])('%s api CSRF recovery', (_name, api) => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  it('renews a stale token once after 419 and retries the mutation', async () => {
    document.cookie = 'XSRF-TOKEN=stale; path=/'
    const calls: string[] = []
    const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
      const token = new Headers(init?.headers).get('X-CSRF-TOKEN')
      calls.push(`${path}:${token ?? ''}`)
      if (path === '/api/auth/csrf') {
        document.cookie = 'XSRF-TOKEN=fresh; path=/'
        return json(200, { data: { csrf_token: 'fresh' } })
      }
      return token === 'fresh' ? json(200, { data: { ok: true } }) : json(419, { message: 'x' })
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(api('/api/booking/bookings', { method: 'POST', body: '{}' })).resolves.toEqual({
      ok: true,
    })
    expect(calls).toEqual([
      '/api/booking/bookings:stale',
      '/api/auth/csrf:',
      '/api/booking/bookings:fresh',
    ])
  })

  it('does not loop when the retried request is rejected again', async () => {
    document.cookie = 'XSRF-TOKEN=stale; path=/'
    const fetchMock = vi.fn(async (path: string) =>
      path === '/api/auth/csrf' ? json(200, { data: { csrf_token: 'fresh' } }) : json(419, {}),
    )
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      api('/api/booking/bookings', { method: 'POST', body: '{}' }),
    ).rejects.toMatchObject({ status: 419 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
