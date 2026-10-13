import { defineNuxtPlugin, useRouter } from '#imports'
import { track } from '@fsd/shared/analytics'

export default defineNuxtPlugin(() => {
  const router = useRouter()
  router.afterEach((to) => track('page_view', to.path))
})
