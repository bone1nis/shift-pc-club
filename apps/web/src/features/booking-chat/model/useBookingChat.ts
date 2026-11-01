import { computed, getCurrentScope, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { z } from 'zod'
import { useRealtime, useRealtimeChannel } from '@shift/ui'
import {
  attachmentMaxBytes,
  attachmentMimeTypes,
  bookingChatChannel,
  bookingChatPresenceChannel,
  chatMessageSchema,
  messageReadSchema,
  typingEventName,
  typingSchema,
  type ChatMessage,
  type DeviceKey,
} from '@shift/contracts'
import { createIndexedDbKeyStore } from '@shift/e2ee'
import { useUserStore } from '@fsd/entities/user'
import { api, apiParsed, apiUpload, ApiFailure, errorMessage } from '@fsd/shared/api'
import {
  createSecretChat,
  secretFailure,
  type PeerFingerprint,
  type SecretMessage,
} from './secretChat'

export const CHAT_MAX_LENGTH = 2000
const PAGE = 50
const CATCH_UP_PAGE = 100
/** Не чаще одного whisper «печатает…» за это время. */
export const TYPING_THROTTLE_MS = 2500
/** «Печатает…» гаснет после такой тишины. */
export const TYPING_TTL_MS = 5000
/** Пауза перед отправкой позиции прочтения: пачка сообщений даёт один запрос. */
export const READ_DEBOUNCE_MS = 600
/** Паузы между повторами, пока консьюмер не создал проекцию участников новой брони (~31 с). */
export const PROVISION_RETRY_MS = [1000, 2000, 4000, 8000, 8000, 8000]
export const ATTACHMENT_ACCEPT = attachmentMimeTypes.join(',')

export interface ChatParticipant {
  userId: number
  role: string
  muted: boolean
}
export interface ChatConversation {
  id: number
  bookingId: number
  closed: boolean
  muted: boolean
  moderated: boolean
  participants: ChatParticipant[]
  unreadCount?: number
  lastReadMessageId?: number | null
  canWrite?: boolean
}
const readResultSchema = z.object({
  lastReadMessageId: z.number().int(),
  unreadCount: z.number().int(),
})
interface History {
  items: ChatMessage[]
  hasMore: boolean
}
export interface PendingMessage {
  tempId: number
  body: string
  createdAt: string
}

const messagesSchema = z.array(chatMessageSchema)

/** Объединяет списки без дублей по id и сортирует по id (порядок доставки не гарантирован). */
export function mergeMessages(...lists: ChatMessage[][]): ChatMessage[] {
  const byId = new Map<number, ChatMessage>()
  for (const list of lists) for (const m of list) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

/** Понятный текст ошибки отправки; второй элемент - как изменилось состояние чата. */
export function sendFailure(error: unknown): {
  message: string
  muted?: boolean
  closed?: boolean
} {
  if (error instanceof ApiFailure) {
    if (error.status === 403)
      return { message: 'Вы не можете писать в этот чат: вас заглушили.', muted: true }
    if (error.status === 409)
      return { message: 'Чат закрыт: бронь завершена или отменена.', closed: true }
    if (error.status === 429)
      return { message: 'Слишком часто. Подождите пару секунд и отправьте снова.' }
    if (error.status === 422) return { message: 'Введите текст сообщения.' }
  }
  return { message: errorMessage(error) }
}

/** Проверка файла до отправки: пустая строка - файл подходит. */
export function validateAttachment(file: { type: string; size: number }): string {
  if (!(attachmentMimeTypes as readonly string[]).includes(file.type))
    return 'Можно прикрепить только картинку: PNG, JPEG, WebP или GIF.'
  if (file.size > attachmentMaxBytes) return 'Файл больше 10 МБ. Выберите поменьше.'
  if (file.size < 1) return 'Файл пустой.'
  return ''
}

/** Понятный текст ошибки загрузки вложения. */
export function attachmentFailure(error: unknown): {
  message: string
  muted?: boolean
  closed?: boolean
} {
  if (error instanceof ApiFailure) {
    if (error.status === 413)
      return { message: 'Лимит вложений для этой брони исчерпан: новые картинки добавить нельзя.' }
    if (error.status === 422)
      return { message: 'Сервер не принял файл: нужна картинка PNG, JPEG, WebP или GIF до 10 МБ.' }
    if (error.status === 409)
      return { message: 'Чат закрыт: бронь завершена или отменена.', closed: true }
    if (error.status === 403)
      return { message: 'Вы не можете писать в этот чат: вас заглушили.', muted: true }
    if (error.status === 429)
      return { message: 'Слишком часто. Подождите пару секунд и повторите.' }
  }
  return { message: errorMessage(error) }
}

const whisperName = typingEventName.replace(/^client-/, '')

export function useBookingChat(bookingId: number) {
  const queryClient = useQueryClient()
  const user = useUserStore()
  const realtime = useRealtime()
  const base = `/api/realtime/conversations/${bookingId}`
  const convoKey = ['booking-chat', bookingId, 'conversation']
  const historyKey = ['booking-chat', bookingId, 'messages']

  const conversationQuery = useQuery({
    queryKey: convoKey,
    queryFn: () => api<ChatConversation>(base),
    staleTime: 60_000,
    retry: false,
  })
  const conversation = computed(() => conversationQuery.data.value)

  function cached(): History | undefined {
    return queryClient.getQueryData<History>(historyKey)
  }
  function store(items: ChatMessage[], hasMore?: boolean) {
    queryClient.setQueryData<History>(historyKey, (prev) => ({
      items: mergeMessages(prev?.items ?? [], items),
      hasMore: hasMore ?? prev?.hasMore ?? false,
    }))
  }

  const historyQuery = useQuery({
    queryKey: historyKey,
    queryFn: async (): Promise<History> => {
      const fresh = await apiParsed(messagesSchema, `${base}/messages?limit=${PAGE}`)
      // Сообщения, пришедшие по сокету, пока шёл запрос, не теряем.
      return { items: mergeMessages(cached()?.items ?? [], fresh), hasMore: fresh.length === PAGE }
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  })
  const messages = computed(() => historyQuery.data.value?.items ?? [])
  const hasMore = computed(() => historyQuery.data.value?.hasMore ?? false)

  const pending = ref<PendingMessage[]>([])
  const draft = ref('')
  const sendError = ref('')
  const forcedClosed = ref(false)
  const forcedMuted = ref(false)
  const loadingOlder = ref(false)
  let tempSeq = 0

  const closed = computed(() => forcedClosed.value || !!conversation.value?.closed)
  const muted = computed(() => forcedMuted.value || !!conversation.value?.muted)
  const canWrite = computed(
    () =>
      !!conversation.value &&
      conversation.value.canWrite !== false &&
      !closed.value &&
      !muted.value,
  )
  const participants = computed(() => conversation.value?.participants ?? [])
  const myId = computed(() => user.user?.id ?? null)
  const unreadCount = computed(() => conversation.value?.unreadCount ?? 0)
  const isOwner = computed(() =>
    participants.value.some((p) => p.userId === myId.value && p.role === 'owner'),
  )
  const forbidden = computed(() => {
    const e = conversationQuery.error.value
    return e instanceof ApiFailure && e.status === 403
  })
  // 403 сразу после создания брони: проекция участников ещё не создана. Повторяем с паузами.
  const retryAttempt = ref(0)
  const provisionExhausted = ref(false)
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  watch(
    () => conversationQuery.errorUpdatedAt.value,
    () => {
      if (!forbidden.value) return
      if (retryAttempt.value >= PROVISION_RETRY_MS.length) {
        provisionExhausted.value = true
        return
      }
      const delay = PROVISION_RETRY_MS[retryAttempt.value++]!
      retryTimer = setTimeout(() => void conversationQuery.refetch(), delay)
    },
    { immediate: true },
  )
  watch(
    () => conversation.value?.id,
    (id) => {
      if (id && historyQuery.error.value) void historyQuery.refetch()
    },
  )
  const provisioning = computed(() => forbidden.value && !provisionExhausted.value)
  const loadError = computed(() => {
    const e = conversationQuery.error.value ?? historyQuery.error.value
    return e && !forbidden.value ? errorMessage(e) : ''
  })
  const loading = computed(() => conversationQuery.isPending.value || historyQuery.isPending.value)

  function senderLabel(senderId: number): string {
    if (senderId === myId.value) return 'Вы'
    const p = participants.value.find((x) => x.userId === senderId)
    return p?.role === 'owner' ? 'Владелец брони' : `Игрок #${senderId}`
  }

  // Новые сообщения по сокету: невалидные и чужие по форме отбрасываем, дубли склеиваются по id.
  useRealtimeChannel(bookingChatChannel(bookingId), '.message.sent', (payload) => {
    const parsed = chatMessageSchema.safeParse(payload)
    if (!parsed.success) return
    const isNew = !cached()?.items.some((m) => m.id === parsed.data.id)
    store([parsed.data])
    if (parsed.data.senderId === myId.value) return
    stopTyping(parsed.data.senderId)
    if (isNew) patchConversation((c) => ({ ...c, unreadCount: (c.unreadCount ?? 0) + 1 }))
  })

  function patchConversation(fn: (c: ChatConversation) => ChatConversation) {
    queryClient.setQueryData<ChatConversation>(convoKey, (prev) => (prev ? fn(prev) : prev))
  }

  // Кто онлайн и кто печатает: presence-канал + клиентские события (whisper).
  const online = ref<number[]>([])
  const typingIds = ref<number[]>([])
  const typingTimers = new Map<number, ReturnType<typeof setTimeout>>()
  function stopTyping(userId: number) {
    const timer = typingTimers.get(userId)
    if (timer) clearTimeout(timer)
    typingTimers.delete(userId)
    typingIds.value = typingIds.value.filter((id) => id !== userId)
  }
  function onTyping(payload: unknown) {
    const parsed = typingSchema.safeParse(payload)
    // Свой whisper не показываем, чужие по форме - отбрасываем.
    if (!parsed.success || parsed.data.userId === myId.value) return
    const id = parsed.data.userId
    const timer = typingTimers.get(id)
    if (timer) clearTimeout(timer)
    typingTimers.set(
      id,
      setTimeout(() => stopTyping(id), TYPING_TTL_MS),
    )
    if (!typingIds.value.includes(id)) typingIds.value = [...typingIds.value, id]
  }
  const presence = realtime.presence(bookingChatPresenceChannel(bookingId), {
    here: (members) => (online.value = members.map((m) => m.id)),
    joining: (m) => {
      if (!online.value.includes(m.id)) online.value = [...online.value, m.id]
    },
    leaving: (m) => {
      online.value = online.value.filter((id) => id !== m.id)
      stopTyping(m.id)
    },
    whispers: { [whisperName]: onTyping },
  })

  let lastWhisper = 0
  watch(draft, (value) => {
    if (!value.trim() || !canWrite.value || myId.value === null) return
    const now = Date.now()
    if (now - lastWhisper < TYPING_THROTTLE_MS) return
    lastWhisper = now
    presence.whisper(whisperName, { userId: myId.value })
  })

  // Позиции прочтения других участников (только из живых событий): по ним ставим «прочитано».
  const readPositions = ref<Record<number, number>>({})
  useRealtimeChannel(bookingChatChannel(bookingId), '.message.read', (payload) => {
    const parsed = messageReadSchema.safeParse(payload)
    if (!parsed.success || parsed.data.userId === myId.value) return
    const prev = readPositions.value[parsed.data.userId] ?? 0
    if (parsed.data.upToMessageId > prev)
      readPositions.value = {
        ...readPositions.value,
        [parsed.data.userId]: parsed.data.upToMessageId,
      }
  })
  function isRead(message: ChatMessage): boolean {
    return (
      message.senderId === myId.value &&
      Object.values(readPositions.value).some((upTo) => upTo >= message.id)
    )
  }

  // Отметка «прочитано»: когда чат открыт и окно в фокусе, шлём id последнего чужого сообщения.
  const isFocused = () =>
    typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus()
  const focused = ref(isFocused())
  const syncFocus = () => {
    focused.value = isFocused()
  }
  let reportedRead = 0
  let readTimer: ReturnType<typeof setTimeout> | undefined
  const lastForeignId = computed(
    () => messages.value.filter((m) => m.senderId !== myId.value).at(-1)?.id ?? 0,
  )
  async function markRead() {
    const target = lastForeignId.value
    if (!focused.value || target <= reportedRead || conversation.value?.canWrite === false) return
    const before = reportedRead
    reportedRead = target
    try {
      const result = await apiParsed(readResultSchema, `${base}/read`, {
        method: 'POST',
        body: JSON.stringify({ upToMessageId: target }),
      })
      reportedRead = Math.max(reportedRead, result.lastReadMessageId)
      patchConversation((c) => ({
        ...c,
        unreadCount: result.unreadCount,
        lastReadMessageId: result.lastReadMessageId,
      }))
    } catch {
      // Следующее сообщение или возврат фокуса повторят попытку.
      reportedRead = before
    }
  }
  watch(
    () => conversation.value?.lastReadMessageId,
    (id) => {
      if (id && id > reportedRead) reportedRead = id
    },
    { immediate: true },
  )
  watch(
    [lastForeignId, focused, () => !loading.value],
    ([target, inFocus, ready]) => {
      if (readTimer) clearTimeout(readTimer)
      if (!ready || !inFocus || target <= reportedRead) return
      readTimer = setTimeout(() => void markRead(), READ_DEBOUNCE_MS)
    },
    { immediate: true },
  )
  onMounted(() => {
    syncFocus()
    window.addEventListener('focus', syncFocus)
    window.addEventListener('blur', syncFocus)
    document.addEventListener('visibilitychange', syncFocus)
    // Пока панель была закрыта, сообщения могли прийти мимо неё: догружаем.
    void catchUp()
  })
  if (getCurrentScope())
    onScopeDispose(() => {
      presence.leave()
      if (readTimer) clearTimeout(readTimer)
      if (retryTimer) clearTimeout(retryTimer)
      for (const t of typingTimers.values()) clearTimeout(t)
      window.removeEventListener('focus', syncFocus)
      window.removeEventListener('blur', syncFocus)
      document.removeEventListener('visibilitychange', syncFocus)
      clearAttachment()
    })

  async function catchUp() {
    if (!cached()) return
    try {
      let last = cached()?.items.at(-1)?.id ?? 0
      for (;;) {
        const rows = await apiParsed(
          messagesSchema,
          `${base}/messages?after_id=${last}&limit=${CATCH_UP_PAGE}`,
        )
        if (rows.length) store(rows)
        if (rows.length < CATCH_UP_PAGE) break
        last = rows.at(-1)!.id
      }
      // Состояние чата (закрыт, заглушён) тоже мог поменяться за время обрыва.
      await queryClient.invalidateQueries({ queryKey: convoKey })
    } catch {
      /* следующий реконнект повторит догрузку */
    }
  }
  watch(
    () => realtime.isLive.value,
    (live, was) => {
      if (live && was === false) void catchUp()
    },
  )

  async function loadOlder() {
    const first = messages.value[0]
    if (!first || loadingOlder.value) return
    loadingOlder.value = true
    try {
      const rows = await apiParsed(
        messagesSchema,
        `${base}/messages?before_id=${first.id}&limit=${PAGE}`,
      )
      store(rows, rows.length === PAGE)
    } catch (e) {
      sendError.value = errorMessage(e)
    } finally {
      loadingOlder.value = false
    }
  }

  // ---- секретные сообщения (E2E) ----
  const secretChat = computed(() => {
    const userId = myId.value
    if (userId === null) return null
    return createSecretChat({
      bookingId,
      userId,
      api,
      store: createIndexedDbKeyStore('pcclub-chat'),
      storage: typeof localStorage === 'undefined' ? null : localStorage,
      label: typeof navigator === 'undefined' ? undefined : navigator.userAgent.slice(0, 80),
    })
  })
  const deviceKeys = ref<DeviceKey[]>([])
  const secretsReady = ref(false)
  const secretsError = ref('')
  const secretSending = ref(false)
  const verifiedVersion = ref(0)

  async function refreshKeys() {
    const sc = secretChat.value
    if (!sc) return
    try {
      await sc.ensureDevice()
      deviceKeys.value = await sc.fetchKeys()
      secretsReady.value = true
      secretsError.value = ''
    } catch (e) {
      secretsReady.value = false
      secretsError.value =
        e instanceof ApiFailure
          ? errorMessage(e)
          : 'Секретные сообщения недоступны: браузер не даёт сохранить ключ устройства.'
    }
  }
  // Ключ этого устройства создаётся при первом открытии чата (когда он доступен участнику).
  watch(
    () => [conversation.value?.id, myId.value],
    ([convoId, uid]) => {
      if (convoId && uid !== null && uid !== undefined) void refreshKeys()
    },
    { immediate: true },
  )
  watch(
    () => participants.value.length,
    (now, was) => {
      if (was !== undefined && secretChat.value) void refreshKeys()
    },
  )

  /** Участники, у которых нет ни одного устройства: секрет они не прочитают. */
  const membersWithoutKey = computed(() =>
    secretsReady.value
      ? participants.value
          .filter(
            (p) => p.userId !== myId.value && !deviceKeys.value.some((k) => k.userId === p.userId),
          )
          .map((p) => p.userId)
      : [],
  )
  /** Проверенные участники с новым неизвестным ключом. */
  const changedKeyUserIds = computed<number[]>(() => {
    void verifiedVersion.value
    return secretChat.value?.changedUsers(deviceKeys.value) ?? []
  })

  async function sendSecret() {
    const sc = secretChat.value
    const text = draft.value.trim()
    if (!sc || !text || !canWrite.value || attachment.value || secretSending.value) return
    if (text.length > CHAT_MAX_LENGTH) {
      sendError.value = `Не больше ${CHAT_MAX_LENGTH} символов.`
      return
    }
    sendError.value = ''
    secretSending.value = true
    try {
      store([await sc.sendSecret(text)])
      draft.value = ''
      void refreshKeys()
    } catch (e) {
      sendError.value = secretFailure(e)
      if (e instanceof ApiFailure && (e.status === 403 || e.status === 409)) {
        const failure = sendFailure(e)
        if (failure.muted) forcedMuted.value = true
        if (failure.closed) forcedClosed.value = true
      }
      void refreshKeys()
    } finally {
      secretSending.value = false
    }
  }

  /** Расшифровка по нажатию. Текст получает только вызвавший компонент. */
  function revealSecret(message: SecretMessage): Promise<string> {
    const sc = secretChat.value
    if (!sc) return Promise.reject(new Error('Не удалось определить пользователя.'))
    return sc.decrypt(message)
  }

  async function peerFingerprints(): Promise<PeerFingerprint[]> {
    const sc = secretChat.value
    if (!sc) return []
    await refreshKeys()
    return sc.peerFingerprints(deviceKeys.value)
  }
  function markVerified(userId: number) {
    secretChat.value?.markVerified(
      userId,
      deviceKeys.value.filter((k) => k.userId === userId).map((k) => k.publicKey),
    )
    verifiedVersion.value++
  }
  function isVerified(userId: number): boolean {
    void verifiedVersion.value
    return secretChat.value?.isVerified(userId) ?? false
  }

  // Большой секрет приходит с redacted=true: полное сообщение берём отдельным запросом (один раз).
  const redactedTried = new Set<number>()
  watch(
    messages,
    (list) => {
      for (const m of list) {
        if (m.kind !== 'secret' || !m.redacted || redactedTried.has(m.id)) continue
        redactedTried.add(m.id)
        void apiParsed(messagesSchema, `${base}/messages?after_id=${m.id - 1}&limit=1`)
          .then((rows) => {
            const full = rows.find((r) => r.id === m.id)
            if (full && !(full.kind === 'secret' && full.redacted)) store([full])
          })
          .catch(() => undefined)
      }
    },
    { immediate: true },
  )

  const attachment = ref<File | null>(null)
  const attachmentPreview = ref('')
  const uploadProgress = ref<number | null>(null)
  function clearAttachment() {
    if (attachmentPreview.value && typeof URL.revokeObjectURL === 'function')
      URL.revokeObjectURL(attachmentPreview.value)
    attachment.value = null
    attachmentPreview.value = ''
  }
  function pickAttachment(file: File | null | undefined) {
    if (!file) return
    const problem = validateAttachment(file)
    if (problem) {
      sendError.value = problem
      return
    }
    sendError.value = ''
    clearAttachment()
    attachment.value = file
    attachmentPreview.value =
      typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : ''
  }
  async function sendAttachment(file: File) {
    const caption = draft.value.trim()
    if (caption.length > CHAT_MAX_LENGTH) {
      sendError.value = `Не больше ${CHAT_MAX_LENGTH} символов.`
      return
    }
    sendError.value = ''
    uploadProgress.value = 0
    const form = new FormData()
    form.append('file', file)
    if (caption) form.append('body', caption)
    try {
      const sent = await apiUpload<unknown>(`${base}/attachments`, form, (f) => {
        uploadProgress.value = f
      })
      const parsed = chatMessageSchema.parse(sent)
      store([parsed])
      draft.value = ''
      clearAttachment()
    } catch (e) {
      // Файл и подпись остаются: можно повторить или убрать вложение.
      const failure = attachmentFailure(e)
      sendError.value = failure.message
      if (failure.muted) forcedMuted.value = true
      if (failure.closed) forcedClosed.value = true
    } finally {
      uploadProgress.value = null
    }
  }

  async function send() {
    if (attachment.value) {
      if (canWrite.value && uploadProgress.value === null) await sendAttachment(attachment.value)
      return
    }
    const body = draft.value.trim()
    if (!body || !canWrite.value) return
    if (body.length > CHAT_MAX_LENGTH) {
      sendError.value = `Не больше ${CHAT_MAX_LENGTH} символов.`
      return
    }
    sendError.value = ''
    const temp: PendingMessage = {
      tempId: ++tempSeq,
      body,
      createdAt: new Date().toISOString(),
    }
    pending.value.push(temp)
    draft.value = ''
    try {
      const sent = await apiParsed(chatMessageSchema, `${base}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      store([sent])
    } catch (e) {
      const failure = sendFailure(e)
      sendError.value = failure.message
      if (failure.muted) forcedMuted.value = true
      if (failure.closed) forcedClosed.value = true
      // Текст возвращаем в поле, чтобы его не пришлось набирать заново.
      if (!draft.value) draft.value = body
    } finally {
      pending.value = pending.value.filter((p) => p.tempId !== temp.tempId)
    }
  }

  function reload() {
    if (retryTimer) clearTimeout(retryTimer)
    retryAttempt.value = 0
    provisionExhausted.value = false
    void conversationQuery.refetch()
    void historyQuery.refetch()
  }

  return {
    conversation,
    messages,
    pending,
    draft,
    sendError,
    hasMore,
    loading,
    loadError,
    forbidden,
    provisioning,
    closed,
    muted,
    canWrite,
    participants,
    myId,
    unreadCount,
    isOwner,
    loadingOlder,
    live: realtime.isLive,
    senderLabel,
    online,
    typingIds,
    isRead,
    attachment,
    attachmentPreview,
    uploadProgress,
    pickAttachment,
    clearAttachment,
    send,
    sendSecret,
    secretSending,
    secretsReady,
    secretsError,
    membersWithoutKey,
    changedKeyUserIds,
    revealSecret,
    peerFingerprints,
    markVerified,
    isVerified,
    loadOlder,
    reload,
  }
}
