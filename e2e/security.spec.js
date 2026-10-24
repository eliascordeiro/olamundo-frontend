import { test, expect } from '@playwright/test'
import { createAccount, signIn, testEmail } from './helpers'

test('rejeita senha incorreta, protege API e não expõe credenciais no browser', async ({ page }) => {
  const email = testEmail()
  await createAccount(page, email)
  await page.getByLabel('Senha', { exact: true }).fill('incorrect-password')
  await page.getByRole('button', { name: 'Entrar no workspace' }).click()
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos')
  const anonymous = await page.request.get('/api/auth/me')
  expect(anonymous.status()).toBe(401)
  await signIn(page, email)
  const user = await page.request.get('/api/auth/me')
  expect(user.status()).toBe(200)
  expect(await user.json()).toEqual(expect.objectContaining({ email }))
  const forbidden = await page.request.post('/api/mensagens', { data: { texto: 'Sem CSRF' } })
  expect(forbidden.status()).toBe(403)
  const cookie = (await page.context().cookies()).find((item) => item.name === 'BUSINESS_SESSION')
  expect(cookie.httpOnly).toBe(true)
  expect(cookie.sameSite).toBe('Lax')
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({})
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  expect((await page.request.get('/api/mensagens')).status()).toBe(401)
})
