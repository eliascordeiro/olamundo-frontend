import { test, expect } from '@playwright/test'
import { marina, mockQueryApi } from './query-api'

test('publicacao invalida a consulta e atualiza o mural sem recarregar a pagina', async ({ page }) => {
  const api = await mockQueryApi(page, { user: marina })
  await page.goto('/')
  await expect(page.getByText('O próximo assunto pode começar com você.', { exact: false })).toBeVisible()
  const initialReads = api.calls.filter((call) => call.path === '/api/mensagens' && call.method === 'GET').length
  await page.getByLabel('Sua mensagem').fill('Uma nova conexao')
  await page.getByRole('button', { name: 'Publicar mensagem' }).click()
  await expect(page.getByText('Uma nova conexao', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Sua mensagem')).toHaveValue('')
  expect(api.calls.filter((call) => call.path === '/api/mensagens' && call.method === 'POST')).toHaveLength(1)
  expect(api.calls.filter((call) => call.path === '/api/mensagens' && call.method === 'GET')).toHaveLength(initialReads + 1)
})

test('falha ao consultar mural nao aparece como lista vazia e permite recuperar', async ({ page }) => {
  const api = await mockQueryApi(page, {
    user: marina, messages: [{ id: 'existing', texto: 'Mensagem existente' }],
  })
  api.messageStatus = 503
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Nao foi possivel carregar o mural.')
  await expect(page.getByText('O próximo assunto pode começar com você.', { exact: false })).toBeHidden()
  const requests = api.calls.filter((call) => call.path === '/api/mensagens').length
  expect(requests).toBeGreaterThanOrEqual(2)
  expect(requests).toBeLessThanOrEqual(3)
  api.messageStatus = 200
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByText('Mensagem existente', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toBeHidden()
})

test('falha na publicacao nao repete POST e preserva o texto para nova tentativa', async ({ page }) => {
  const api = await mockQueryApi(page, { user: marina })
  api.sendStatus = 503
  await page.goto('/')
  await page.getByLabel('Sua mensagem').fill('Preservar rascunho')
  await page.getByRole('button', { name: 'Publicar mensagem' }).click()
  await expect(page.getByRole('alert')).toContainText('Publicacao recusada.')
  await expect(page.getByLabel('Sua mensagem')).toHaveValue('Preservar rascunho')
  expect(api.calls.filter((call) => call.path === '/api/mensagens' && call.method === 'POST')).toHaveLength(1)
  api.sendStatus = 201
  await page.getByRole('button', { name: 'Publicar mensagem' }).click()
  await expect(page.getByText('Preservar rascunho', { exact: true })).toBeVisible()
})
