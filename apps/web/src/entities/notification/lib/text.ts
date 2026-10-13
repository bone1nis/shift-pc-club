import type { Notification } from '@shift/contracts'

/** Текст уведомления для кабинета; неизвестный тип показывается нейтрально, а не пустой строкой. */
export function notificationText(item: Pick<Notification, 'type' | 'data'>): string {
  const booking = item.data.booking_id === undefined ? 'Бронь' : `Бронь №${item.data.booking_id}`
  switch (item.type) {
    case 'booking.confirmed':
      return `${booking} подтверждена.`
    case 'booking.cancelled':
      return `${booking} отменена.`
    case 'booking.reminder':
      return `Напоминание: скоро ваш визит по брони №${item.data.booking_id ?? '—'}.`
    case 'booking.no_show':
      return `${booking} освобождена из-за неявки.`
    case 'session.ending':
      return 'Время игровой сессии скоро закончится.'
    default:
      return 'Новое уведомление от клуба.'
  }
}
