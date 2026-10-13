import DefaultTheme from 'vitepress/theme'
import SwaggerViewer from './SwaggerViewer.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('SwaggerViewer', SwaggerViewer)
  },
}
