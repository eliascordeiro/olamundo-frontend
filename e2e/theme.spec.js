import { expect, test } from '@playwright/test'

test('tema escolhido é aplicado, lembrado e o padrão segue o sistema', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const darkBackground = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)

  await page.evaluate(() => window.localStorage.setItem('nexo.theme', 'contrast'))
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast')

  await page.evaluate(() => window.localStorage.setItem('nexo.theme', 'light'))
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const lightBackground = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
  expect(lightBackground).not.toBe(darkBackground)
})
