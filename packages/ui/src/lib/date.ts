import { UTCDate } from '@date-fns/utc'
import { addDays as addDaysFns, addMonths as addMonthsFns, startOfISOWeek } from 'date-fns'

/** Дата без часового пояса: вся арифметика идёт по «настенному» времени в UTC-представлении. */
export interface DateParts {
  year: number
  month: number // 1–12
  day: number
}

const pad = (value: number) => String(value).padStart(2, '0')

export function parseDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  return check.getUTCFullYear() === parts.year &&
    check.getUTCMonth() === parts.month - 1 &&
    check.getUTCDate() === parts.day
    ? parts
    : null
}

export function parseTime(value: string): { hours: number; minutes: number } | null {
  const match = /T(\d{2}):(\d{2})/.exec(value)
  return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : null
}

export function isoDate(parts: DateParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function isoTime(hours: number, minutes: number): string {
  return `${pad(hours)}:${pad(minutes)}`
}

const toParts = (date: Date): DateParts => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
})

// UTCDate держит «настенную» дату без часового пояса: переход на летнее время не сдвигает дни.
export function addDays(parts: DateParts, days: number): DateParts {
  return toParts(addDaysFns(new UTCDate(parts.year, parts.month - 1, parts.day), days))
}

/** Сдвиг на месяцы; если в новом месяце меньше дней, берётся его последний день (31 января + 1 месяц = 28 февраля). */
export function addMonths(parts: DateParts, months: number): DateParts {
  return toParts(addMonthsFns(new UTCDate(parts.year, parts.month - 1, parts.day), months))
}

export function compareDates(a: DateParts, b: DateParts): number {
  return a.year - b.year || a.month - b.month || a.day - b.day
}

/** Сетка месяца из 6 недель, неделя начинается с понедельника. */
export function monthGrid(year: number, month: number): DateParts[] {
  const start = startOfISOWeek(new UTCDate(year, month - 1, 1))
  return Array.from({ length: 42 }, (_, index) => toParts(addDaysFns(start, index)))
}

const monthFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const dayFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const longDayFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const utc = (parts: DateParts) => new Date(Date.UTC(parts.year, parts.month - 1, parts.day))

export const formatMonth = (parts: DateParts) => monthFormatter.format(utc(parts))
export const formatDay = (parts: DateParts) => dayFormatter.format(utc(parts))
export const formatLongDay = (parts: DateParts) => longDayFormatter.format(utc(parts))
export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function formatDateTime(value: string): string {
  const date = parseDate(value)
  const time = parseTime(value)
  if (!date) return ''
  return time ? `${formatDay(date)}, ${isoTime(time.hours, time.minutes)}` : formatDay(date)
}

/** Время-слоты в пределах суток с шагом `step` минут, начиная не раньше `from` (минуты от полуночи). */
export function timeSlots(step: number, from = 0): string[] {
  const slots: string[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    if (minutes >= from) slots.push(isoTime(Math.floor(minutes / 60), minutes % 60))
  }
  return slots
}
