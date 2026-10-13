<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { UiButton, UiField, UiNotice, UiPanel, UiTextarea } from '@shift/ui'
import type { ClubProfile } from '@shift/contracts'
import { useOperationsStore } from '@fsd/entities/operations'
import { ApiFailure, api } from '@fsd/shared/api'
import { useDraft } from '@fsd/shared/lib'

const ops = useOperationsStore()
const source = ref<ClubProfile | null>(null)
const draft = useDraft(() => ({
  name: source.value?.name ?? '',
  tagline: source.value?.tagline ?? '',
  description: source.value?.description ?? '',
  city: source.value?.city ?? '',
  address: source.value?.address ?? '',
  landmark: source.value?.landmark ?? '',
  phone: source.value?.phone ?? '',
  email: source.value?.email ?? '',
  latitude: String(source.value?.latitude ?? ''),
  longitude: String(source.value?.longitude ?? ''),
  hours: (source.value?.hours ?? []).map((row) => ({ ...row })),
}))
const fields = ref<Record<string, string[]>>({})

async function load() {
  try {
    source.value = await api<ClubProfile>('/api/club/profile')
  } catch (cause) {
    ops.fail(cause)
  }
}
onMounted(load)

function addRow() {
  if (draft.value.hours.length < 8) draft.value.hours.push({ label: '', value: '' })
}
function removeRow(index: number) {
  draft.value.hours.splice(index, 1)
}
async function save() {
  fields.value = {}
  const done = await ops.run(async () => {
    try {
      source.value = await api<ClubProfile>('/api/club/admin/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          ...draft.value,
          latitude: Number(draft.value.latitude),
          longitude: Number(draft.value.longitude),
        }),
      })
    } catch (cause) {
      if (cause instanceof ApiFailure) fields.value = cause.fields
      throw cause
    }
  }, 'Профиль клуба сохранён. Он сразу виден на сайте.')
  return done
}
const first = (key: string) => fields.value[key]?.[0]
</script>

<template>
  <UiPanel eyebrow="Контент сайта" title="Профиль клуба">
    <form v-if="source" novalidate class="profile" @submit.prevent="save">
      <div class="profile__grid">
        <UiField
          v-model="draft.name"
          label="Название"
          :maxlength="80"
          required
          :error="first('name')"
        />
        <UiField
          v-model="draft.tagline"
          label="Подпись"
          :maxlength="160"
          required
          :error="first('tagline')"
        />
      </div>
      <UiTextarea
        v-model="draft.description"
        label="Описание"
        :maxlength="2000"
        required
        :error="first('description')"
      />
      <div class="profile__grid">
        <UiField
          v-model="draft.city"
          label="Город"
          :maxlength="80"
          required
          :error="first('city')"
        />
        <UiField
          v-model="draft.address"
          label="Адрес"
          :maxlength="200"
          required
          :error="first('address')"
        />
      </div>
      <UiField
        v-model="draft.landmark"
        label="Как добраться"
        :maxlength="200"
        required
        :error="first('landmark')"
      />
      <div class="profile__grid">
        <UiField
          v-model="draft.phone"
          label="Телефон"
          :maxlength="32"
          required
          :error="first('phone')"
        />
        <UiField
          v-model="draft.email"
          type="email"
          label="Email"
          :maxlength="120"
          required
          :error="first('email')"
        />
      </div>
      <div class="profile__grid">
        <UiField
          v-model="draft.latitude"
          label="Широта"
          inputmode="decimal"
          required
          :error="first('latitude')"
        />
        <UiField
          v-model="draft.longitude"
          label="Долгота"
          inputmode="decimal"
          required
          :error="first('longitude')"
        />
      </div>
      <fieldset class="profile__hours">
        <legend>Часы работы</legend>
        <div v-for="(row, index) in draft.hours" :key="index" class="profile__row">
          <UiField
            v-model="row.label"
            :label="`Название строки ${index + 1}`"
            :maxlength="60"
            required
          />
          <UiField
            v-model="row.value"
            :label="`Значение строки ${index + 1}`"
            :maxlength="120"
            required
          />
          <UiButton
            variant="ghost"
            size="sm"
            :disabled="draft.hours.length === 1"
            :aria-label="`Удалить строку ${index + 1}`"
            @click="removeRow(index)"
            >Удалить</UiButton
          >
        </div>
        <UiButton variant="secondary" size="sm" :disabled="draft.hours.length >= 8" @click="addRow"
          >Добавить строку</UiButton
        >
        <UiNotice v-if="first('hours')" tone="error">{{ first('hours') }}</UiNotice>
      </fieldset>
      <UiButton type="submit" :loading="ops.pending">Сохранить профиль</UiButton>
    </form>
  </UiPanel>
</template>

<style scoped>
.profile {
  display: grid;
  gap: 19px;
}
.profile__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.profile__hours {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  border: 0;
}
.profile__hours legend {
  margin-bottom: 10px;
  padding: 0;
  font-size: var(--fs-13);
  font-weight: 600;
}
.profile__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
  gap: 13px;
  align-items: end;
}
@media (max-width: 760px) {
  .profile__grid,
  .profile__row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
