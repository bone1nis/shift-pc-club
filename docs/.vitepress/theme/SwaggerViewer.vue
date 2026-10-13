<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = defineProps<{ service: 'identity' | 'club' | 'booking' }>()
const target = ref<HTMLDivElement>()
const error = ref('')
type SwaggerUiConfig = {
  url: string
  domNode: HTMLDivElement | undefined
  deepLinking: boolean
  displayRequestDuration: boolean
  persistAuthorization: boolean
  tryItOutEnabled: boolean
}
type SwaggerBrowser = typeof globalThis & {
  SwaggerUIBundle?: (config: SwaggerUiConfig) => unknown
}

onMounted(async () => {
  const base = '/docs/swagger-ui/'
  const browser = globalThis as SwaggerBrowser
  if (!browser.document.querySelector(`link[href="${base}swagger-ui.css"]`)) {
    const link = browser.document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `${base}swagger-ui.css`
    browser.document.head.append(link)
  }
  try {
    if (!browser.SwaggerUIBundle) {
      await new Promise<void>((resolve, reject) => {
        const script = browser.document.createElement('script')
        script.src = `${base}swagger-ui-bundle.js`
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Swagger UI assets could not be loaded.'))
        browser.document.head.append(script)
      })
    }
    const specPath = props.service === 'identity' ? 'auth' : props.service
    const config = {
      url: `/api/${specPath}/openapi.json`,
      domNode: target.value,
      deepLinking: true,
      displayRequestDuration: true,
      persistAuthorization: false,
      tryItOutEnabled: true,
    }
    browser.SwaggerUIBundle?.(config)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось загрузить Swagger UI.'
  }
})
</script>

<template>
  <p v-if="error" role="alert">
    {{ error }} Проверьте, что API-сервис и его OpenAPI endpoint запущены.
  </p>
  <div ref="target" class="swagger-viewer" />
</template>
