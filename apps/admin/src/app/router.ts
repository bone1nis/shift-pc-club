import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@fsd/entities/user'
import { ClubPage } from '@fsd/pages/club'
import { AuditPage } from '@fsd/pages/audit'
import { LoginPage } from '@fsd/pages/auth'
import { EquipmentPage } from '@fsd/pages/equipment'
import { NotificationsPage } from '@fsd/pages/notifications'
import { ProcessingPage } from '@fsd/pages/processing'
import { ReportsPage } from '@fsd/pages/reports'
import { SchedulePage } from '@fsd/pages/schedule'
import { ShiftPage } from '@fsd/pages/shift'
import { TariffsPage } from '@fsd/pages/tariffs'
import { UsersPage } from '@fsd/pages/users'

export const router = createRouter({
  history: createWebHistory('/admin/'),
  routes: [
    { path: '/login', component: LoginPage },
    { path: '/', component: ShiftPage, meta: { title: 'Смена' } },
    { path: '/schedule', component: SchedulePage, meta: { title: 'Расписание' } },
    { path: '/equipment', component: EquipmentPage, meta: { title: 'Оборудование' } },
    { path: '/club', component: ClubPage, meta: { title: 'Профиль клуба' } },
    { path: '/tariffs', component: TariffsPage, meta: { title: 'Тарифы' } },
    { path: '/users', component: UsersPage, meta: { title: 'Посетители' } },
    { path: '/reports', component: ReportsPage, meta: { title: 'Отчёты' } },
    { path: '/notifications', component: NotificationsPage, meta: { title: 'Уведомления' } },
    { path: '/processing', component: ProcessingPage, meta: { title: 'Обработка' } },
    { path: '/audit', component: AuditPage, meta: { title: 'История действий' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
router.beforeEach(async (to) => {
  if (to.path === '/login') return
  const store = useUserStore()
  if (!store.loaded) await store.load()
  if (store.user?.role !== 'admin') return '/login'
})
