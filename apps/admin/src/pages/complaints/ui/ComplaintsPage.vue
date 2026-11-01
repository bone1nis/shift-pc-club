<script setup lang="ts">
import { ref } from 'vue'
import {
  UiButton,
  UiCheckbox,
  UiDialog,
  UiEmpty,
  UiField,
  UiNotice,
  UiPanel,
  UiSegmented,
  UiStatus,
  UiTable,
} from '@shift/ui'
import { dateTime } from '@fsd/shared/format'
import { formatRecoveryCode } from '@shift/e2ee'
import { useComplaints } from '../model/useComplaints'
import type { ComplaintStatus } from '../lib/complaintsService'

const c = useComplaints()

const categories: Record<string, string> = {
  staff: 'Сотрудники',
  equipment: 'Оборудование',
  service: 'Обслуживание',
  booking: 'Бронирование',
  review: 'Отзыв',
  other: 'Другое',
}
const statusLabels: Record<ComplaintStatus, string> = {
  new: 'Новая',
  read: 'Прочитана',
  closed: 'Закрыта',
}
const tones = { new: 'warning', read: 'neutral', closed: 'success' } as const
const filters = [
  { value: '', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'read', label: 'Прочитанные' },
  { value: 'closed', label: 'Закрытые' },
]

const written = ref(false)
const copied = ref(false)
const code = ref('')
const confirmRotate = ref(false)
const confirmLost = ref(false)

async function copy() {
  const text = c.prepared.value?.code
  if (!text) return
  try {
    await navigator.clipboard.writeText(formatRecoveryCode(text))
    copied.value = true
  } catch {
    copied.value = false
  }
}
async function begin(rotate: boolean) {
  written.value = false
  copied.value = false
  confirmRotate.value = false
  confirmLost.value = false
  await c.startSetup(rotate)
}
function cancel() {
  written.value = false
  c.cancelSetup()
}
async function submitRestore() {
  if (await c.restore(code.value)) code.value = ''
}
</script>

<template>
  <div class="complaints">
    <UiNotice v-if="c.error.value" tone="error" role="alert">{{ c.error.value }}</UiNotice>

    <UiEmpty v-if="c.screen.value === 'loading'" role="status">Проверяем ключ владельца…</UiEmpty>

    <!-- Мастер настройки (первый вход) и смена ключа -->
    <UiPanel
      v-else-if="c.screen.value === 'setup'"
      eyebrow="Шаг настройки"
      :title="c.rotating.value ? 'Новый ключ владельца' : 'Настройка ключа владельца'"
    >
      <template v-if="!c.prepared.value">
        <p>
          Жалобы шифруются в браузере игрока под ваш ключ. Администраторы и технический персонал
          прочитать их не смогут. Приватный ключ хранится только в этом браузере, а копия для
          восстановления лежит на сервере в зашифрованном виде и открывается кодом, который увидите
          только вы.
        </p>
        <UiButton :loading="c.busy.value" @click="begin(false)">Создать ключ</UiButton>
      </template>
      <template v-else>
        <UiNotice>
          Запишите код восстановления на бумагу и спрячьте. Он показывается один раз. Без него и без
          этого браузера жалобы не прочитать: сервер помочь не сможет.
        </UiNotice>
        <p class="complaints__code" data-testid="recovery-code">
          {{ formatRecoveryCode(c.prepared.value.code) }}
        </p>
        <div class="complaints__row">
          <UiButton variant="secondary" size="sm" @click="copy">Скопировать код</UiButton>
          <span v-if="copied" role="status">Код скопирован</span>
        </div>
        <UiCheckbox v-model="written" label="Я записал код восстановления" />
        <div class="complaints__row">
          <UiButton :disabled="!written" :loading="c.busy.value" @click="c.finishSetup">
            Завершить настройку
          </UiButton>
          <UiButton v-if="c.rotating.value" variant="ghost" @click="cancel">Отмена</UiButton>
        </div>
      </template>
    </UiPanel>

    <!-- Ключ есть на сервере, но не на этом устройстве -->
    <UiPanel
      v-else-if="c.screen.value === 'restore'"
      eyebrow="Новое устройство"
      title="Восстановить ключ"
    >
      <p>
        Ключ владельца уже создан, но в этом браузере его нет. Введите код восстановления, который
        вы записали при настройке.
      </p>
      <form class="complaints__form" @submit.prevent="submitRestore">
        <UiField
          v-model="code"
          label="Код восстановления"
          autocomplete="off"
          hint="32 символа, дефисы и пробелы не важны"
          required
        />
        <UiButton type="submit" :loading="c.busy.value" :disabled="!code.trim()">
          Восстановить
        </UiButton>
      </form>
      <section class="complaints__lost">
        <h3>Не помню код</h3>
        <UiNotice tone="error">
          Жалобы, зашифрованные прежним ключом, прочитать будет нельзя. Новые жалобы пойдут под
          новый ключ.
        </UiNotice>
        <UiCheckbox v-model="confirmLost" label="Понимаю, что старые жалобы станут недоступны" />
        <UiButton
          variant="secondary"
          :disabled="!confirmLost"
          :loading="c.busy.value"
          @click="begin(true)"
        >
          Не помню код — создать новый ключ
        </UiButton>
      </section>
    </UiPanel>

    <template v-else>
      <UiPanel eyebrow="Для игроков" title="Отпечаток ключа владельца">
        <template v-if="c.fingerprint.value">
          <p class="complaints__code" data-testid="fingerprint">{{ c.fingerprint.value }}</p>
          <p class="complaints__muted">
            Сообщите эти цифры игрокам лично или вывесите в клубе. В форме жалобы игрок видит такой
            же отпечаток и может убедиться, что его жалоба зашифрована именно вашим ключом, а не
            подменённым на сервере. После смены ключа отпечаток изменится.
          </p>
        </template>
        <div class="complaints__row">
          <UiButton
            v-if="!confirmRotate"
            variant="secondary"
            size="sm"
            @click="confirmRotate = true"
          >
            Сменить ключ
          </UiButton>
        </div>
      </UiPanel>

      <UiDialog
        v-model="confirmRotate"
        title="Сменить ключ владельца?"
        description="Новые жалобы пойдут под новый ключ, а отпечаток для игроков изменится. Старые жалобы останутся читаемыми: старый ключ сохранится на этом устройстве и в резервной копии, но для его восстановления на другом устройстве понадобится прежний код. У нового ключа будет новый код."
      >
        <template #actions>
          <UiButton variant="ghost" @click="confirmRotate = false">Отмена</UiButton>
          <UiButton :loading="c.busy.value" @click="begin(true)">Сменить ключ</UiButton>
        </template>
      </UiDialog>

      <UiPanel eyebrow="Зашифровано на стороне игрока" title="Жалобы и отзывы">
        <template #actions>
          <UiButton variant="secondary" size="sm" @click="c.load">Обновить</UiButton>
        </template>
        <UiSegmented
          :model-value="c.status.value"
          :options="filters"
          label="Статус"
          @update:model-value="c.setFilter($event as ComplaintStatus | '')"
        />
        <UiTable label="Жалобы">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Категория</th>
              <th>Оценка</th>
              <th>Статус</th>
              <th><span class="sr-only">Действие</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in c.data.value.items" :key="row.id">
              <td>{{ dateTime(row.createdAt) }}</td>
              <td>{{ categories[row.category] ?? row.category }}</td>
              <td>{{ row.rating ?? '—' }}</td>
              <td>
                <UiStatus :tone="tones[row.status]">{{ statusLabels[row.status] }}</UiStatus>
              </td>
              <td>
                <UiButton variant="secondary" size="sm" @click="c.open(row)">
                  Открыть<span class="sr-only"> жалобу №{{ row.id }}</span>
                </UiButton>
              </td>
            </tr>
          </tbody>
        </UiTable>
        <UiEmpty v-if="!c.data.value.items.length">Жалоб пока нет.</UiEmpty>
        <nav
          v-if="c.data.value.meta.lastPage > 1"
          class="complaints__row"
          aria-label="Страницы списка"
        >
          <UiButton
            variant="ghost"
            size="sm"
            :disabled="c.page.value <= 1"
            @click="c.goto(c.page.value - 1)"
            >Назад</UiButton
          >
          <span>{{ c.page.value }} из {{ c.data.value.meta.lastPage }}</span>
          <UiButton
            variant="ghost"
            size="sm"
            :disabled="c.page.value >= c.data.value.meta.lastPage"
            @click="c.goto(c.page.value + 1)"
            >Вперёд</UiButton
          >
        </nav>
      </UiPanel>

      <UiDialog
        :model-value="!!c.opened.value"
        :title="c.opened.value ? `Жалоба №${c.opened.value.row.id}` : ''"
        @update:model-value="!$event && c.closeOpened()"
      >
        <template v-if="c.opened.value">
          <p class="complaints__muted">
            {{ categories[c.opened.value.row.category] ?? c.opened.value.row.category }} · оценка
            {{ c.opened.value.row.rating ?? '—' }} ·
            {{ dateTime(c.opened.value.row.createdAt) }}
          </p>
          <UiNotice v-if="c.opened.value.error" tone="error" role="alert">
            {{ c.opened.value.error }}
          </UiNotice>
          <p v-else-if="!c.opened.value.content" role="status">Расшифровываем…</p>
          <div v-else class="complaints__body" data-testid="complaint-text">
            <p class="complaints__text">{{ c.opened.value.content.text }}</p>
            <dl>
              <template v-if="c.opened.value.content.authorName">
                <dt>Автор</dt>
                <dd>{{ c.opened.value.content.authorName }}</dd>
              </template>
              <template v-if="c.opened.value.content.bookingId">
                <dt>Бронь</dt>
                <dd>№{{ c.opened.value.content.bookingId }}</dd>
              </template>
              <template v-if="c.opened.value.content.sessionId">
                <dt>Сессия</dt>
                <dd>№{{ c.opened.value.content.sessionId }}</dd>
              </template>
              <template v-if="c.opened.value.content.employee">
                <dt>Сотрудник</dt>
                <dd>{{ c.opened.value.content.employee }}</dd>
              </template>
            </dl>
            <p v-if="!c.opened.value.content.authorName" class="complaints__muted">
              Автор имя не указал.
            </p>
          </div>
        </template>
        <template #actions>
          <template v-if="c.opened.value">
            <UiButton
              v-if="c.opened.value.row.status !== 'read'"
              variant="secondary"
              @click="c.changeStatus('read')"
              >Отметить прочитанной</UiButton
            >
            <UiButton
              v-if="c.opened.value.row.status !== 'closed'"
              variant="secondary"
              @click="c.changeStatus('closed')"
              >Закрыть</UiButton
            >
          </template>
          <UiButton variant="ghost" @click="c.closeOpened">Готово</UiButton>
        </template>
      </UiDialog>
    </template>
  </div>
</template>

<style scoped>
.complaints {
  display: grid;
  gap: 20px;
}
.complaints__code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--fs-18);
  letter-spacing: 0.06em;
  overflow-wrap: anywhere;
}
.complaints__muted {
  color: var(--muted);
  font-size: var(--fs-13);
}
.complaints__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.complaints__lost {
  display: grid;
  gap: 12px;
  max-width: 480px;
  margin-top: 24px;
}
.complaints__form {
  display: grid;
  gap: 12px;
  max-width: 480px;
}
.complaints__text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.complaints__body dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
}
.complaints__body dt {
  color: var(--muted);
}
</style>
