import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
export function money(kopecks: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: kopecks % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(kopecks / 100)
}
const CLUB_TIME_ZONE = 'Europe/Moscow'
export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: CLUB_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
/** Время клуба в формате `YYYY-MM-DDTHH:mm`. */
export function clubDateTimeInput(date: Date): string {
  return format(new TZDate(date, CLUB_TIME_ZONE), "yyyy-MM-dd'T'HH:mm")
}
/** Переводит «настенное» время клуба в ISO-время UTC; null для некорректных значений. */
export function clubDateTimeToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ]
  // TZDate сам учитывает смещение пояса клуба; несуществующие даты (30 февраля) он «перекатывает», поэтому сверяем.
  const date = new TZDate(year, month - 1, day, hour, minute, CLUB_TIME_ZONE)
  const same =
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute
  return same ? new Date(date.getTime()).toISOString() : null
}
export function remaining(endsAt: string, now: number): string {
  const minutes = Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 60000))
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}
