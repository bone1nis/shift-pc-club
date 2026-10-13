import { ref } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Calendar from './Calendar.vue'
import DatePicker from './DatePicker.vue'
import DateTimePicker from './DateTimePicker.vue'

const meta: Meta = { title: 'SHIFT/Date and time pickers' }
export default meta
type Story = StoryObj

export const CalendarOnly: Story = {
  render: () => ({
    components: { Calendar },
    setup: () => ({ value: ref('2026-10-15') }),
    template: '<div style="max-width:20rem"><Calendar v-model="value" min="2026-10-10" /></div>',
  }),
}
export const DateField: Story = {
  render: () => ({
    components: { DatePicker },
    setup: () => ({ value: ref('2026-10-13') }),
    template: '<div style="max-width:20rem"><DatePicker v-model="value" label="С даты" /></div>',
  }),
}
export const DateTimeField: Story = {
  render: () => ({
    components: { DateTimePicker },
    setup: () => ({ value: ref('2026-10-15T18:30') }),
    template:
      '<div style="max-width:24rem"><DateTimePicker v-model="value" label="Когда играем?" min="2026-10-13T17:30" /></div>',
  }),
}
export const DateTimeEmpty: Story = {
  render: () => ({
    components: { DateTimePicker },
    setup: () => ({ value: ref('') }),
    template:
      '<div style="max-width:24rem"><DateTimePicker v-model="value" label="Начало" /></div>',
  }),
}
