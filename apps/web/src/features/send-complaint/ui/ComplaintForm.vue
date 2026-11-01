<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { UiButton, UiCheckbox, UiNotice, UiSegmented, UiSelect, UiTextarea } from '@shift/ui'
import { bookingSchema } from '@shift/contracts'
import { z } from 'zod'
import { useUserStore } from '@fsd/entities/user'
import { apiParsed } from '@fsd/shared/api'
import { dateTime } from '@fsd/shared/format'
import {
  complaintCategories,
  complaintErrorMessage,
  loadOwnerKey,
  MAX_TEXT,
  OwnerKeyMissing,
  readSeenFingerprint,
  rememberFingerprint,
  submitComplaint,
  type OwnerKeyInfo,
} from '../model/complaint'

const user = useUserStore()
const key = ref<OwnerKeyInfo | null>(null)
const loadingKey = ref(true)
const missing = ref(false)
const loadError = ref('')
const keyChanged = ref(false)
const bookings = ref<{ value: number | string; label: string }[]>([])

const category = ref<string | null>(null)
const rating = ref(0)
const text = ref('')
const bookingId = ref<string | number>('')
const showName = ref(false)
const pending = ref(false)
const sent = ref(false)
const error = ref('')
const fieldErrors = ref<{ category?: string; rating?: string; text?: string }>({})

const ratingOptions = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))
const bookingOptions = computed(() => [{ value: '', label: 'Без привязки' }, ...bookings.value])

async function loadKey() {
  loadingKey.value = true
  loadError.value = ''
  missing.value = false
  try {
    key.value = await loadOwnerKey()
    const seen = readSeenFingerprint()
    keyChanged.value = seen !== null && seen !== key.value.fingerprint
    if (seen === null) rememberFingerprint(key.value.fingerprint)
  } catch (e) {
    if (e instanceof OwnerKeyMissing) missing.value = true
    else loadError.value = complaintErrorMessage(e)
  } finally {
    loadingKey.value = false
  }
}

/** Игрок прочитал предупреждение и принимает новый ключ: запоминаем его отпечаток. */
function acceptNewKey() {
  if (key.value) rememberFingerprint(key.value.fingerprint)
  keyChanged.value = false
}

async function loadBookings() {
  try {
    const list = await apiParsed(z.array(bookingSchema), '/api/booking/bookings')
    bookings.value = list.map((b) => ({
      value: b.id,
      label: `Бронь №${b.id} · ${dateTime(b.starts_at)}`,
    }))
  } catch {
    // Привязка необязательна: без списка броней форма всё равно работает.
  }
}

onMounted(() => {
  void loadKey()
  void loadBookings()
})

function validate(): boolean {
  const next: typeof fieldErrors.value = {}
  if (!category.value) next.category = 'Выберите категорию'
  if (!rating.value) next.rating = 'Поставьте оценку от 1 до 5'
  if (!text.value.trim()) next.text = 'Напишите, что случилось или что понравилось'
  fieldErrors.value = next
  return Object.keys(next).length === 0
}

async function send() {
  if (pending.value || !key.value || keyChanged.value || !validate()) return
  pending.value = true
  error.value = ''
  try {
    await submitComplaint(
      {
        category: category.value as string,
        rating: rating.value,
        text: text.value,
        bookingId: bookingId.value === '' ? null : Number(bookingId.value),
        showName: showName.value,
        name: user.user?.name,
      },
      key.value,
    )
    sent.value = true
    text.value = ''
    rememberFingerprint(key.value.fingerprint)
  } catch (e) {
    error.value = complaintErrorMessage(e)
  } finally {
    pending.value = false
  }
}

function again() {
  sent.value = false
  category.value = null
  rating.value = 0
  bookingId.value = ''
  showName.value = false
}
</script>

<template>
  <div class="complaint" aria-live="polite">
    <p v-if="loadingKey" role="status">Загружаем ключ владельца…</p>
    <UiNotice v-else-if="missing" tone="error">Владелец ещё не настроил приём жалоб.</UiNotice>
    <UiNotice v-else-if="loadError" tone="error">
      {{ loadError }} <UiButton variant="ghost" size="sm" @click="loadKey">Повторить</UiButton>
    </UiNotice>
    <UiNotice v-else-if="sent">
      Спасибо! Обращение зашифровано на вашем устройстве и отправлено владельцу. Прочитать его
      сможет только он.
      <UiButton variant="ghost" size="sm" @click="again">Отправить ещё одно</UiButton>
    </UiNotice>
    <form v-else-if="key" novalidate class="complaint__form" @submit.prevent="send">
      <UiNotice v-if="keyChanged" tone="error" role="alert">
        <strong>Ключ владельца изменился.</strong>
        Это бывает после смены ключа, но может быть и подменой. Сверьте новый отпечаток с владельцем
        другим способом, прежде чем отправлять обращение.
        <UiButton variant="secondary" size="sm" @click="acceptNewKey">
          Отпечаток сверен, продолжить
        </UiButton>
      </UiNotice>
      <div class="complaint__fingerprint">
        <span class="complaint__fingerprint-title">Отпечаток ключа владельца</span>
        <code data-testid="owner-fingerprint">{{ key.fingerprint }}</code>
        <p>
          Сверьте с владельцем, чтобы убедиться, что жалобу прочтёт только он. Текст шифруется в
          вашем браузере, сервер и администраторы видят только категорию и оценку.
        </p>
      </div>
      <UiSelect
        v-model="category"
        label="Категория"
        placeholder="Выберите категорию"
        :options="complaintCategories"
        :error="fieldErrors.category"
        required
      />
      <div>
        <UiSegmented v-model="rating" label="Оценка от 1 до 5" :options="ratingOptions" />
        <p v-if="fieldErrors.rating" class="complaint__error" role="alert">
          {{ fieldErrors.rating }}
        </p>
      </div>
      <UiTextarea
        v-model="text"
        label="Текст обращения"
        :maxlength="MAX_TEXT"
        :error="fieldErrors.text"
        required
      />
      <UiSelect
        v-model="bookingId"
        label="Бронь (необязательно)"
        :options="bookingOptions"
        hint="Привязка передаётся внутри шифртекста"
      />
      <UiCheckbox v-model="showName" label="Показать моё имя владельцу" />
      <UiNotice v-if="error" tone="error" role="alert">{{ error }}</UiNotice>
      <UiButton type="submit" :loading="pending" :disabled="keyChanged"
        >Отправить владельцу</UiButton
      >
    </form>
  </div>
</template>

<style scoped>
.complaint__form {
  display: grid;
  gap: 21px;
}
.complaint__fingerprint {
  display: grid;
  gap: 8px;
  font-size: var(--fs-13);
  color: var(--muted);
}
.complaint__fingerprint-title {
  font-weight: 700;
}
.complaint__fingerprint code {
  font-family: var(--font-mono, monospace);
  word-break: break-word;
  color: var(--text, inherit);
}
.complaint__error {
  color: var(--danger, #e5484d);
  font-size: var(--fs-13);
}
</style>
