import { test, expect } from '@playwright/test'
import { signIn } from './helpers'
import { bruno, marina, mockQueryApi } from './query-api'

test('logout limpa dados anteriores antes do login de outro usuario', async ({ page }) => {
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [{ id: 'old', name: 'Loja da sessao anterior', role: 'OWNER' }]
  await page.goto('/')
  await expect(page.getByLabel('Loja ativa')).toContainText('Loja da sessao anterior')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
  api.stores = [{ id: 'new', name: 'Loja da nova conta', role: 'STAFF' }]
  await page.getByLabel('E-mail', { exact: true }).fill(bruno.email)
  await page.getByLabel('Senha', { exact: true }).fill('a-unique-business-passphrase')
  await page.getByRole('button', { name: 'Entrar no workspace' }).click()
  await expect(page.getByRole('heading', { name: 'Olá, Bruno.' })).toBeVisible()
  await expect(page.getByLabel('Loja ativa')).toContainText('Loja da nova conta')
  await expect(page.getByLabel('Loja ativa')).not.toContainText('Loja da sessao anterior')
})

test('401 nas lojas encerra sessao sem retry e nova entrada consulta dados novos', async ({ page }) => {
  const api = await mockQueryApi(page, { user: marina })
  api.storesStatus = 401
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
  expect(api.calls.filter((call) => call.path === '/api/stores').length).toBeLessThanOrEqual(2)
  api.storesStatus = 200
  api.stores = [{ id: 'fresh', name: 'Loja da sessao restaurada', role: 'OWNER' }]
  await signIn(page, marina.email)
  await expect(page.getByLabel('Loja ativa')).toContainText('Loja da sessao restaurada')
})

test('logout cancela consulta pendente e resposta antiga nao volta no novo login', async ({ page }) => {
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [{ id: 'late', name: 'Loja antiga atrasada', role: 'OWNER' }]
  let release
  api.holdStores = new Promise((resolve) => { release = resolve })
  await page.goto('/')
  await expect.poll(() => api.calls.some((call) => call.path === '/api/stores')).toBe(true)
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
  api.holdStores = null
  api.stores = [{ id: 'current', name: 'Loja atual', role: 'OWNER' }]
  release()
  await signIn(page, marina.email)
  await expect(page.getByLabel('Loja ativa')).toContainText('Loja atual')
  await expect(page.getByLabel('Loja ativa')).not.toContainText('Loja antiga atrasada')
})

test('falha de logout mantem usuario e lojas e permite tentar novamente', async ({ page }) => {
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [{ id: 'saved', name: 'Loja preservada', role: 'OWNER' }]
  api.logoutStatus = 503
  await page.goto('/')
  await expect(page.getByLabel('Loja ativa')).toContainText('Loja preservada')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Falha ao sair.')
  await expect(page.getByRole('heading', { name: 'Olá, Marina.' })).toBeVisible()
  await expect(page.getByLabel('Loja ativa')).toContainText('Loja preservada')
  api.logoutStatus = 204
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
})
