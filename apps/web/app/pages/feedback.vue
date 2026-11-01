<script setup lang="ts">
import { FeedbackPage } from '@fsd/pages/feedback'
import { definePageMeta, useHead } from '#imports'
definePageMeta({ path: '/account/feedback' })
useHead({
  title: 'Жалоба или отзыв — SHIFT',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>
<template><FeedbackPage /></template>
