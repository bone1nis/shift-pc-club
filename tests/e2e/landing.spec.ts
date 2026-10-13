import { expect, test } from '@playwright/test'

test('landing shows gallery, steps, contacts with hours, FAQ and structured data', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  // Клики до гидратации Nuxt не доходят до обработчиков Vue.
  await page.waitForFunction(() => {
    const app = (
      window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }
    ).useNuxtApp?.()
    return app !== undefined && app.isHydrating === false
  })
  await expect(page.getByRole('heading', { name: /Увидь/ })).toBeVisible()
  const images = page.locator('#gallery img')
  await expect(images).toHaveCount(6)
  for (const image of await images.all()) await expect(image).toHaveAttribute('alt', /.{10,}/)

  const contacts = page.locator('#contacts')
  await expect(contacts.getByText('Москва, ул. Игровая, д. 12', { exact: false })).toBeVisible()
  await expect(contacts.getByText('Ежедневно, круглосуточно')).toBeVisible()
  await expect(contacts.getByRole('link', { name: '+7 (495) 555-01-24' })).toHaveAttribute(
    'href',
    'tel:+74955550124',
  )

  const faq = page.locator('#faq')
  const question = faq.getByRole('button', { name: 'Можно ли отменить бронь?' })
  await expect(question).toHaveAttribute('aria-expanded', 'false')
  await question.click()
  await expect(question).toHaveAttribute('aria-expanded', 'true')
  await expect(faq.getByText('до её начала', { exact: false })).toBeVisible()

  const html = await (await page.request.get('/', { headers: { Accept: 'text/html' } })).text()
  expect(html).toContain('application/ld+json')
  expect(html).toContain('"streetAddress":"ул. Игровая, д. 12, стр. 3, 2 этаж"')
  expect(html).toContain('og:image')
})
