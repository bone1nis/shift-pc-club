<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { UiButton, UiNotice, UiSkeleton, UiTextarea } from '@shift/ui'
import { dateTime } from '@fsd/shared/format'
import { ATTACHMENT_ACCEPT, CHAT_MAX_LENGTH, useBookingChat } from '../model/useBookingChat'
import InviteFriend from './InviteFriend.vue'
import SecretMessage from './SecretMessage.vue'
import SecretVerify from './SecretVerify.vue'

const props = defineProps<{ bookingId: number; autofocus?: boolean }>()
defineEmits<{ close: [] }>()
const chat = useBookingChat(props.bookingId)
const list = ref<HTMLElement | null>(null)
const inputId = `booking-chat-input-${props.bookingId}`

function scrollDown() {
  void nextTick(() => {
    if (list.value) list.value.scrollTop = list.value.scrollHeight
  })
}
watch(() => chat.messages.value.at(-1)?.id, scrollDown)
watch(() => chat.pending.value.length, scrollDown)
onMounted(() => {
  if (props.autofocus) void nextTick(() => document.getElementById(inputId)?.focus())
})

const verifyOpen = ref(false)
const membersWithoutKeyText = computed(() =>
  chat.membersWithoutKey.value.map((id) => chat.senderLabel(id)).join(', '),
)
const changedKeyText = computed(() =>
  chat.changedKeyUserIds.value.map((id) => chat.senderLabel(id)).join(', '),
)
const canSecret = computed(
  () =>
    chat.canWrite.value &&
    chat.secretsReady.value &&
    !chat.secretSending.value &&
    !chat.attachment.value &&
    !!chat.draft.value.trim(),
)

const fileInput = ref<HTMLInputElement | null>(null)
function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  chat.pickAttachment(input.files?.[0])
  input.value = ''
}
function kb(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`
}
const typingText = computed(() => {
  const names = chat.typingIds.value.map((id) => chat.senderLabel(id))
  if (!names.length) return ''
  return names.length === 1 ? `${names[0]} печатает…` : `${names.join(', ')} печатают…`
})
const canSubmit = computed(
  () =>
    chat.canWrite.value &&
    chat.uploadProgress.value === null &&
    (!!chat.draft.value.trim() || !!chat.attachment.value),
)

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  void chat.send()
}
</script>

<template>
  <section class="chat" :aria-label="`Чат брони №${bookingId}`">
    <p class="chat__moderation">Чат модерируется администратором клуба.</p>

    <UiNotice v-if="chat.provisioning.value" role="status">
      Чат создаётся… Это займёт несколько секунд.
    </UiNotice>
    <UiNotice v-else-if="chat.forbidden.value">
      Чат этой брони недоступен: вы не входите в число участников.
      <UiButton variant="ghost" size="sm" @click="chat.reload()">Повторить</UiButton>
    </UiNotice>
    <template v-else>
      <div v-if="chat.loading.value" role="status" class="chat__loading">
        <span class="sr-only">Загружаем чат…</span>
        <UiSkeleton shape="text" width="70%" height="20px" />
        <UiSkeleton shape="text" width="50%" height="20px" />
      </div>
      <UiNotice v-else-if="chat.loadError.value" tone="error">
        {{ chat.loadError.value }}
        <UiButton variant="ghost" size="sm" @click="chat.reload()">Повторить</UiButton>
      </UiNotice>
      <template v-else>
        <p v-if="chat.participants.value.length" class="chat__members">
          Участники:
          <span v-for="(p, i) in chat.participants.value" :key="p.userId">
            <span
              class="chat__dot"
              :class="{ 'chat__dot--on': chat.online.value.includes(p.userId) }"
              aria-hidden="true"
            ></span
            >{{ chat.senderLabel(p.userId)
            }}{{ chat.online.value.includes(p.userId) ? ' (в сети)' : ''
            }}{{ p.muted ? ' (заглушён)' : ''
            }}{{ i < chat.participants.value.length - 1 ? ', ' : '' }}
          </span>
        </p>
        <InviteFriend v-if="chat.isOwner.value && !chat.closed.value" :booking-id="bookingId" />

        <UiButton
          v-if="chat.hasMore.value"
          variant="ghost"
          size="sm"
          :loading="chat.loadingOlder.value"
          @click="chat.loadOlder()"
        >
          Показать раньше
        </UiButton>
        <!-- role=log: новые сообщения озвучиваются скринридером без перехвата фокуса. -->
        <ul
          ref="list"
          class="chat__list"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Сообщения"
          tabindex="0"
        >
          <li v-if="!chat.messages.value.length && !chat.pending.value.length" class="chat__empty">
            Сообщений пока нет. Напишите первым.
          </li>
          <li
            v-for="m in chat.messages.value"
            :key="m.id"
            class="chat__item"
            :class="{ 'chat__item--mine': m.senderId === chat.myId.value }"
          >
            <span class="chat__meta"
              >{{ chat.senderLabel(m.senderId) }} · {{ dateTime(m.createdAt) }}</span
            >
            <a
              v-if="m.kind === 'text' && m.attachment"
              class="chat__image"
              :href="m.attachment.url"
              target="_blank"
              rel="noopener"
            >
              <img
                :src="m.attachment.url"
                :alt="m.body || m.attachment.name"
                loading="lazy"
                class="chat__img"
              />
              <span class="sr-only"> (открыть картинку в новой вкладке)</span>
            </a>
            <span v-if="m.kind === 'text' && m.body" class="chat__body">{{ m.body }}</span>
            <SecretMessage
              v-else-if="m.kind === 'secret'"
              :message="m"
              :reveal="chat.revealSecret"
            />
            <span v-if="chat.changedKeyUserIds.value.includes(m.senderId)" class="chat__changed"
              >У отправителя изменился ключ — проверьте заново.</span
            >
            <span v-if="chat.isRead(m)" class="chat__read">Прочитано</span>
          </li>
          <li
            v-for="p in chat.pending.value"
            :key="`p${p.tempId}`"
            class="chat__item chat__item--mine chat__item--pending"
          >
            <span class="chat__meta">Вы · отправляется…</span>
            <span class="chat__body">{{ p.body }}</span>
          </li>
        </ul>

        <!-- Вне aria-live: частый индикатор не должен спамить скринридер. -->
        <p class="chat__typing" aria-live="off">{{ typingText }}</p>

        <div class="chat__secret-info">
          <p class="chat__moderation">
            Секретные сообщения шифруются на устройствах участников. Сервер и администратор их
            прочитать не могут. При смене устройства прочитать их не получится. Через 24 часа после
            закрытия брони секреты удаляются.
          </p>
          <UiNotice v-if="chat.changedKeyUserIds.value.length" tone="error">
            У участника изменился ключ — проверьте заново: {{ changedKeyText }}.
          </UiNotice>
          <UiNotice v-if="membersWithoutKeyText">
            Не смогут прочитать секрет (у них ещё нет ключа на устройстве):
            {{ membersWithoutKeyText }}.
          </UiNotice>
          <p v-if="chat.secretsError.value" class="chat__offline">{{ chat.secretsError.value }}</p>
          <UiButton
            variant="ghost"
            size="sm"
            :disabled="!chat.secretsReady.value"
            @click="verifyOpen = true"
          >
            Проверить участников
          </UiButton>
        </div>
        <SecretVerify
          v-model="verifyOpen"
          :load="chat.peerFingerprints"
          :label="chat.senderLabel"
          :is-verified="chat.isVerified"
          :changed="chat.changedKeyUserIds.value"
          @verify="chat.markVerified"
        />

        <UiNotice v-if="chat.closed.value">
          Чат закрыт: бронь завершена или отменена. Историю можно читать.
        </UiNotice>
        <UiNotice v-else-if="chat.muted.value">
          Вас заглушили: писать нельзя, пока администратор не снимет ограничение.
        </UiNotice>
        <UiNotice v-if="chat.sendError.value" tone="error">{{ chat.sendError.value }}</UiNotice>
        <p v-if="!chat.live.value" class="chat__offline">
          Нет живого соединения: новые сообщения подтянутся после переподключения.
        </p>

        <form class="chat__form" @submit.prevent="chat.send()" @keydown="onKeydown">
          <UiTextarea
            :id="inputId"
            v-model="chat.draft.value"
            label="Сообщение"
            :rows="2"
            :maxlength="CHAT_MAX_LENGTH"
            :disabled="!chat.canWrite.value"
            hint="Enter отправляет, Shift+Enter переносит строку."
          />
          <div v-if="chat.attachment.value" class="chat__preview">
            <img
              v-if="chat.attachmentPreview.value"
              :src="chat.attachmentPreview.value"
              alt="Превью вложения"
              class="chat__thumb"
            />
            <span class="chat__file"
              >{{ chat.attachment.value.name }} · {{ kb(chat.attachment.value.size) }}</span
            >
            <progress
              v-if="chat.uploadProgress.value !== null"
              class="chat__progress"
              max="100"
              :value="Math.round(chat.uploadProgress.value * 100)"
              aria-label="Загрузка картинки"
            ></progress>
            <UiButton
              variant="ghost"
              size="sm"
              :disabled="chat.uploadProgress.value !== null"
              @click="chat.clearAttachment()"
            >
              Убрать
            </UiButton>
          </div>
          <div class="chat__actions">
            <input
              ref="fileInput"
              type="file"
              class="sr-only"
              tabindex="-1"
              aria-hidden="true"
              :accept="ATTACHMENT_ACCEPT"
              data-testid="chat-file"
              @change="onFile"
            />
            <UiButton
              variant="secondary"
              :disabled="!chat.canWrite.value || chat.uploadProgress.value !== null"
              @click="fileInput?.click()"
            >
              Прикрепить картинку
            </UiButton>
            <UiButton
              variant="secondary"
              aria-label="Отправить секретное сообщение"
              :loading="chat.secretSending.value"
              :disabled="!canSecret"
              @click="chat.sendSecret()"
            >
              🔒 Секрет
            </UiButton>
            <UiButton type="submit" :disabled="!canSubmit">Отправить</UiButton>
          </div>
        </form>
      </template>
    </template>
    <UiButton variant="ghost" size="sm" @click="$emit('close')">Скрыть чат</UiButton>
  </section>
</template>

<style scoped>
.chat {
  display: grid;
  gap: 12px;
  padding: 16px;
  background: var(--sunken);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.chat__moderation,
.chat__members,
.chat__offline {
  margin: 0;
  color: var(--muted);
  font-size: var(--fs-14);
}
.chat__list {
  display: grid;
  gap: 8px;
  align-content: start;
  max-height: 320px;
  min-height: 96px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.chat__item {
  display: grid;
  gap: 2px;
  max-width: 85%;
  padding: 8px 12px;
  background: var(--raised);
  border-radius: var(--radius);
  justify-self: start;
}
.chat__item--mine {
  justify-self: end;
  background: var(--notice-bg);
}
.chat__item--pending {
  opacity: 0.6;
}
.chat__meta {
  color: var(--muted);
  font-size: var(--fs-14);
}
.chat__body {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.chat__body--secret,
.chat__empty {
  color: var(--muted);
  font-style: italic;
}
.chat__empty {
  list-style: none;
}
.chat__form {
  display: grid;
  gap: 8px;
  justify-items: start;
}
.chat__form :deep(.textarea) {
  width: 100%;
}
.chat__changed {
  color: var(--danger, #c0392b);
  font-size: var(--fs-14);
}
.chat__secret-info {
  display: grid;
  gap: 8px;
  justify-items: start;
}
.chat__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 4px;
  background: var(--muted);
  border-radius: 50%;
}
.chat__dot--on {
  background: var(--green-5);
}
.chat__typing {
  min-height: 1.4em;
  margin: 0;
  color: var(--muted);
  font-size: var(--fs-14);
}
.chat__read {
  color: var(--muted);
  font-size: var(--fs-12);
  justify-self: end;
}
.chat__img {
  display: block;
  max-width: 100%;
  max-height: 240px;
  border-radius: var(--radius-sm);
}
.chat__preview,
.chat__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.chat__thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: var(--radius-sm);
}
.chat__file {
  overflow-wrap: anywhere;
  font-size: var(--fs-14);
}
.chat__progress {
  width: 120px;
}
.chat__loading {
  display: grid;
  gap: 8px;
}
</style>
