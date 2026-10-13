import { ref } from 'vue'
import { availabilitySchema, type Booking } from '@shift/contracts'
import type { Availability } from '@shift/contracts'
import { z } from 'zod'
import { track } from '@fsd/shared/analytics'
import { api, apiParsed, ApiFailure, errorMessage } from '@fsd/shared/api'
import { interval, toggleSeat } from '../lib/selection'
export function useBookingSelection() {
  const selected = ref<number[]>([]),
    availability = ref<Availability[]>([]),
    loading = ref(false),
    pending = ref(false),
    error = ref('')
  let sequence = 0,
    key = crypto.randomUUID()
  let started = false
  function toggle(id: number) {
    selected.value = toggleSeat(selected.value, id)
    if (!started && selected.value.length) {
      started = true
      track('booking_started', '/booking')
    }
    key = crypto.randomUUID()
  }
  async function refresh(start: string, hours: number) {
    const current = ++sequence
    const range = interval(start, hours)
    selected.value = []
    error.value = ''
    availability.value = []
    key = crypto.randomUUID()
    loading.value = false
    if (!range) return
    loading.value = true
    try {
      const data = await apiParsed(
        z.array(availabilitySchema),
        '/api/booking/availability?' + new URLSearchParams(range),
      )
      if (current === sequence) availability.value = data
    } catch (e) {
      if (current === sequence) error.value = errorMessage(e)
    } finally {
      if (current === sequence) loading.value = false
    }
  }
  async function submit(start: string, hours: number): Promise<Booking | null> {
    if (pending.value || !selected.value.length) return null
    const range = interval(start, hours)
    if (!range) return null
    pending.value = true
    error.value = ''
    try {
      return await api<Booking>('/api/booking/bookings', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({ ...range, workstation_ids: selected.value }),
      })
    } catch (e) {
      error.value = errorMessage(e)
      if (e instanceof ApiFailure && e.status === 409) {
        await refresh(start, hours)
        error.value = 'Одно из мест уже заняли. Схема обновлена — выберите места ещё раз.'
      }
      return null
    } finally {
      pending.value = false
    }
  }
  function selectAvailable(ids: number[]) {
    const available = new Set(
      availability.value.filter((item) => item.available).map((item) => item.workstation_id),
    )
    selected.value = [...new Set(ids)].filter((id) => available.has(id))
    key = crypto.randomUUID()
  }
  return {
    selected,
    availability,
    loading,
    pending,
    error,
    toggle,
    refresh,
    submit,
    selectAvailable,
  }
}
