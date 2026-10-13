import { ref, watch, type Ref } from 'vue'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/**
 * Черновик формы поверх серверных данных: пока пользователь не менял поля,
 * обновление данных с сервера подставляется автоматически; правки пользователя не затираются.
 */
export function useDraft<T>(source: () => T): Ref<T> {
  const draft = ref(clone(source())) as Ref<T>
  let previous = JSON.stringify(source())
  watch(
    source,
    (next) => {
      const incoming = JSON.stringify(next)
      if (JSON.stringify(draft.value) === previous) draft.value = JSON.parse(incoming)
      previous = incoming
    },
    { deep: true },
  )
  return draft
}
