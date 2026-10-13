import { ref } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Checkbox from './Checkbox.vue'
import Segmented from './Segmented.vue'
import Switch from './Switch.vue'
import Tabs from './Tabs.vue'

const meta: Meta = { title: 'SHIFT/Choice controls' }
export default meta
type Story = StoryObj

export const CheckboxStates: Story = {
  render: () => ({
    components: { Checkbox },
    setup: () => ({ a: ref(true), b: ref(false) }),
    template:
      '<div style="display:grid;gap:1rem"><Checkbox v-model="a" label="PC-01" /><Checkbox v-model="b" label="PC-02" /><Checkbox :model-value="false" disabled label="PC-03 (обслуживание)" /></div>',
  }),
}
export const SwitchState: Story = {
  render: () => ({
    components: { Switch },
    setup: () => ({ on: ref(true) }),
    template: '<Switch v-model="on" label="Присылать напоминания" />',
  }),
}
export const SegmentedDuration: Story = {
  render: () => ({
    components: { Segmented },
    setup: () => ({
      value: ref(3),
      options: [1, 2, 3, 5].map((v) => ({ value: v, label: `${v} ч` })),
    }),
    template: '<Segmented v-model="value" label="Продолжительность" :options="options" />',
  }),
}
export const TabsUnderlineAndPills: Story = {
  render: () => ({
    components: { Tabs },
    setup: () => ({
      a: ref('login'),
      b: ref(1),
      authTabs: [
        { value: 'login', label: 'Вход' },
        { value: 'register', label: 'Регистрация' },
      ],
      zones: [
        { value: 1, label: 'Арена', hint: '16' },
        { value: 2, label: 'VIP', hint: '4' },
      ],
    }),
    template:
      '<div style="display:grid;gap:2rem"><Tabs v-model="a" :options="authTabs" label="Режим" /><Tabs v-model="b" variant="pills" :options="zones" label="Зал" /></div>',
  }),
}
