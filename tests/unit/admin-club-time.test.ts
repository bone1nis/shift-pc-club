import { describe, expect, it } from 'vitest'
import { clubDateTimeInput, clubDateTimeToIso } from '../../apps/admin/src/shared/format'

describe('admin club time', () => {
  it('converts Moscow wall time to UTC and back independently of the browser timezone', () => {
    expect(clubDateTimeToIso('2026-10-15T18:30')).toBe('2026-10-15T15:30:00.000Z')
    expect(clubDateTimeInput(new Date('2026-10-15T15:30:00.000Z'))).toBe('2026-10-15T18:30')
  })

  it('rejects impossible or malformed wall times', () => {
    expect(clubDateTimeToIso('2026-02-30T10:00')).toBeNull()
    expect(clubDateTimeToIso('2026-10-15 18:30')).toBeNull()
    expect(clubDateTimeToIso('')).toBeNull()
  })
})
