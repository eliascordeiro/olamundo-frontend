import { test, expect } from '@playwright/test'
import { createAccount, signIn, testEmail } from './helpers'

test('fluxo móvel, alternância da senha e validação de cadastro', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await createAccount(page, testEmail())
  await page.getByLabel('Senha', { exact: true }).fill('temporary-test')
  await page.getByRole('button', { name: 'Mostrar senha' }).click()
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Ocultar senha' }).click()
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'password')
  const email = await page.getByLabel('E-mail', { exact: true }).inputValue()
  await signIn(page, email)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Olá, Marina.' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await page.getByRole('button', { name: 'Começar agora' }).click()
  await page.getByLabel('Seu nome').fill('Marina Negócios')
  await page.getByLabel('E-mail', { exact: true }).fill(testEmail())
  await page.getByLabel('Senha', { exact: true }).fill('short')
  await page.getByRole('button', { name: 'Criar minha conta' }).click()
  await expect(page.getByLabel('Senha', { exact: true })).toHaveJSProperty('validity', expect.objectContaining({ tooShort: true }))
})
