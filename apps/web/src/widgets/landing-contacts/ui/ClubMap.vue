<script setup lang="ts">
defineProps<{ address: string }>()
</script>

<template>
  <figure class="map">
    <svg viewBox="0 0 640 420" role="img" :aria-label="`Схема проезда: клуб SHIFT, ${address}`">
      <rect width="640" height="420" fill="var(--olive-7-b)" />
      <g stroke="var(--olive-13-a)" stroke-width="1">
        <path v-for="x in 12" :key="`v${x}`" :d="`M${x * 53} 0V420`" />
        <path v-for="y in 8" :key="`h${y}`" :d="`M0 ${y * 52}H640`" />
      </g>
      <path
        d="M-20 300 Q200 280 330 210 T660 120"
        stroke="var(--olive-17-a)"
        stroke-width="30"
        fill="none"
      />
      <path d="M120 -20 L220 440" stroke="var(--olive-17-a)" stroke-width="22" fill="none" />
      <path d="M-20 130 L660 170" stroke="var(--olive-17-a)" stroke-width="16" fill="none" />
      <path
        d="M-20 300 Q200 280 330 210 T660 120"
        stroke="var(--olive-23)"
        stroke-width="2"
        stroke-dasharray="10 12"
        fill="none"
      />
      <g fill="var(--olive-11)" stroke="var(--olive-18-a)">
        <rect x="260" y="40" width="120" height="70" rx="6" />
        <rect x="420" y="220" width="150" height="90" rx="6" />
        <rect x="40" y="200" width="90" height="120" rx="6" />
        <rect x="250" y="300" width="110" height="80" rx="6" />
      </g>
      <path
        d="M118 270 L240 215 L330 205"
        stroke="var(--acid)"
        stroke-width="4"
        stroke-dasharray="3 9"
        stroke-linecap="round"
        fill="none"
      />
      <g transform="translate(110 270)">
        <circle r="17" fill="var(--olive-14-a)" stroke="var(--acid)" stroke-width="2" />
        <text
          y="6"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-weight="700"
          font-size="17"
          fill="var(--acid)"
        >
          M
        </text>
      </g>
      <text x="62" y="312" font-family="Arial, sans-serif" font-size="13" fill="var(--muted)">
        Киберпарк
      </text>
      <g transform="translate(330 195)">
        <path d="M0 0 C-22 -26 -24 -48 0 -64 C24 -48 22 -26 0 0Z" fill="var(--acid)" />
        <circle cy="-40" r="9" fill="var(--acid-ink)" />
      </g>
      <text
        x="348"
        y="172"
        font-family="Arial, sans-serif"
        font-weight="700"
        font-size="15"
        fill="var(--text)"
      >
        SHIFT
      </text>
    </svg>
    <figcaption>Схема не в масштабе. Вход со двора, у вывески SHIFT.</figcaption>
  </figure>
</template>

<style scoped>
.map {
  margin: 0;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.map svg {
  display: block;
  width: 100%;
  height: auto;
}
.map figcaption {
  padding: 11px 16px;
  border-top: 1px solid var(--line);
  font-size: var(--fs-12);
  color: var(--muted);
}
</style>
