import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Skeleton from './Skeleton.vue'
const meta: Meta<typeof Skeleton> = {
  title: 'SHIFT/Skeleton',
  component: Skeleton,
  args: { width: '240px', height: '32px' },
}
export default meta
type Story = StoryObj<typeof Skeleton>
export const Block: Story = {}
export const Circle: Story = { args: { shape: 'circle', width: '64px', height: '64px' } }
export const Text: Story = { args: { shape: 'text', width: '320px', height: '16px' } }
