<script setup lang="ts">
import { InvitePage } from '@fsd/pages/invite'
import { useHead, useRoute } from '#imports'
useHead({ title: 'Приглашение — SHIFT', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
const token = String(useRoute().params.token ?? '')
</script>
<template><InvitePage :token="token" /></template>
