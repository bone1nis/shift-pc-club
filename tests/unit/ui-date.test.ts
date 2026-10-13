import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  formatDateTime,
  isoDate,
  monthGrid,
  parseDate,
  parseTime,
  timeSlots,
} from '../../packages/ui/src/lib/date'

describe('ui date helpers', () => {
  it('parses only real calendar dates', () => {
    expect(parseDate('2026-10-13')).toEqual({ year: 2026, month: 10, day: 13 })
    expect(parseDate('2026-02-30')).toBeNull()
    expect(parseDate('13.10.2026')).toBeNull()
    expect(parseTime('2026-10-13T17:30')).toEqual({ hours: 17, minutes: 30 })
    expect(parseTime('2026-10-13')).toBeNull()
  })

  it('moves across month and year boundaries', () => {
    expect(isoDate(addDays({ year: 2026, month: 12, day: 31 }, 1))).toBe('2027-01-01')
    expect(isoDate(addMonths({ year: 2026, month: 1, day: 31 }, 1))).toBe('2026-02-28')
    expect(isoDate(addMonths({ year: 2026, month: 1, day: 15 }, -1))).toBe('2025-12-15')
  })

  it('builds a six-week Monday-first grid', () => {
    const grid = monthGrid(2026, 10)
    expect(grid).toHaveLength(42)
    expect(isoDate(grid[0]!)).toBe('2026-09-28')
    expect(isoDate(grid[41]!)).toBe('2026-11-08')
  })

  it('lists time slots from a lower bound', () => {
    expect(timeSlots(30)).toHaveLength(48)
    expect(timeSlots(30, 17 * 60 + 30)[0]).toBe('17:30')
    expect(timeSlots(60, 23 * 60)).toEqual(['23:00'])
  })

  it('formats values in Russian', () => {
    expect(formatDateTime('2026-10-13T17:00')).toMatch(/13 окт\. 2026 г\., 17:00/)
    expect(formatDateTime('nonsense')).toBe('')
  })
})
