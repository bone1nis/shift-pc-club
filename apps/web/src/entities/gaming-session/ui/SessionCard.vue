<script setup lang="ts">
import { UiStatus } from '@shift/ui'
import type { GamingSession } from '@shift/contracts'
import { dateTime, money, remaining } from '@fsd/shared/format'

defineProps<{ session: GamingSession; now: number }>()
</script>

<template>
  <article class="session-card" data-testid="session-card">
    <div class="session-card__row">
      <div>
        <span class="session-card__meta"
          >PC #{{ session.workstation_id }} / Сессия #{{ session.id }}</span
        >
        <p class="session-card__clock">{{ remaining(session.ends_at, now) }}</p>
        <p class="session-card__small">Осталось оплаченного времени</p>
      </div>
      <UiStatus :tone="session.status === 'active' ? 'success' : 'warning'">{{
        session.status === 'active' ? 'В игре' : 'Ожидает завершения'
      }}</UiStatus>
    </div>
    <hr class="session-card__divider" />
    <p class="session-card__line">
      Игра до {{ dateTime(session.ends_at) }} · {{ money(session.total_price) }}
    </p>
    <p class="session-card__small">
      Продлить время или сменить компьютер поможет администратор. Время учитывается сервером.
    </p>
  </article>
</template>

<style scoped>
.session-card {
  display: grid;
  gap: 8px;
  padding: 29px;
  background: linear-gradient(130deg, var(--olive-17), var(--olive-10));
  border: 1px solid var(--olive-31);
  border-radius: var(--radius);
}
.session-card__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}
.session-card__meta {
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--muted);
}
.session-card__clock {
  margin-top: 16px;
  font-family: var(--font-display);
  font-size: var(--fs-fluid-48-80);
  line-height: 1;
  color: var(--acid);
}
.session-card__divider {
  width: 100%;
  margin: 16px 0;
  border: 0;
  border-top: 1px solid var(--line);
}
.session-card__line {
  font-size: var(--fs-13);
}
.session-card__small {
  font-size: var(--fs-13);
  color: var(--muted);
}
@media (max-width: 700px) {
  .session-card {
    padding: 19px;
  }
  .session-card__row {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
