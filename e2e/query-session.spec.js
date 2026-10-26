import { test, expect } from '@playwright/test'
import { createAccount, signIn } from './helpers'
import { marina, mockQueryApi } from './query-api'

test('sessao anonima nao repete 401; cadastro e login preservam CSRF', async ({ page }) => {
  const api = await mockQueryApi(page)
  await createAccount(page, marina.email)
  // StrictMode can cancel the initial GET and start a replacement during mount.
  expect(api.calls.filter((call) => call.path === '/api/auth/me').length).toBeLessThanOrEqual(2)
  await signIn(page, marina.email)
  await expect(page.getByRole('heading', { name: 'Suas lojas', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mural de conexões' })).toHaveCount(0)
  await expect(page.getByLabel('Sua mensagem', { exact: true })).toHaveCount(0)
  expect(api.calls.filter((call) => call.path === '/api/mensagens')).toHaveLength(0)
  const writes = api.calls.filter((call) => call.method === 'POST')
  expect(writes.map((call) => call.path)).toEqual(['/api/auth/register', '/api/auth/login'])
  expect(writes.every((call) => call.headers['x-csrf-token'] === 'test-csrf')).toBe(true)
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({})
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Olá, Marina.' })).toBeVisible()
})

test('login invalido nao e repetido e permite nova tentativa', async ({ page }) => {
  const api = await mockQueryApi(page)
  api.loginStatus = 401
  await page.goto('/')
  await page.getByLabel('E-mail', { exact: true }).fill(marina.email)
  await page.getByLabel('Senha', { exact: true }).fill('not-the-right-passphrase')
  await page.getByRole('button', { name: 'Entrar no workspace' }).click()
  await expect(page.getByRole('alert')).toHaveText('Credenciais invalidas.')
  expect(api.calls.filter((call) => call.path === '/api/auth/login')).toHaveLength(1)
  api.loginStatus = 200
  await signIn(page, marina.email)
})

test('falha temporaria de sessao tem retry limitado e recuperacao manual', async ({ page }) => {
  const api = await mockQueryApi(page, { user: marina })
  api.sessionStatus = 503
  await page.goto('/')
  await expect(page.getByRole('alert')).toHaveText('API temporariamente indisponivel.')
  const requests = api.calls.filter((call) => call.path === '/api/auth/me').length
  expect(requests).toBeGreaterThanOrEqual(2)
  expect(requests).toBeLessThanOrEqual(3)
  api.sessionStatus = 200
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('heading', { name: 'Olá, Marina.' })).toBeVisible()
})

test('sessao expirada ao voltar para a aba limpa lojas antes de autenticar novamente', async ({ page }) => {
  await page.clock.install()
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [{ id: 'old', name: 'Loja da sessao expirada', role: 'OWNER' }]
  await page.goto('/')
  await expect(page.getByLabel('Loja ativa')).toContainText('Loja da sessao expirada')
  api.user = null
  await page.clock.fastForward(31_000)
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
  api.stores = [{ id: 'new', name: 'Loja depois da reautenticacao', role: 'OWNER' }]
  await signIn(page, marina.email)
  await expect(page.getByLabel('Loja ativa')).toContainText('Loja depois da reautenticacao')
  await expect(page.getByLabel('Loja ativa')).not.toContainText('Loja da sessao expirada')
})
