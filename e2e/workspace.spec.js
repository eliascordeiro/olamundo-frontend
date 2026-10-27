import { test, expect } from '@playwright/test'
import { createAccount, signIn, testEmail } from './helpers'

test('cadastro, login, persistência de sessao sem mural e logout', async ({ page }) => {
  const email = testEmail()
  await createAccount(page, email)
  await signIn(page, email)
  await expect(page.getByRole('region', { name: 'Lojas e operações', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mural de conexões' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Olá, Marina.' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Lojas e operações', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
})
