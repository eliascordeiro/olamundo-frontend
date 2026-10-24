import { test, expect } from '@playwright/test'
import { createAccount, signIn, testEmail } from './helpers'

test('cadastro, login, persistência de mensagem e logout', async ({ page }) => {
  const email = testEmail()
  await createAccount(page, email)
  await signIn(page, email)
  const message = `Nova conexão ${crypto.randomUUID()}`
  await page.getByLabel('Sua mensagem').fill(message)
  await page.getByRole('button', { name: 'Publicar mensagem' }).click()
  await expect(page.getByText(message, { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Olá, Marina.' })).toBeVisible()
  await expect(page.getByText(message, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
})
