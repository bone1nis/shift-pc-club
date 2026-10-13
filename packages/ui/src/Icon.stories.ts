import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Icon from './Icon.vue'
import { icons, type IconName } from './icons/data'

const meta: Meta<typeof Icon> = {
  title: 'SHIFT/Icon',
  component: Icon,
  args: { name: 'arrow-up-right', size: '2rem', stroke: 2 },
  argTypes: { name: { control: 'select', options: Object.keys(icons) } },
}
export default meta
type Story = StoryObj<typeof Icon>
export const Single: Story = {}

/** Все иконки набора: имя для `<UiIcon name="…" />` написано под значком. */
export const Catalog: Story = {
  render: () => ({
    components: { Icon },
    setup: () => ({ names: Object.keys(icons) as IconName[] }),
    template: `<ul style="display:grid;grid-template-columns:repeat(auto-fill,minmax(8rem,1fr));gap:1rem;list-style:none;padding:0">
      <li v-for="name in names" :key="name" style="display:grid;justify-items:center;gap:.5rem;font-size:.7rem;color:var(--muted)">
        <Icon :name="name" size="1.6rem" style="color:var(--acid)" />{{ name }}
      </li>
    </ul>`,
  }),
}
