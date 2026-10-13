import { afterEach, describe, expect, it, vi } from 'vitest'
import { track } from '../../apps/web/src/shared/analytics'

describe('site analytics', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('sends an anonymous event with a stable per-tab visitor id and no credentials', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    track('page_view', '/booking')
    track('page_view', '/auth')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/booking/events')
    expect(init.credentials).toBe('omit')
    const first = JSON.parse(init.body as string)
    const second = JSON.parse(
      (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(first).toMatchObject({ type: 'page_view', path: '/booking' })
    expect(first.visitor).toBe(second.visitor)
  })

  it('ignores untracked paths and never throws on network failure', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('offline')
    })
    vi.stubGlobal('fetch', fetchMock)
    track('page_view', '/admin/secret')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(() => track('page_view', '/')).not.toThrow()
    await Promise.resolve()
  })
})
