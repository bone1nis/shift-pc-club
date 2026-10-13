import { ref } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Disclosure from './Disclosure.vue'
import Textarea from './Textarea.vue'

const meta: Meta = { title: 'SHIFT/Text content' }
export default meta
type Story = StoryObj

export const TextareaWithCounter: Story = {
  render: () => ({
    components: { Textarea },
    setup: () => ({ value: ref('Двадцать игровых мест в двух залах.') }),
    template:
      '<div style="max-width:32rem"><Textarea v-model="value" label="Описание" :maxlength="200" hint="Показывается на сайте" /></div>',
  }),
}
export const FaqDisclosures: Story = {
  render: () => ({
    components: { Disclosure },
    setup: () => ({ first: ref(true), second: ref(false) }),
    template:
      '<div style="max-width:40rem"><Disclosure v-model="first" title="Нужно ли платить при бронировании?">Нет, платите в клубе.</Disclosure><Disclosure v-model="second" title="Можно ли отменить бронь?">Да, до начала.</Disclosure></div>',
  }),
}
