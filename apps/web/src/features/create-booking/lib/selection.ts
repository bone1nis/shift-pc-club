import type { Catalog } from '@shift/contracts'
import { clubDateTimeToIso } from '@fsd/shared/format'
export function interval(
  start: string,
  hours: number,
): { starts_at: string; ends_at: string } | null {
  const startsAt = clubDateTimeToIso(start)
  if (!startsAt || !Number.isFinite(hours) || hours <= 0) return null
  const date = new Date(startsAt)
  return {
    starts_at: date.toISOString(),
    ends_at: new Date(date.getTime() + hours * 3600000).toISOString(),
  }
}
export function toggleSeat(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]
}
export function estimate(catalog: Catalog, ids: number[], hours: number): number {
  return ids.reduce((total, id) => {
    const seat = catalog.workstations.find((s) => s.id === id)
    const tariff = catalog.tariffs.find((t) => t.zone_id === seat?.zone_id)
    return total + (tariff?.hourly_price || 0) * hours
  }, 0)
}
