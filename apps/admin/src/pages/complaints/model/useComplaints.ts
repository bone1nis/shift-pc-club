import { computed, onMounted, ref, shallowRef } from 'vue'
import { createIndexedDbKeyStore, type OwnerKey, type RecoveryBlob } from '@shift/e2ee'
import { ownerChannel } from '@shift/contracts'
import { useRealtimeChannel } from '@shift/ui'
import { api, apiPage, errorMessage } from '@fsd/shared/api'
import { refreshNewComplaints } from '@fsd/shared/lib'
import {
  createComplaintsService,
  decryptMessages,
  recoveryErrorMessage,
  type ComplaintContent,
  type ComplaintPage,
  type ComplaintRow,
  type ComplaintStatus,
  type KeyState,
} from '../lib/complaintsService'

export type Screen = 'loading' | 'setup' | 'restore' | 'list'
export type Opened = { row: ComplaintRow; content?: ComplaintContent; error?: string }

/** Открытый текст и ключи живут только в памяти вкладки: ни localStorage, ни логов. */
export function useComplaints() {
  const service = createComplaintsService({
    api,
    apiPage,
    store: createIndexedDbKeyStore('shift-owner-keys'),
  })
  const screen = ref<Screen>('loading')
  const keyState = shallowRef<KeyState>({ kind: 'none' })
  const error = ref('')
  const busy = ref(false)

  // Мастер настройки и ротация: ключ в памяти до подтверждения «я записал код».
  const prepared = shallowRef<{ key: OwnerKey; blob: RecoveryBlob; code: string } | null>(null)
  const rotating = ref(false)

  const status = ref<ComplaintStatus | ''>('')
  const page = ref(1)
  const data = ref<ComplaintPage>({
    items: [],
    meta: { page: 1, perPage: 20, total: 0, lastPage: 1 },
  })
  const opened = shallowRef<Opened | null>(null)

  const fingerprint = computed(() =>
    keyState.value.kind === 'none' ? '' : keyState.value.fingerprint,
  )

  async function init() {
    error.value = ''
    try {
      keyState.value = await service.loadKeyState()
      const kind = keyState.value.kind
      screen.value = kind === 'none' ? 'setup' : kind === 'missing' ? 'restore' : 'list'
      if (screen.value === 'list') await load()
    } catch (cause) {
      error.value = errorMessage(cause)
      screen.value = 'list'
    }
  }

  async function load() {
    try {
      data.value = await service.list(status.value, page.value)
      error.value = ''
    } catch (cause) {
      error.value = errorMessage(cause)
    }
  }

  async function startSetup(rotate = false) {
    busy.value = true
    error.value = ''
    try {
      rotating.value = rotate
      prepared.value = await service.prepareKey()
      screen.value = 'setup'
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      busy.value = false
    }
  }

  function cancelSetup() {
    prepared.value = null
    rotating.value = false
    const kind = keyState.value.kind
    screen.value = kind === 'ready' ? 'list' : kind === 'missing' ? 'restore' : screen.value
  }

  async function finishSetup() {
    if (!prepared.value) return
    busy.value = true
    error.value = ''
    try {
      await service.commitKey(prepared.value)
      prepared.value = null
      rotating.value = false
      await init()
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      busy.value = false
    }
  }

  async function restore(code: string): Promise<boolean> {
    busy.value = true
    error.value = ''
    try {
      await service.restore(code)
      await init()
      return true
    } catch (cause) {
      error.value = recoveryErrorMessage(cause)
      return false
    } finally {
      busy.value = false
    }
  }

  async function open(row: ComplaintRow) {
    opened.value = { row }
    const result = await service.decrypt(row)
    opened.value = result.ok
      ? { row, content: result.content }
      : { row, error: decryptMessages[result.reason] }
  }

  async function changeStatus(next: ComplaintStatus) {
    const current = opened.value
    if (!current) return
    try {
      const updated = await service.setStatus(current.row.id, next)
      opened.value = { ...current, row: { ...current.row, status: updated.status } }
      await Promise.all([load(), refreshNewComplaints()])
    } catch (cause) {
      error.value = errorMessage(cause)
    }
  }

  function setFilter(next: ComplaintStatus | '') {
    status.value = next
    page.value = 1
    void load()
  }
  function goto(n: number) {
    page.value = Math.min(Math.max(1, n), data.value.meta.lastPage)
    void load()
  }

  // Сигнал без содержимого: список по-прежнему берём через REST.
  useRealtimeChannel(ownerChannel, '.complaint.created', () => {
    if (screen.value === 'list') void load()
  })
  onMounted(init)

  return {
    screen,
    keyState,
    fingerprint,
    error,
    busy,
    prepared,
    rotating,
    status,
    page,
    data,
    opened,
    init,
    load,
    startSetup,
    cancelSetup,
    finishSetup,
    restore,
    open,
    changeStatus,
    setFilter,
    goto,
    closeOpened: () => (opened.value = null),
  }
}
