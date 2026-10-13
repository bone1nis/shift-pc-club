import '../src/tokens.css'
import type { Preview } from '@storybook/vue3-vite'
const preview: Preview = {
  parameters: {
    backgrounds: { options: { dark: { name: 'SHIFT', value: '#111212' } } },
    a11y: { test: 'error' },
  },
  initialGlobals: { backgrounds: { value: 'dark' } },
}
export default preview
