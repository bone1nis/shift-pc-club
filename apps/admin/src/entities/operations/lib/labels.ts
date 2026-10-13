export type Tone = 'success' | 'warning' | 'neutral' | 'danger'

export const bookingLabel: Record<string, string> = {
  confirmed: 'Подтверждена',
  cancelled: 'Отменена',
  checked_in: 'В клубе',
  no_show: 'Неявка',
}
export const sessionLabel: Record<string, string> = {
  active: 'В игре',
  awaiting_checkout: 'Ожидает завершения',
  completed: 'Завершена',
}
export const statusTone = (status: string): Tone =>
  status === 'confirmed' || status === 'active'
    ? 'success'
    : status === 'cancelled' || status === 'completed'
      ? 'neutral'
      : 'warning'
