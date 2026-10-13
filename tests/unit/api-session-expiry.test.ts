import { afterEach, describe, expect, it, vi } from 'vitest'
import { api as webApi } from '../../apps/web/src/shared/api'
import { api as adminApi } from '../../apps/admin/src/shared/api'

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe.each([
  ['web', webApi, '/auth', '/account'],
  ['admin', adminApi, '/admin/login', '/admin/'],
])('%s session expiry', (_name, api, login, here) => {
  afterEach(() => vi.unstubAllGlobals())

  function stubWindow(pathname: string) {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { pathname, search: '?tab=1', assign } })
    return assign
  }

  it('sends the user to sign-in with a return path when refresh cannot renew the session', async () => {
    const assign = stubWindow(here)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(401, { message: 'Unauthenticated.' })),
    )
    await expect(api('/api/booking/bookings')).rejects.toMatchObject({ status: 401 })
    expect(assign).toHaveBeenCalledWith(`${login}?next=${encodeURIComponent(here + '?tab=1')}`)
  })

  it('does not redirect for the session probe or while already on the login page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(401)),
    )
    const probe = stubWindow(here)
    await expect(api('/api/auth/me')).rejects.toMatchObject({ status: 401 })
    expect(probe).not.toHaveBeenCalled()
    const onLogin = stubWindow(login)
    await expect(api('/api/booking/bookings')).rejects.toMatchObject({ status: 401 })
    expect(onLogin).not.toHaveBeenCalled()
  })
})
