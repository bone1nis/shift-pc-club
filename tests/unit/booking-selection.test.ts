import { describe, expect, it, vi } from 'vitest'
import { useBookingSelection } from '../../apps/web/src/features/create-booking/model/selection'
import { interval, toggleSeat } from '../../apps/web/src/features/create-booking/lib/selection'
import { clubDateTimeInput, clubDateTimeToIso, dateTime } from '../../apps/web/src/shared/format'
import { money as webMoney } from '../../apps/web/src/shared/format'
import { money as adminMoney, dateTime as adminDateTime } from '../../apps/admin/src/shared/format'

describe('club-local booking time', () => {
  it('shows kopecks without rounding and formats admin times in the club timezone', () => {
    for (const money of [webMoney, adminMoney]) {
      expect(money(10050).replace(/\s+/g, ' ')).toBe('100,50 ₽')
      expect(money(18000).replace(/\s+/g, ' ')).toBe('180 ₽')
    }
    expect(adminDateTime('2026-10-12T23:00:00Z')).toContain('02:00')
  })
  it('converts Moscow wall time to UTC independently of the browser timezone', () => {
    expect(clubDateTimeToIso('2026-06-15T18:30')).toBe('2026-06-15T15:30:00.000Z')
    expect(interval('2026-06-15T18:30', 2)).toEqual({
      starts_at: '2026-06-15T15:30:00.000Z',
      ends_at: '2026-06-15T17:30:00.000Z',
    })
  })

  it('formats dates and datetime-local values in the club timezone', () => {
    const date = new Date('2026-06-15T15:30:00.000Z')
    expect(clubDateTimeInput(date)).toBe('2026-06-15T18:30')
    expect(dateTime(date.toISOString())).toContain('18:30')
  })

  it('rejects invalid wall times and invalid booking lengths', () => {
    expect(clubDateTimeToIso('2026-02-30T18:30')).toBeNull()
    expect(clubDateTimeToIso('2026-06-15T25:30')).toBeNull()
    expect(interval('2026-06-15T18:30', 0)).toBeNull()
  })
})

describe('seat selection', () => {
  it('stops loading when time is cleared during an availability request', async () => {
    let resolve!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done
          }),
      ),
    )
    try {
      const choice = useBookingSelection()
      const request = choice.refresh('2026-10-15T18:30', 1)
      expect(choice.loading.value).toBe(true)
      await choice.refresh('', 1)
      expect(choice.loading.value).toBe(false)
      resolve(new Response(JSON.stringify({ data: [{ workstation_id: 1, available: true }] })))
      await request
      expect(choice.availability.value).toEqual([])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('toggles one seat without mutating the previous selection', () => {
    const initial = [4, 7]
    expect(toggleSeat(initial, 7)).toEqual([4])
    expect(toggleSeat(initial, 9)).toEqual([4, 7, 9])
    expect(initial).toEqual([4, 7])
  })
})
