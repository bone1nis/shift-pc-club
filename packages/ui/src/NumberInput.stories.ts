import { ref } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import NumberInput from './NumberInput.vue'

const meta: Meta<typeof NumberInput> = { title: 'SHIFT/NumberInput', component: NumberInput }
export default meta
type Story = StoryObj<typeof NumberInput>

const render: Story['render'] = (args) => ({
  components: { NumberInput },
  setup: () => ({ args, value: ref(args.modelValue as number) }),
  template: '<div style="max-width:14rem"><NumberInput v-bind="args" v-model="value" /></div>',
})
export const Hours: Story = { args: { label: 'Часов', modelValue: 2, min: 1, max: 12 }, render }
export const Minutes: Story = {
  args: { label: 'Продлить на, минут', modelValue: 60, min: 30, max: 720, step: 30, suffix: 'мин' },
  render,
}
export const Invalid: Story = {
  args: { label: 'Цена, ₽', modelValue: 0, min: 1, error: 'Минимум 1 ₽' },
  render,
}
