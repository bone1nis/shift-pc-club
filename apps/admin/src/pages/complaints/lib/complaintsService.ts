import {
  E2eeError,
  fingerprintOfKey,
  generateOwnerKeyPair,
  openSealed,
  restoreFromBackup,
  type KeyStore,
  type OwnerKey,
  type RecoveryBlob,
} from '@shift/e2ee'

export type ApiFn = <T>(path: string, options?: RequestInit) => Promise<T>
export type ApiPageFn = <T>(path: string) => Promise<{ data: T; meta: Record<string, number> }>

export type ComplaintStatus = 'new' | 'read' | 'closed'

export interface ComplaintRow {
  id: number
  category: string
  rating: number | null
  status: ComplaintStatus
  ownerKeyId: number
  ephemeralPublicKey: string
  nonce: string
  ciphertext: string
  createdAt: string
}

export interface ComplaintPage {
  items: ComplaintRow[]
  meta: { page: number; perPage: number; total: number; lastPage: number }
}

export interface KeyBackupRow {
  ownerKeyId: number
  publicKey: string
  active: boolean
  version: number
  blob: string
  createdAt: string
}

export interface ServerOwnerKey {
  ownerKeyId: number
  publicKey: string
}

/** none — ключа нет нигде; missing — на сервере есть, на этом устройстве нет; ready — можно читать. */
export type KeyState =
  | { kind: 'none' }
  | { kind: 'missing'; key: ServerOwnerKey; fingerprint: string }
  | { kind: 'ready'; key: ServerOwnerKey; fingerprint: string }

/** Расшифрованное содержимое жалобы. Имя автора есть, только если игрок включил «показать имя». */
export interface ComplaintContent {
  text: string
  bookingId?: number | string
  sessionId?: number | string
  employee?: string
  /** Форма игрока кладёт имя в `name` вместе с `showName`; `authorName` оставлен для совместимости. */
  name?: string
  showName?: boolean
  authorName?: string
}

export type DecryptResult =
  { ok: true; content: ComplaintContent } | { ok: false; reason: 'no_key' | 'decrypt_failed' }

export const decryptMessages = {
  no_key:
    'На этом устройстве нет ключа, которым зашифрована жалоба (возможно, он был сменён). Восстановите ключ по коду восстановления.',
  decrypt_failed:
    'Не удалось расшифровать жалобу этим ключом. Возможно, ключ чужой или устарел: восстановите ключ по коду восстановления.',
} as const

export function recoveryErrorMessage(cause: unknown): string {
  if (cause instanceof E2eeError && cause.code === 'bad_recovery_code')
    return 'Код восстановления не подошёл. Проверьте код: 32 символа, буквы A–Z и цифры 2–7, дефисы и пробелы не важны.'
  if (cause instanceof E2eeError && cause.code === 'bad_format')
    return 'Резервная копия ключа повреждена или имеет неизвестный формат.'
  return cause instanceof Error ? cause.message : 'Не удалось восстановить ключ.'
}

function parseContent(plain: string): ComplaintContent {
  try {
    const value = JSON.parse(plain) as unknown
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as ComplaintContent).text === 'string'
    ) {
      const content = value as ComplaintContent
      // Имя показываем, только если игрок сам включил «показать имя».
      const name = content.authorName ?? (content.showName ? content.name : undefined)
      return { ...content, ...(name ? { authorName: name } : {}) }
    }
  } catch {
    // не JSON: считаем, что это просто текст
  }
  return { text: plain }
}

/** Ключ в IndexedDB хранится под серверным id (у каждой ротации свой). */
const storeId = (ownerKeyId: number | string) => String(ownerKeyId)

export function createComplaintsService(deps: { api: ApiFn; apiPage: ApiPageFn; store: KeyStore }) {
  const { api, apiPage, store } = deps

  async function loadKeyState(): Promise<KeyState> {
    let key: ServerOwnerKey
    try {
      key = await api<ServerOwnerKey>('/api/club/owner-key')
    } catch (cause) {
      if ((cause as { status?: number }).status === 404) return { kind: 'none' }
      throw cause
    }
    const fingerprint = await fingerprintOfKey(key.publicKey)
    const local = await store.get(storeId(key.ownerKeyId))
    return { kind: local ? 'ready' : 'missing', key, fingerprint }
  }

  /** Шаг 1 мастера и ротации: ключ создаётся в памяти, на сервер и в IndexedDB пока ничего не уходит. */
  async function prepareKey() {
    // Серверный id ещё не известен, поэтому в бэкап пишется метка; под настоящим id ключ сохраняется после PUT.
    const label = `k${Date.now().toString(36)}`
    return generateOwnerKeyPair(label)
  }

  /** Шаг 2: владелец подтвердил, что записал код. Регистрируем публичный ключ и бэкап, сохраняем приватный. */
  async function commitKey(prepared: { key: OwnerKey; blob: RecoveryBlob }): Promise<number> {
    const created = await api<ServerOwnerKey>('/api/club/owner/key', {
      method: 'PUT',
      body: JSON.stringify({
        publicKey: prepared.key.publicKeyEncoded,
        backup: JSON.stringify(prepared.blob),
        backupVersion: prepared.blob.v,
      }),
    })
    await store.put(storeId(created.ownerKeyId), {
      privateKey: prepared.key.privateKey,
      publicKey: prepared.key.publicKey,
    })
    return created.ownerKeyId
  }

  /** Подбирает по коду все резервные копии, которые он открывает, и кладёт ключи в IndexedDB. */
  async function restore(code: string): Promise<{ restored: number; skipped: number }> {
    const rows = await api<KeyBackupRow[]>('/api/club/owner/key-backup')
    let restored = 0
    let lastError: unknown
    for (const row of rows) {
      try {
        const blob = JSON.parse(row.blob) as RecoveryBlob
        const key = await restoreFromBackup(code, blob)
        await store.put(storeId(row.ownerKeyId), {
          privateKey: key.privateKey,
          publicKey: key.publicKey,
        })
        restored++
      } catch (cause) {
        lastError = cause
        // Код проверяется до сетевых шагов: при неверном формате дальше пробовать нечего.
        if (cause instanceof E2eeError && cause.code === 'bad_recovery_code' && !rows.length) break
      }
    }
    if (!restored)
      throw lastError ?? new E2eeError('bad_recovery_code', 'No backups to restore from')
    return { restored, skipped: rows.length - restored }
  }

  async function decrypt(c: ComplaintRow): Promise<DecryptResult> {
    const pair = await store.get(storeId(c.ownerKeyId))
    if (!pair) return { ok: false, reason: 'no_key' }
    const sealed = {
      v: 1,
      ownerKeyId: c.ownerKeyId,
      ephemeralPublicKey: c.ephemeralPublicKey,
      nonce: c.nonce,
      ciphertext: c.ciphertext,
    }
    try {
      // Категория входит в аутентифицируемые данные конверта; для совместимости пробуем и без неё.
      let plain: string
      try {
        plain = await openSealed(sealed, pair.privateKey, { meta: c.category })
      } catch {
        plain = await openSealed(sealed, pair.privateKey)
      }
      return { ok: true, content: parseContent(plain) }
    } catch {
      return { ok: false, reason: 'decrypt_failed' }
    }
  }

  async function list(status: ComplaintStatus | '', page: number): Promise<ComplaintPage> {
    const q = new URLSearchParams({ page: String(page) })
    if (status) q.set('status', status)
    const result = await apiPage<ComplaintRow[]>(`/api/club/owner/complaints?${q}`)
    const m = result.meta
    return {
      items: result.data,
      meta: {
        page: m.page ?? page,
        perPage: m.perPage ?? 20,
        total: m.total ?? result.data.length,
        lastPage: m.lastPage ?? 1,
      },
    }
  }

  const setStatus = (id: number, status: ComplaintStatus) =>
    api<ComplaintRow>(`/api/club/owner/complaints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })

  return { loadKeyState, prepareKey, commitKey, restore, decrypt, list, setStatus }
}
export type ComplaintsService = ReturnType<typeof createComplaintsService>
