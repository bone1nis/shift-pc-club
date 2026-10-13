<script setup lang="ts">
import { BookingPage } from '@fsd/pages/booking'
import { useHead } from '#imports'
useHead({
  title: 'Бронирование — SHIFT',
  meta: [
    {
      name: 'description',
      content: 'Выберите зал, дату и время и забронируйте игровые места в SHIFT.',
    },
  ],
})
</script>
<template><BookingPage /></template>
