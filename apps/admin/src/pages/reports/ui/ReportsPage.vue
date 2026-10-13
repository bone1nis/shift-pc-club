<script setup lang="ts">
import { computed } from 'vue'
import {
  UiButton,
  UiDatePicker,
  UiEmpty,
  UiPanel,
  UiSelect,
  UiStatCard,
  UiStatus,
  UiTable,
} from '@shift/ui'
import { useOperationsStore } from '@fsd/entities/operations'
import { PayButton } from '@fsd/features/session-actions'
import { money } from '@fsd/shared/format'
import { StatGrid } from '@fsd/shared/ui'
import { useReports } from '../model/useReports'

const ops = useOperationsStore()
const reports = useReports()
const { report, exports, daily } = reports
const zoneOptions = computed(() => [
  { value: 0, label: 'Весь клуб' },
  ...(ops.catalog?.zones ?? []).map((zone) => ({ value: zone.id, label: zone.name })),
])
const unpaid = computed(() => ops.sessions.filter((s) => s.status === 'completed' && !s.paid_at))
const exportLabel = {
  pending: 'В очереди',
  processing: 'Формируется',
  ready: 'Готово',
  failed: 'Ошибка',
  expired: 'Срок хранения истёк',
} as const
const exportTone = (status: keyof typeof exportLabel) =>
  status === 'ready' ? 'success' : status === 'failed' ? 'danger' : 'neutral'
</script>

<template>
  <UiPanel title="Неотмеченные оплаты">
    <p class="reports__hint">
      Отмечайте оплату после фактического получения денег. Это внутренний учёт клуба.
    </p>
    <UiEmpty v-if="!unpaid.length">Все завершённые сессии оплачены.</UiEmpty>
    <ul class="reports__list">
      <li v-for="session in unpaid" :key="session.id">
        <span
          >Сессия №{{ session.id }} · PC #{{ session.workstation_id }} ·
          {{ money(session.total_price) }}</span
        >
        <PayButton :session="session" />
      </li>
    </ul>
  </UiPanel>

  <UiPanel title="Период отчёта">
    <form novalidate class="reports__period" @submit.prevent="reports.loadReport">
      <UiDatePicker v-model="reports.from.value" label="С даты" required />
      <UiDatePicker v-model="reports.to.value" label="По дату" :min="reports.from.value" required />
      <UiSelect v-model="reports.zone.value" label="Зона" :options="zoneOptions" />
      <UiButton type="submit" :disabled="ops.loading || ops.pending">Показать отчёт</UiButton>
    </form>
  </UiPanel>

  <StatGrid v-if="report" class="reports__stats">
    <UiStatCard label="Всего броней" :value="report.bookings" hint="включая отменённые" />
    <UiStatCard label="Подтверждены" :value="report.confirmed_bookings" hint="текущий статус" />
    <UiStatCard label="Отменены" :value="report.cancelled_bookings" hint="не входят в начисления" />
    <UiStatCard
      label="Неявки"
      :value="report.no_show_bookings"
      hint="место освобождено после ожидания"
    />
    <UiStatCard
      label="Активные сессии"
      :value="report.active_sessions"
      hint="с учётом ожидания checkout"
    />
    <UiStatCard
      label="Начислено"
      :value="money(report.earned_price)"
      hint="по завершённым сессиям"
    />
    <UiStatCard label="Ожидают обработки" :value="report.outbox_pending" hint="события outbox" />
    <UiStatCard
      label="Оплачено"
      :value="money(report.paid_price)"
      hint="по дате ручной отметки оплаты"
    />
    <UiStatCard
      label="Завершённые посещения ПК"
      :value="report.completed_sessions"
      hint="завершены за выбранный период"
    />
    <UiStatCard
      label="Загрузка мест"
      :value="`${report.occupancy_percent}%`"
      :hint="`${report.occupied_hours} ПК-часов фактической игры`"
    />
  </StatGrid>

  <UiPanel v-if="report" title="Воронка сайта за период">
    <StatGrid>
      <UiStatCard
        label="Просмотры страниц"
        :value="report.site_page_views"
        hint="события page_view"
      />
      <UiStatCard label="Визиты" :value="report.site_visits" hint="уникальные вкладки, не люди" />
      <UiStatCard
        label="Люди по дням"
        :value="report.site_people_daily_sum"
        hint="уникальные за день, суммой по дням"
      />
      <UiStatCard
        label="Начали бронировать"
        :value="report.site_booking_started"
        hint="выбрали первое место"
      />
      <UiStatCard
        label="Оформили бронь"
        :value="report.bookings"
        hint="по серверным данным, с учётом зоны"
      />
    </StatGrid>
    <p class="reports__hint">
      Статистика сайта общая для клуба, фильтр зоны на неё не влияет. Боты и повторы в течение 30
      минут не учитываются. «Люди по дням» считаются по хешу с суточной солью (IP и User-Agent не
      сохраняются), поэтому один человек в разные дни считается заново.
    </p>
  </UiPanel>

  <UiPanel eyebrow="Сводка на конец дня" title="Ежедневные сводки">
    <UiEmpty v-if="!daily.length"
      >Сводки появятся после завершения первого игрового дня клуба.</UiEmpty
    >
    <UiTable v-else label="Ежедневные сводки">
      <thead>
        <tr>
          <th>День</th>
          <th>Брони</th>
          <th>Отмены</th>
          <th>Неявки</th>
          <th>Посещения</th>
          <th>Начислено</th>
          <th>Оплачено</th>
          <th>Загрузка</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="day in daily" :key="day.date">
          <td>{{ day.date }}</td>
          <td>{{ day.club.bookings }}</td>
          <td>{{ day.club.cancelled_bookings }}</td>
          <td>{{ day.club.no_show_bookings }}</td>
          <td>{{ day.club.completed_sessions }}</td>
          <td>{{ money(day.club.earned_price) }}</td>
          <td>{{ money(day.club.paid_price) }}</td>
          <td>{{ day.club.occupancy_percent }}%</td>
        </tr>
      </tbody>
    </UiTable>
  </UiPanel>

  <UiPanel eyebrow="Показатели" title="Сводка клуба">
    <p class="reports__hint">
      Начисленная стоимость рассчитана по завершённым сессиям и не равна подтверждённой оплате.
      Оплата учитывается по дате отметки администратора. Даты включительно, в часовом поясе клуба.
      Брони считаются по началу, посещения и начисления — по завершению. Отменённые брони входят в
      число броней, но не в начисления. Загрузка рассчитана по фактическому времени игры и текущему
      числу ПК; будущие часы не учитываются. Активные сессии и outbox показывают состояние сейчас.
    </p>
    <div class="reports__actions">
      <UiButton variant="secondary" :disabled="ops.pending" @click="reports.loadReport"
        >Обновить сводку</UiButton
      >
      <UiButton variant="secondary" :disabled="ops.pending || !report" @click="reports.exportCsv"
        >Выгрузить CSV</UiButton
      >
    </div>
    <ul v-if="exports.length" class="reports__list">
      <li v-for="item in exports" :key="item.id">
        <span>{{ item.from }} — {{ item.to }}</span>
        <UiStatus :tone="exportTone(item.status)">{{ exportLabel[item.status] }}</UiStatus>
        <a
          v-if="item.status === 'ready'"
          class="reports__download"
          :href="`/api/booking/admin/report-exports/${item.id}/download`"
          >Скачать CSV</a
        >
        <span v-if="item.error" class="reports__error">{{ item.error }}</span>
      </li>
    </ul>
  </UiPanel>
</template>

<style scoped>
.reports__hint {
  font-size: var(--fs-14);
  color: var(--muted);
}
.reports__list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.reports__list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 0;
  border-top: 1px solid var(--line);
  font-size: var(--fs-14);
}
.reports__period {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 224px)) auto;
  gap: 16px;
  align-items: end;
}
.reports__period :deep(.button) {
  justify-self: start;
}
.reports__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.reports__download {
  color: var(--acid);
  font-weight: 700;
}
.reports__error {
  color: var(--danger);
}
@media (max-width: 760px) {
  .reports__period {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
