<script setup lang="ts">
import { NuxtLink } from '#components'
import { UiButton } from '@shift/ui'

withDefaults(
  defineProps<{
    to: string
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'md' | 'sm'
    block?: boolean
  }>(),
  { variant: 'primary', size: 'md', block: false },
)
</script>

<template>
  <UiButton :as="NuxtLink" :to="to" :variant="variant" :size="size" :block="block"
    ><slot
  /></UiButton>
</template>
