export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'player'
}
export interface Zone {
  id: number
  name: string
  slug: string
  description: string
}
export interface Workstation {
  id: number
  zone_id: number
  name: string
  status: 'available' | 'maintenance'
  x: number
  y: number
  specs: { cpu: string; gpu: string; ram: string; monitor: string }
}
export interface Tariff {
  id: number
  zone_id: number
  name: string
  hourly_price: number
}
export interface Catalog {
  zones: Zone[]
  workstations: Workstation[]
  tariffs: Tariff[]
}
export interface BookingItem {
  id: number
  workstation_id: number
  hourly_price: number
  price: number
}
export interface Booking {
  id: number
  user_id: number
  status: 'confirmed' | 'cancelled' | 'checked_in' | 'no_show'
  starts_at: string
  ends_at: string
  total_price: number
  items: BookingItem[]
  created_at: string
}
export interface GamingSession {
  id: number
  booking_id: number | null
  user_id: number | null
  workstation_id: number
  status: 'active' | 'awaiting_checkout' | 'completed'
  starts_at: string
  ends_at: string
  total_price: number
  ended_at: string | null
  paid_at: string | null
}
export interface Availability {
  workstation_id: number
  available: boolean
}
/** Уведомление игроку (`GET /api/booking/notifications`). */
export interface Notification {
  id: number
  type: string
  data: { booking_id?: number; session_id?: number }
  delivery_status: string
  created_at: string
  sent_at: string | null
}
export interface ApiResponse<T> {
  data: T
}
export interface ApiError {
  message: string
  code?: string
  errors?: Record<string, string[]>
}
export type { IdentityApi, ClubApi, BookingApi } from './generated/api'
export interface ClubProfile {
  id: number
  name: string
  tagline: string
  description: string
  city: string
  address: string
  landmark: string
  phone: string
  email: string
  latitude: number
  longitude: number
  hours: Array<{ label: string; value: string }>
}
export * from './schemas'
