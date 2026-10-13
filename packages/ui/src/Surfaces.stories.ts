import { ref } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Button from './Button.vue'
import Dialog from './Dialog.vue'
import Empty from './Empty.vue'
import Notice from './Notice.vue'
import Panel from './Panel.vue'
import SeatMap from './SeatMap.vue'
import StatCard from './StatCard.vue'
import Status from './Status.vue'

const meta: Meta = { title: 'SHIFT/Surfaces' }
export default meta
type Story = StoryObj

export const PanelWithActions: Story = {
  render: () => ({
    components: { Panel, Button, Empty },
    template:
      '<Panel eyebrow="Посещения" title="Бронирования"><template #actions><Button variant="secondary" size="sm">Обновить</Button></template><Empty>Подходящих броней нет.</Empty></Panel>',
  }),
}
export const Notices: Story = {
  render: () => ({
    components: { Notice },
    template:
      '<div style="display:grid;gap:1rem"><Notice>Бронь №12 подтверждена.</Notice><Notice tone="error">Не удалось выполнить запрос.</Notice></div>',
  }),
}
export const Stats: Story = {
  render: () => ({
    components: { StatCard },
    template:
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem"><StatCard label="Компьютеры" :value="20" suffix="/ 20" hint="доступно сейчас" /><StatCard label="Брони" :value="3" hint="ожидают посещения" /><StatCard label="Начислено" value="2 160 ₽" /></div>',
  }),
}
export const StatusTones: Story = {
  render: () => ({
    components: { Status },
    template:
      '<div style="display:flex;gap:.6rem"><Status tone="success">В игре</Status><Status tone="warning">Ожидает</Status><Status tone="danger">Ошибка</Status><Status>Отменена</Status></div>',
  }),
}
export const Seats: Story = {
  render: () => ({
    components: { SeatMap },
    setup: () => ({
      seats: [
        { id: 1, label: 'PC-01', x: 0, y: 0, state: 'free' as const },
        { id: 2, label: 'PC-02', x: 1, y: 0, state: 'free' as const, selected: true },
        { id: 3, label: 'PC-03', x: 2, y: 0, state: 'busy' as const, disabled: true },
        { id: 4, label: 'PC-04', x: 3, y: 0, state: 'maintenance' as const, disabled: true },
      ],
    }),
    template: '<SeatMap :seats="seats" label="Арена" />',
  }),
}
export const ConfirmDialog: Story = {
  render: () => ({
    components: { Dialog, Button },
    setup: () => ({ open: ref(true) }),
    template:
      '<div><Button @click="open = true">Отменить бронь</Button><Dialog v-model="open" title="Отменить бронь №12?" description="Места освободятся сразу."><template #actions><Button variant="ghost" @click="open = false">Оставить</Button><Button variant="danger" @click="open = false">Да, отменить</Button></template></Dialog></div>',
  }),
}
