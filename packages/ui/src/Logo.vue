<script setup lang="ts">
withDefaults(defineProps<{ size?: 'md' | 'lg' }>(), { size: 'md' })
</script>

<template>
  <span class="logo" :class="`logo--${size}`"
    ><svg class="logo__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 21 21 3M8 3h13v13" />
    </svg>
    SHIFT<span class="logo__dot">.</span></span
  >
</template>

<style scoped>
.logo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-size: var(--fs-48);
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1;
}
.logo--md {
  font-size: var(--fs-32);
}
.logo--lg {
  font-size: var(--fs-48);
}
.logo__icon {
  width: 1em;
  height: 1em;
  flex: none;
  fill: none;
  stroke: var(--acid);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.logo__dot {
  color: var(--acid);
  margin-left: -0.3em;
}
@media (max-width: 760px) {
  .logo--lg {
    font-size: var(--fs-36);
  }
}
</style>
