import { expect } from '@playwright/test'

export const password = 'a-unique-business-passphrase'
export const testEmail = () => `nexo-e2e-${crypto.randomUUID()}@example.com`

export async function createAccount(page, email) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Começar agora' }).click()
  await page.getByLabel('Seu nome').fill('Marina Negócios')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Criar minha conta' }).click()
  await expect(page.getByRole('status')).toContainText('Conta criada')
}

export async function signIn(page, email) {
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar no workspace' }).click()
  await expect(page.getByRole('heading', { name: 'Olá, Marina.' })).toBeVisible()
}
