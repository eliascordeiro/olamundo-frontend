import { expect, test } from '@playwright/test'
import { marina, mockQueryApi } from './query-api'

const background = page => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)

test('padrão é escuro, o ícone alterna com alto contraste e a escolha é lembrada', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await mockQueryApi(page, { user: marina })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByLabel('Tema')).toHaveCount(0)
  const dark = await background(page)

  await page.getByRole('button', { name: 'Mudar para alto contraste' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast')
  expect(await background(page)).not.toBe(dark)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast')

  await page.getByRole('button', { name: 'Mudar para escuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('tema claro antigo migra para escuro e preferência de contraste é respeitada', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nexo.theme', 'light'))
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  const contrastPage = await page.context().newPage()
  await contrastPage.emulateMedia({ contrast: 'more' })
  await contrastPage.goto('/')
  await expect(contrastPage.locator('html')).toHaveAttribute('data-theme', 'contrast')
})
