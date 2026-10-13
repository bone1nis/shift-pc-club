<script setup lang="ts">
import { computed } from 'vue'
import { useHead } from '#imports'

const props = defineProps<{ error: { statusCode?: number; statusMessage?: string } }>()
const notFound = computed(() => props.error.statusCode === 404)
useHead({
  title: notFound.value ? 'Страница не найдена — SHIFT' : 'Что-то пошло не так — SHIFT',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <main class="error-page">
    <h1>{{ notFound ? 'Страница не найдена' : 'Что-то пошло не так' }}</h1>
    <p>
      {{
        notFound
          ? 'Такой страницы нет. Вернитесь на главную или перейдите к бронированию.'
          : 'Попробуйте обновить страницу. Если ошибка повторяется, зайдите позже.'
      }}
    </p>
    <p>
      <a href="/">На главную</a>
      ·
      <a href="/booking">Забронировать место</a>
    </p>
  </main>
</template>
