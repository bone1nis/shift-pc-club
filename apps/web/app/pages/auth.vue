<script setup lang="ts">
import { AuthPage } from '@fsd/pages/auth'
import { useHead } from '#imports'
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>
<template><AuthPage /></template>
