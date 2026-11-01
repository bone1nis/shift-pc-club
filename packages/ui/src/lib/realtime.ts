import { computed, getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue'

/**
 * Клиент реального времени (Laravel Echo поверх Reverb): подключение только для вошедшего пользователя,
 * переподключение с растущей паузой, повторная подписка на каналы и реактивный статус соединения.
 */
export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'
export type RealtimeHandler = (payload: unknown) => void

/** Минимальная часть Echo, которую использует клиент (упрощает подмену в тестах). */
export interface EchoLike {
  private(name: string): ChannelLike
  join(name: string): ChannelLike
  channel(name: string): ChannelLike
  leave(name: string): void
  disconnect(): void
  connector?: { pusher?: { connection?: ConnectionLike } }
}
export interface ChannelLike {
  listen(event: string, callback: RealtimeHandler): unknown
  stopListening(event: string, callback?: RealtimeHandler): unknown
  /** Только у presence-каналов. */
  here?(callback: (members: PresenceMember[]) => void): unknown
  joining?(callback: (member: PresenceMember) => void): unknown
  leaving?(callback: (member: PresenceMember) => void): unknown
  whisper?(event: string, data: unknown): unknown
  listenForWhisper?(event: string, callback: RealtimeHandler): unknown
}
export interface PresenceMember {
  id: number
  name?: string
}
export interface PresenceHandlers {
  here?: (members: PresenceMember[]) => void
  joining?: (member: PresenceMember) => void
  leaving?: (member: PresenceMember) => void
  /** Клиентские события (whisper): ключ без префикса `client-`. */
  whispers?: Record<string, RealtimeHandler>
}
export interface PresenceHandle {
  /** Отправляет клиентское событие участникам канала; без соединения молча ничего не делает. */
  whisper(event: string, data: unknown): void
  leave(): void
}
export interface ConnectionLike {
  bind(event: string, callback: (payload?: { current?: string }) => void): unknown
  unbind?(event: string, callback?: (payload?: { current?: string }) => void): unknown
}

export interface RealtimeOptions {
  /** Публичный ключ приложения Reverb. Без него клиент не подключается. */
  key: string
  authEndpoint?: string
  /** Фабрика Echo. По умолчанию создаёт настоящий Echo со стандартным pusher-js. */
  createEcho?: (config: EchoConfig) => EchoLike | Promise<EchoLike>
  /** Паузы переподключения, мс: base * 2^n, не больше max. */
  baseDelay?: number
  maxDelay?: number
  /** Читает токен CSRF из cookie на момент авторизации канала. */
  csrfToken?: () => string
}
export interface EchoConfig {
  key: string
  wsHost: string
  wsPort: number
  wssPort: number
  forceTLS: boolean
  authEndpoint: string
  csrfToken: () => string
}

interface Subscription {
  channel: string
  event: string
  handler: RealtimeHandler
  /** Вызывается у текущего Echo при отписке. */
  detach?: () => void
}

function xsrfCookie(): string {
  if (typeof document === 'undefined') return ''
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith('XSRF-TOKEN='))
    ?.slice('XSRF-TOKEN='.length)
  return raw ? decodeURIComponent(raw) : ''
}

async function defaultCreateEcho(config: EchoConfig): Promise<EchoLike> {
  const [{ default: Echo }, { default: Pusher }] = await Promise.all([
    import('laravel-echo'),
    import('pusher-js'),
  ])
  const options = {
    broadcaster: 'reverb',
    Pusher,
    key: config.key,
    wsHost: config.wsHost,
    wsPort: config.wsPort,
    wssPort: config.wssPort,
    forceTLS: config.forceTLS,
    enabledTransports: ['ws', 'wss'],
    authEndpoint: config.authEndpoint,
    withCredentials: true,
    // Заголовки читаются заново при каждой авторизации канала: токен CSRF может смениться.
    auth: {
      get headers() {
        const token = config.csrfToken()
        return { Accept: 'application/json', 'X-CSRF-TOKEN': token, 'X-XSRF-TOKEN': token }
      },
    },
  }
  return new (Echo as unknown as new (o: unknown) => EchoLike)(options)
}

function channelOf(echo: EchoLike, name: string): ChannelLike {
  if (name.startsWith('private-')) return echo.private(name.slice('private-'.length))
  if (name.startsWith('presence-')) return echo.join(name.slice('presence-'.length))
  return echo.channel(name)
}
function leaveName(name: string): string {
  return name.replace(/^(private|presence)-/, '')
}

export function createRealtime(options: RealtimeOptions) {
  const status = ref<RealtimeStatus>('disconnected')
  const isLive = computed(() => status.value === 'connected')
  const subs = new Set<Subscription>()
  const presences = new Set<{ channel: string; handlers: PresenceHandlers }>()
  const baseDelay = options.baseDelay ?? 1000
  const maxDelay = options.maxDelay ?? 30_000
  let echo: EchoLike | undefined
  let wanted = false
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0

  function attach(sub: Subscription) {
    if (!echo) return
    const current = echo
    channelOf(current, sub.channel).listen(sub.event, sub.handler)
    sub.detach = () => {
      channelOf(current, sub.channel).stopListening(sub.event, sub.handler)
    }
  }

  function attachPresence(target: EchoLike, channel: string, handlers: PresenceHandlers) {
    const ch = channelOf(target, channel)
    if (handlers.here) ch.here?.(handlers.here)
    if (handlers.joining) ch.joining?.(handlers.joining)
    if (handlers.leaving) ch.leaving?.(handlers.leaving)
    for (const [event, cb] of Object.entries(handlers.whispers ?? {}))
      ch.listenForWhisper?.(event, cb)
  }

  function dropEcho() {
    const old = echo
    echo = undefined
    for (const sub of subs) sub.detach = undefined
    try {
      old?.disconnect()
    } catch {
      /* соединение уже закрыто */
    }
  }

  function scheduleReconnect(gen: number) {
    if (!wanted || gen !== generation || timer) return
    status.value = 'disconnected'
    const delay = Math.min(maxDelay, baseDelay * 2 ** attempt)
    attempt += 1
    timer = setTimeout(() => {
      timer = undefined
      if (wanted && gen === generation) void open()
    }, delay)
  }

  async function open() {
    if (!options.key || typeof window === 'undefined') return
    const gen = ++generation
    status.value = 'connecting'
    dropEcho()
    const secure = window.location.protocol === 'https:'
    const port = Number(window.location.port) || (secure ? 443 : 80)
    let created: EchoLike
    try {
      created = await (options.createEcho ?? defaultCreateEcho)({
        key: options.key,
        wsHost: window.location.hostname,
        wsPort: port,
        wssPort: port,
        forceTLS: secure,
        authEndpoint: options.authEndpoint ?? '/api/realtime/broadcasting/auth',
        csrfToken: options.csrfToken ?? xsrfCookie,
      })
    } catch {
      scheduleReconnect(gen)
      return
    }
    if (!wanted || gen !== generation) {
      created.disconnect()
      return
    }
    echo = created
    for (const sub of subs) attach(sub)
    for (const p of presences) attachPresence(created, p.channel, p.handlers)
    const connection = created.connector?.pusher?.connection
    connection?.bind('state_change', (states) => {
      if (gen !== generation) return
      const state = states?.current
      if (state === 'connected') {
        attempt = 0
        status.value = 'connected'
      } else if (state === 'connecting' || state === 'initialized') {
        status.value = 'connecting'
      } else if (state === 'unavailable' || state === 'failed' || state === 'disconnected') {
        // Своя пауза вместо встроенной в pusher-js: Echo пересоздаётся, подписки восстанавливаются.
        dropEcho()
        scheduleReconnect(gen)
      }
    })
    connection?.bind('error', () => {
      if (gen === generation) {
        dropEcho()
        scheduleReconnect(gen)
      }
    })
  }

  function connect() {
    if (wanted) return
    wanted = true
    attempt = 0
    void open()
  }

  function disconnect() {
    wanted = false
    generation += 1
    if (timer) clearTimeout(timer)
    timer = undefined
    dropEcho()
    status.value = 'disconnected'
  }

  /** Подписка на событие канала. Возвращает функцию отписки. Работает и до подключения. */
  function subscribe(channel: string, event: string, handler: RealtimeHandler): () => void {
    const sub: Subscription = { channel, event, handler }
    subs.add(sub)
    attach(sub)
    return () => {
      if (!subs.delete(sub)) return
      sub.detach?.()
      const left = [...subs].some((s) => s.channel === channel)
      if (!left && echo) {
        try {
          echo.leave(leaveName(channel))
        } catch {
          /* канал уже закрыт */
        }
      }
    }
  }

  /**
   * Presence-канал: список участников (here/joining/leaving) и клиентские события (whisper).
   * Восстанавливается после переподключения; после реконнекта `here` приходит заново.
   */
  function presence(channel: string, handlers: PresenceHandlers): PresenceHandle {
    const entry = { channel, handlers }
    presences.add(entry)
    if (echo) attachPresence(echo, channel, handlers)
    return {
      whisper(event, data) {
        if (!echo || !presences.has(entry)) return
        try {
          channelOf(echo, channel).whisper?.(event, data)
        } catch {
          /* канал ещё не подписан */
        }
      },
      leave() {
        if (!presences.delete(entry)) return
        const left = [...presences].some((p) => p.channel === channel)
        if (!left && echo) {
          try {
            echo.leave(leaveName(channel))
          } catch {
            /* канал уже закрыт */
          }
        }
      },
    }
  }

  return { status, isLive, connect, disconnect, subscribe, presence }
}
export type RealtimeClient = ReturnType<typeof createRealtime>

let shared: RealtimeClient | undefined
/** Общий клиент приложения. Ключ задаётся один раз через `configureRealtime`. */
export function configureRealtime(options: RealtimeOptions): RealtimeClient {
  shared?.disconnect()
  shared = createRealtime(options)
  return shared
}
export function useRealtime(): RealtimeClient {
  shared ??= createRealtime({ key: '' })
  return shared
}

/** Держит соединение открытым, пока пользователь вошёл (`userId` задан). Гость не подключается. */
export function useRealtimeSession(userId: Ref<number | null | undefined>): RealtimeClient {
  const client = useRealtime()
  watch(
    () => userId.value,
    (id) => (id ? client.connect() : client.disconnect()),
    { immediate: true },
  )
  return client
}

/** Подписка на канал с автоотпиской при размонтировании компонента (или остановке scope). */
export function useRealtimeChannel(channel: string, event: string, handler: RealtimeHandler) {
  const off = useRealtime().subscribe(channel, event, handler)
  if (getCurrentScope()) onScopeDispose(off)
  return off
}
