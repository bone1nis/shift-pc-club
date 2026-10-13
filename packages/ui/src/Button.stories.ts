import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Button from './Button.vue'
const meta: Meta<typeof Button> = {
  title: 'SHIFT/Button',
  component: Button,
  args: { default: 'Забронировать место', variant: 'primary' },
}
export default meta
type Story = StoryObj<typeof Button>
export const Primary: Story = {}
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Loading: Story = { args: { loading: true } }
export const Disabled: Story = { args: { disabled: true } }
export const Danger: Story = { args: { variant: 'danger', default: 'Завершить сессию' } }
