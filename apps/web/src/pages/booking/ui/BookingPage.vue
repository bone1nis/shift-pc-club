<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { navigateTo, useRoute } from '#imports'
import { UiButton, UiEmpty, UiNotice, UiSeatMap, UiTabs } from '@shift/ui'
import { getCatalog, type Catalog } from '@fsd/entities/club'
import { useUserStore } from '@fsd/entities/user'
import {
  BookingControls,
  BookingSummary,
  SeatLegend,
  estimate,
  interval,
  useBookingSelection,
} from '@fsd/features/create-booking'
import { errorMessage } from '@fsd/shared/api'
import { clubDateTimeInput } from '@fsd/shared/format'
import { Container } from '@fsd/shared/ui'

const route = useRoute()
const user = useUserStore()
const catalog = ref<Catalog | null>(null)
const zone = ref(Number(route.query.zone) || 0)
const start = ref('')
const hours = ref(3)
const minimum = ref('')
const loadError = ref('')
const choice = useBookingSelection()
const { selected, loading, pending, error } = choice

const availability = (id: number) => choice.availability.value.find((a) => a.workstation_id === id)
const seats = computed(() =>
  (catalog.value?.workstations.filter((s) => s.zone_id === zone.value) || []).map((s) => ({
    id: s.id,
    label: s.name,
    x: s.x,
    y: s.y,
    selected: selected.value.includes(s.id),
    disabled:
      loading.value ||
      pending.value ||
      s.status === 'maintenance' ||
      !availability(s.id)?.available,
    state:
      s.status === 'maintenance'
        ? ('maintenance' as const)
        : availability(s.id)?.available
          ? ('free' as const)
          : ('busy' as const),
  })),
)
const zoneTabs = computed(() =>
  (catalog.value?.zones ?? []).map((z) => ({
    value: z.id,
    label: z.name,
    hint: String(catalog.value?.workstations.filter((s) => s.zone_id === z.id).length ?? 0),
  })),
)
const selectedSeats = computed(() =>
  selected.value.map((id) => {
    const seat = catalog.value?.workstations.find((s) => s.id === id)
    const hourly =
      catalog.value?.tariffs.find((t) => t.zone_id === seat?.zone_id)?.hourly_price ?? 0
    return { name: seat?.name ?? '', hourly, total: hourly * hours.value }
  }),
)
const total = computed(() =>
  catalog.value ? estimate(catalog.value, selected.value, hours.value) : 0,
)
const range = computed(() => interval(start.value, hours.value))

function defaultStart() {
  const date = new Date(Date.now() + 3600000)
  date.setMinutes(0, 0, 0)
  return clubDateTimeInput(date)
}
async function load() {
  loadError.value = ''
  try {
    catalog.value = await getCatalog()
    if (!catalog.value.zones.some((z) => z.id === zone.value))
      zone.value = catalog.value.zones[0]?.id || 0
    await choice.refresh(start.value, hours.value)
    const requested =
      typeof route.query.workstations === 'string'
        ? route.query.workstations.split(',').map(Number).filter(Number.isInteger)
        : []
    if (requested.length)
      choice.selectAvailable(
        requested.filter((id) =>
          catalog.value?.workstations.some((seat) => seat.id === id && seat.zone_id === zone.value),
        ),
      )
  } catch (e) {
    loadError.value = errorMessage(e)
  }
}
onMounted(async () => {
  start.value = defaultStart()
  minimum.value = clubDateTimeInput(new Date())
  await load()
})
watch([start, hours], () => {
  if (catalog.value) void choice.refresh(start.value, hours.value)
})
async function book() {
  if (!user.user) {
    await navigateTo('/auth?next=/booking')
    return
  }
  const result = await choice.submit(start.value, hours.value)
  if (result) await navigateTo('/account?booked=' + result.id)
}
</script>

<template>
  <Container>
    <section class="booking-page">
      <header class="booking-page__heading">
        <span class="booking-page__eyebrow">Booking / Собери свой сетап</span>
        <h1>Место для<br /><span>твоей игры.</span></h1>
        <p>
          Выбери время и места на схеме. Можно забронировать несколько компьютеров для всей команды.
        </p>
      </header>
      <UiNotice v-if="loadError" tone="error" class="booking-page__error">
        <p>{{ loadError }}</p>
        <UiButton variant="secondary" size="sm" @click="load">Повторить загрузку</UiButton>
      </UiNotice>
      <UiEmpty v-else-if="!catalog" role="status">Загружаем схему клуба…</UiEmpty>
      <div v-else class="booking-page__layout">
        <div class="booking-page__main">
          <BookingControls
            v-model:start="start"
            v-model:hours="hours"
            :minimum="minimum"
            :pending="pending"
          />
          <UiTabs
            v-model="zone"
            class="booking-page__zones"
            variant="pills"
            label="Выбор зала"
            :options="zoneTabs"
          />
          <SeatLegend :loading="loading" />
          <UiSeatMap
            :seats="seats"
            :label="catalog.zones.find((z) => z.id === zone)?.name"
            @select="choice.toggle"
          />
          <p class="booking-page__note">
            Доступность проверяется для выбранного времени. Бронь подтверждается только после ответа
            сервера.
          </p>
        </div>
        <BookingSummary
          :range="range"
          :hours="hours"
          :seats="selectedSeats"
          :total="total"
          :error="error"
          :pending="pending"
          :loading="loading"
          :signed-in="!!user.user"
          @book="book"
        />
      </div>
    </section>
  </Container>
</template>

<style scoped>
.booking-page {
  padding-top: 48px;
  padding-bottom: 80px;
}
.booking-page__heading {
  margin-bottom: 40px;
}
.booking-page__eyebrow {
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--acid);
}
.booking-page__heading h1 {
  font-size: var(--fs-80);
  margin-top: 16px;
}
.booking-page__heading h1 span {
  color: var(--acid);
}
.booking-page__heading p {
  margin-top: 16px;
  color: var(--muted);
  max-width: 608px;
  font-size: var(--fs-14);
}
.booking-page__error {
  display: grid;
  gap: 16px;
  justify-items: start;
}
.booking-page__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 352px);
  gap: 24px;
  align-items: start;
}
.booking-page__main {
  display: grid;
  gap: 19px;
  min-width: 0;
}
.booking-page__note {
  font-size: var(--fs-13);
  color: var(--muted);
}
@media (max-width: 1050px) {
  .booking-page__layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 304px);
  }
}
@media (max-width: 760px) {
  .booking-page {
    padding-top: 32px;
  }
  .booking-page__heading h1 {
    font-size: var(--fs-56);
  }
  .booking-page__layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
