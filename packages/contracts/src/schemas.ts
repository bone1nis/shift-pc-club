import { z } from 'zod'
import type {
  Availability,
  Booking,
  BookingItem,
  Catalog,
  GamingSession,
  Notification,
  Tariff,
  User,
  Workstation,
  Zone,
} from './index'

/**
 * Схемы проверки ответов API (Zod). Типы в `index.ts` остаются источником для TypeScript, а схемы проверяют
 * в рантайме, что сервер вернул именно такие данные. Связь проверяется компилятором: `satisfies z.ZodType<…>`
 * не даст схеме разойтись с типом.
 */
const isoDate = z.string().min(1)

export const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'player']),
}) satisfies z.ZodType<User>

export const zoneSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
}) satisfies z.ZodType<Zone>

export const workstationSchema = z.object({
  id: z.number(),
  zone_id: z.number(),
  name: z.string(),
  status: z.enum(['available', 'maintenance']),
  x: z.number(),
  y: z.number(),
  specs: z.object({ cpu: z.string(), gpu: z.string(), ram: z.string(), monitor: z.string() }),
}) satisfies z.ZodType<Workstation>

export const tariffSchema = z.object({
  id: z.number(),
  zone_id: z.number(),
  name: z.string(),
  hourly_price: z.number(),
}) satisfies z.ZodType<Tariff>

export const catalogSchema = z.object({
  zones: z.array(zoneSchema),
  workstations: z.array(workstationSchema),
  tariffs: z.array(tariffSchema),
}) satisfies z.ZodType<Catalog>

const bookingItemSchema = z.object({
  id: z.number(),
  workstation_id: z.number(),
  hourly_price: z.number(),
  price: z.number(),
}) satisfies z.ZodType<BookingItem>

export const bookingSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  status: z.enum(['confirmed', 'cancelled', 'checked_in', 'no_show']),
  starts_at: isoDate,
  ends_at: isoDate,
  total_price: z.number(),
  items: z.array(bookingItemSchema),
  created_at: isoDate,
}) satisfies z.ZodType<Booking>

export const gamingSessionSchema = z.object({
  id: z.number(),
  booking_id: z.number().nullable(),
  user_id: z.number().nullable(),
  workstation_id: z.number(),
  status: z.enum(['active', 'awaiting_checkout', 'completed']),
  starts_at: isoDate,
  ends_at: isoDate,
  total_price: z.number(),
  ended_at: z.string().nullable(),
  paid_at: z.string().nullable(),
}) satisfies z.ZodType<GamingSession>

export const availabilitySchema = z.object({
  workstation_id: z.number(),
  available: z.boolean(),
}) satisfies z.ZodType<Availability>

/** Сеанс входа игрока (список устройств в кабинете). */
export const authSessionSchema = z.object({
  id: z.string(),
  created_at: isoDate,
  expires_at: isoDate,
  /** Сеанс этого устройства (в списке помечается, при отзыве выполняется выход). */
  current: z.boolean().optional(),
})

export const notificationSchema = z.object({
  id: z.number(),
  type: z.string(),
  data: z.object({ booking_id: z.number().optional(), session_id: z.number().optional() }),
  delivery_status: z.string(),
  created_at: isoDate,
  sent_at: z.string().nullable(),
}) satisfies z.ZodType<Notification>
