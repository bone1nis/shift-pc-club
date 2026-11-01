import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { configureRealtime } from '@shift/ui'
import '@shift/ui/tokens.css'

declare const __REVERB_APP_KEY__: string
configureRealtime({ key: __REVERB_APP_KEY__ })

createApp(App).use(createPinia()).use(router).mount('#app')
