import { describe, expect, it } from 'vitest'
import { notificationText } from '../../apps/web/src/entities/notification/lib/text'

describe('notificationText', () => {
  it('подставляет номер брони в понятный текст', () => {
    expect(notificationText({ type: 'booking.confirmed', data: { booking_id: 29 } })).toBe(
      'Бронь №29 подтверждена.',
    )
    expect(notificationText({ type: 'booking.cancelled', data: { booking_id: 2 } })).toBe(
      'Бронь №2 отменена.',
    )
    expect(notificationText({ type: 'booking.no_show', data: { booking_id: 26 } })).toContain(
      'неявки',
    )
  })

  it('пишет напоминание и окончание сессии без номера', () => {
    expect(notificationText({ type: 'booking.reminder', data: { booking_id: 41 } })).toBe(
      'Напоминание: скоро ваш визит по брони №41.',
    )
    expect(notificationText({ type: 'session.ending', data: { session_id: 15 } })).toBe(
      'Время игровой сессии скоро закончится.',
    )
  })

  it('не падает на неизвестном типе и пустых данных', () => {
    expect(notificationText({ type: 'booking.something', data: {} })).toBe(
      'Новое уведомление от клуба.',
    )
    expect(notificationText({ type: 'booking.confirmed', data: {} })).toBe('Бронь подтверждена.')
  })
})
