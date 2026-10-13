import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'

export interface PopoverOptions {
  trigger: Ref<HTMLElement | null>
  panel: Ref<HTMLElement | null>
  /** Выбор, куда вернуть фокус после закрытия. */
  restoreFocus?: boolean
}

/**
 * Поповер на `position: fixed`: позиционируется по триггеру, закрывается по Esc
 * и по клику вне, при нехватке места снизу открывается вверх.
 */
export function usePopover({ trigger, panel, restoreFocus = true }: PopoverOptions) {
  const open = ref(false)
  const style = ref<Record<string, string>>({})

  function place() {
    const anchor = trigger.value
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const gap = 6
    const margin = 8
    const panelHeight = panel.value?.scrollHeight ?? 320
    const below = window.innerHeight - rect.bottom - gap - margin
    const above = rect.top - gap - margin
    // Открываем туда, где больше места; если панель не помещается — ограничиваем высоту и прокручиваем.
    const up = below < panelHeight && above > below
    const space = Math.max(160, up ? above : below)
    const width = Math.max(rect.width, panel.value?.offsetWidth ?? 0)
    const left = Math.min(
      Math.max(margin, rect.left),
      Math.max(margin, window.innerWidth - width - margin),
    )
    style.value = {
      position: 'fixed',
      left: `${left}px`,
      minWidth: `${rect.width}px`,
      maxHeight: `${space}px`,
      overflowY: 'auto',
      ...(up
        ? { bottom: `${window.innerHeight - rect.top + gap}px` }
        : { top: `${rect.bottom + gap}px` }),
    }
  }

  function onPointerDown(event: PointerEvent) {
    const target = event.target as Node
    if (panel.value?.contains(target) || trigger.value?.contains(target)) return
    close(false)
  }
  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close(true)
    }
  }

  function close(focusTrigger = restoreFocus) {
    if (!open.value) return
    open.value = false
    if (focusTrigger) void nextTick(() => trigger.value?.focus())
  }
  function toggle() {
    if (open.value) close()
    else openPanel()
  }
  function openPanel() {
    open.value = true
  }

  watch(open, async (value) => {
    if (value) {
      await nextTick()
      place()
      await nextTick()
      place()
      document.addEventListener('pointerdown', onPointerDown, true)
      document.addEventListener('keydown', onKeydown, true)
      window.addEventListener('resize', place)
      window.addEventListener('scroll', place, true)
    } else {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeydown, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  })
  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKeydown, true)
    window.removeEventListener('resize', place)
    window.removeEventListener('scroll', place, true)
  })

  return { open, style, toggle, close, openPanel, place }
}
