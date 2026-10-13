import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Field from './Field.vue'
const meta: Meta<typeof Field> = {
  title: 'SHIFT/Field',
  component: Field,
  args: { id: 'email', label: 'Электронная почта', modelValue: '', type: 'email' },
}
export default meta
type Story = StoryObj<typeof Field>
export const Default: Story = {}
export const Invalid: Story = { args: { modelValue: 'player', error: 'Введите корректный email' } }
