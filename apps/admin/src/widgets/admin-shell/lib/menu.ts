import type { IconName } from '@shift/ui'
import { canUseComplaints } from '../../../shared/lib/role'

export type MenuLink = readonly [path: string, icon: IconName, label: string]

const common: ReadonlyArray<MenuLink> = [
  ['/', 'layout-dashboard', 'Смена'],
  ['/schedule', 'calendar-days', 'Расписание'],
  ['/equipment', 'cpu', 'Оборудование'],
  ['/tariffs', 'banknote', 'Тарифы'],
  ['/club', 'house', 'Профиль клуба'],
  ['/users', 'users', 'Посетители'],
  ['/reports', 'trending-up', 'Отчёты'],
  ['/notifications', 'mail', 'Уведомления'],
  ['/processing', 'settings', 'Обработка'],
  ['/audit', 'list', 'История действий'],
]

/** Пункты меню по роли: «Жалобы» видит только владелец. */
export function menuFor(role: string | null | undefined): ReadonlyArray<MenuLink> {
  return canUseComplaints(role) ? [...common, ['/complaints', 'triangle-alert', 'Жалобы']] : common
}
