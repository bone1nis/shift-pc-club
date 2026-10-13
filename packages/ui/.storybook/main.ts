import type { StorybookConfig } from '@storybook/vue3-vite'
import vue from '@vitejs/plugin-vue'
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-a11y'],
  framework: '@storybook/vue3-vite',
  // В корне staticDirs лежит favicon.svg: Storybook берёт его иконкой каталога.
  staticDirs: ['../public'],
  async viteFinal(viteConfig) {
    const hasVue = viteConfig.plugins
      ?.flat()
      .some((plugin) => plugin && 'name' in plugin && plugin.name === 'vite:vue')
    if (!hasVue) viteConfig.plugins = [...(viteConfig.plugins ?? []), vue()]
    return viteConfig
  },
}
export default config
