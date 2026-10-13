<script setup lang="ts">
import { computed } from 'vue'
import { useOperationsStore } from '@fsd/entities/operations'
import { NewZoneForm, ZoneForm } from '@fsd/features/edit-zone'
import { TariffCard } from '@fsd/features/edit-tariff'

const ops = useOperationsStore()
const catalog = computed(() => ops.catalog!)
const zoneName = (id: number) => catalog.value.zones.find((zone) => zone.id === id)?.name || 'Зона'
</script>

<template>
  <template v-if="ops.catalog">
    <ZoneForm v-for="zone in catalog.zones" :key="zone.id" :zone="zone" />
    <div class="tariffs__grid">
      <TariffCard
        v-for="tariff in catalog.tariffs"
        :key="tariff.id"
        :tariff="tariff"
        :zone-name="zoneName(tariff.zone_id)"
      />
    </div>
    <NewZoneForm />
  </template>
</template>

<style scoped>
.tariffs__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));
  gap: 16px;
}
</style>
