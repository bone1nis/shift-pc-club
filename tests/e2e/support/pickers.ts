import { expect, type Page } from '@playwright/test'

/** Выбирает дату и время в собственном UiDateTimePicker: `value` = `YYYY-MM-DDTHH:mm`. */
export async function pickDateTime(page: Page, label: string | RegExp, value: string) {
  const [date, time] = value.split('T') as [string, string]
  await page.getByRole('button', { name: label }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const day = dialog.locator(`[data-date="${date}"]`)
  for (let attempt = 0; attempt < 14 && !(await day.isVisible()); attempt++) {
    await dialog.getByRole('button', { name: 'Следующий месяц' }).click()
  }
  await day.click()
  await dialog.getByRole('option', { name: time, exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
}
