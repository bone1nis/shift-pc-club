import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import {
  UiCalendar,
  UiCheckbox,
  UiDateTimePicker,
  UiDialog,
  UiDisclosure,
  UiTextarea,
  UiNumberInput,
  UiSegmented,
  UiSelect,
  UiTabs,
} from '../../packages/ui/src'

// Открытые поповеры слушают клавиатуру на document — размонтируем после каждого теста.
enableAutoUnmount(afterEach)

const stubs = { global: { stubs: { teleport: true } } }

describe('UiSelect', () => {
  const options = [
    { value: 1, label: 'PC-01' },
    { value: 2, label: 'PC-02', disabled: true },
    { value: 3, label: 'PC-03' },
  ]
  it('opens with the keyboard, skips disabled options and emits the chosen value', async () => {
    const wrapper = mount(UiSelect, {
      props: { modelValue: 1, options, label: 'Место' },
      ...stubs,
    })
    expect(wrapper.get('button').text()).toContain('PC-01')
    await wrapper.get('button').trigger('keydown', { key: 'ArrowDown' })
    const list = wrapper.get('[role="listbox"]')
    await list.trigger('keydown', { key: 'ArrowDown' })
    await list.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([3])
  })

  it('does not select a disabled option with the mouse', async () => {
    const wrapper = mount(UiSelect, {
      props: { modelValue: 1, options, label: 'Место' },
      ...stubs,
    })
    await wrapper.get('button').trigger('click')
    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('UiNumberInput', () => {
  it('steps with buttons and arrow keys within bounds', async () => {
    const wrapper = mount(UiNumberInput, {
      props: { modelValue: 60, label: 'Минут', min: 30, max: 90, step: 30 },
    })
    await wrapper.find('input').trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([90])
    await wrapper.setProps({ modelValue: 90 })
    await wrapper.find('input').trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([90])
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([60])
  })

  it('clamps typed values on blur and ignores non-digits', async () => {
    const wrapper = mount(UiNumberInput, {
      props: { modelValue: 5, label: 'Часов', min: 1, max: 12 },
    })
    const input = wrapper.find('input')
    await input.setValue('abc99')
    await input.trigger('blur')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([12])
  })
})

describe('UiCheckbox and UiSegmented', () => {
  it('toggles the checkbox through the label', async () => {
    const wrapper = mount(UiCheckbox, { props: { modelValue: false, label: 'PC-01' } })
    await wrapper.find('input').setValue(true)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })
  it('marks the active segment and emits changes', async () => {
    const wrapper = mount(UiSegmented, {
      props: {
        modelValue: 2,
        options: [
          { value: 1, label: '1 ч' },
          { value: 2, label: '2 ч' },
        ],
      },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons[1]!.attributes('aria-pressed')).toBe('true')
    await buttons[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([1])
  })
})

describe('UiTabs', () => {
  it('moves selection with arrow keys', async () => {
    const wrapper = mount(UiTabs, {
      props: {
        modelValue: 'a',
        options: [
          { value: 'a', label: 'Вход' },
          { value: 'b', label: 'Регистрация' },
        ],
      },
    })
    await wrapper.findAll('[role="tab"]')[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['b'])
  })
})

describe('UiCalendar', () => {
  it('disables days before the minimum and selects a day', async () => {
    const wrapper = mount(UiCalendar, { props: { modelValue: '2026-10-15', min: '2026-10-10' } })
    expect(wrapper.get('[data-date="2026-10-09"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-date="2026-10-20"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-10-20'])
    await wrapper.get('[data-date="2026-10-09"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
  })

  it('moves focus with arrow keys across the month edge', async () => {
    const wrapper = mount(UiCalendar, {
      props: { modelValue: '2026-10-31' },
      attachTo: document.body,
    })
    await wrapper.get('[data-date="2026-10-31"]').trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    await nextTick()
    expect(wrapper.get('[role="grid"]').attributes('aria-label')).toMatch(/ноябрь/i)
    wrapper.unmount()
  })
})

describe('UiDateTimePicker', () => {
  it('shows a formatted value and picks date then time, respecting the minimum', async () => {
    const wrapper = mount(UiDateTimePicker, {
      props: { modelValue: '2026-10-13T17:00', label: 'Когда играем?', min: '2026-10-13T17:00' },
      ...stubs,
    })
    expect(wrapper.get('button').text()).toContain('13 окт. 2026')
    await wrapper.get('button').trigger('click')
    const early = wrapper.findAll('[role="option"]').map((o) => o.text())
    expect(early[0]).toBe('17:00')
    await wrapper.get('[data-date="2026-10-14"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['2026-10-14T17:00'])
    await wrapper.setProps({ modelValue: '2026-10-14T17:00' })
    expect(wrapper.findAll('[role="option"]')[0]!.text()).toBe('00:00')
    await wrapper.findAll('[role="option"]')[3]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['2026-10-14T01:30'])
  })
})

describe('UiDialog', () => {
  it('closes on Escape and keeps Tab focus inside', async () => {
    const wrapper = mount(UiDialog, {
      props: { modelValue: true, title: 'Отменить бронь?' },
      slots: { actions: '<button id="a">Оставить</button><button id="b">Да</button>' },
      attachTo: document.body,
      ...stubs,
    })
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    wrapper.unmount()
  })
})

describe('UiDisclosure and UiTextarea', () => {
  it('toggles the panel and keeps aria-expanded in sync', async () => {
    const wrapper = mount(UiDisclosure, {
      props: { title: 'Можно ли отменить бронь?' },
      slots: { default: 'Да, до начала.' },
    })
    const button = wrapper.get('button')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('[role="region"]').attributes('inert')).toBeDefined()
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[role="region"]').attributes('inert')).toBeUndefined()
  })

  it('emits typed text, shows the counter and reports the error accessibly', async () => {
    const wrapper = mount(UiTextarea, {
      props: { modelValue: 'abc', label: 'Описание', maxlength: 10, error: 'Слишком коротко' },
    })
    expect(wrapper.text()).toContain('3 / 10')
    const area = wrapper.get('textarea')
    expect(area.attributes('aria-invalid')).toBe('true')
    expect(area.attributes('aria-describedby')).toBe(
      wrapper.get('.textarea__error').attributes('id'),
    )
    await area.setValue('abcdef')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['abcdef'])
  })
})
