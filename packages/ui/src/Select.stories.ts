import { ref } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Select from './Select.vue'

const options = [
  { value: 1, label: 'PC-01' },
  { value: 2, label: 'PC-02' },
  { value: 3, label: 'PC-03 (обслуживание)', disabled: true },
  { value: 4, label: 'VIP-01' },
]
const meta: Meta<typeof Select> = { title: 'SHIFT/Select', component: Select }
export default meta
type Story = StoryObj<typeof Select>

const render: Story['render'] = (args) => ({
  components: { Select },
  setup: () => ({ args, value: ref<number | null>(args.modelValue as number | null) }),
  template: '<div style="max-width:20rem"><Select v-bind="args" v-model="value" /></div>',
})
export const Default: Story = { args: { label: 'Свободное место', options, modelValue: 1 }, render }
export const Empty: Story = {
  args: { label: 'Свободное место', options, modelValue: null },
  render,
}
export const WithError: Story = {
  args: { label: 'Свободное место', options, modelValue: null, error: 'Выберите место' },
  render,
}
export const Disabled: Story = {
  args: { label: 'Свободное место', options, modelValue: 2, disabled: true },
  render,
}
