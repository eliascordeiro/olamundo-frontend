import { test, expect } from '@playwright/test'
import { signIn } from './helpers'
import { bruno, marina, mockQueryApi } from './query-api'

test('logout limpa dados anteriores antes do login de outro usuario', async ({ page }) => {
  const api = await mockQueryApi(page, {
    user: marina, messages: [{ id: 'old', texto: 'Dado da sessao anterior' }],
  })
  await page.goto('/')
  await expect(page.getByText('Dado da sessao anterior', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
  api.messages = [{ id: 'new', texto: 'Dados atualizados do servidor' }]
  await page.getByLabel('E-mail', { exact: true }).fill(bruno.email)
  await page.getByLabel('Senha', { exact: true }).fill('a-unique-business-passphrase')
  await page.getByRole('button', { name: 'Entrar no workspace' }).click()
  await expect(page.getByRole('heading', { name: 'Olá, Bruno.' })).toBeVisible()
  await expect(page.getByText('Dados atualizados do servidor', { exact: true })).toBeVisible()
  await expect(page.getByText('Dado da sessao anterior', { exact: true })).toBeHidden()
})

test('401 no mural encerra sessao sem retry e nova entrada consulta dados novos', async ({ page }) => {
  const api = await mockQueryApi(page, { user: marina })
  api.messageStatus = 401
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
  expect(api.calls.filter((call) => call.path === '/api/mensagens').length).toBeLessThanOrEqual(2)
  api.messageStatus = 200
  api.messages = [{ id: 'fresh', texto: 'Sessao restaurada' }]
  await signIn(page, marina.email)
  await expect(page.getByText('Sessao restaurada', { exact: true })).toBeVisible()
})

test('logout cancela consulta pendente e resposta antiga nao volta no novo login', async ({ page }) => {
  const api = await mockQueryApi(page, {
    user: marina, messages: [{ id: 'late', texto: 'Resposta antiga atrasada' }],
  })
  let release
  api.holdMessages = new Promise((resolve) => { release = resolve })
  await page.goto('/')
  await expect.poll(() => api.calls.some((call) => call.path === '/api/mensagens')).toBe(true)
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
  api.holdMessages = null
  api.messages = [{ id: 'current', texto: 'Resposta atual' }]
  release()
  await signIn(page, marina.email)
  await expect(page.getByText('Resposta atual', { exact: true })).toBeVisible()
  await expect(page.getByText('Resposta antiga atrasada', { exact: true })).toBeHidden()
})

test('falha de logout mantem usuario e mural e permite tentar novamente', async ({ page }) => {
  const api = await mockQueryApi(page, {
    user: marina, messages: [{ id: 'saved', texto: 'Mural preservado' }],
  })
  api.logoutStatus = 503
  await page.goto('/')
  await expect(page.getByText('Mural preservado', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Falha ao sair.')
  await expect(page.getByRole('heading', { name: 'Olá, Marina.' })).toBeVisible()
  api.logoutStatus = 204
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
})
