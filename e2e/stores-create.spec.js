import { test, expect } from '@playwright/test'
import { marina, mockQueryApi } from './query-api'

async function setupCreation(page, user) {
  const api = await mockQueryApi(page, { user })
  api.createStoreStatus = 201
  api.storeCreations = []
  await page.route('**/api/stores', async route => {
    const request = route.request()
    if (request.method() !== 'POST') return route.fallback()
    const body = request.postDataJSON()
    api.storeCreations.push({ body, headers: request.headers() })
    if (api.createStoreStatus !== 201) {
      return route.fulfill({ status: api.createStoreStatus, contentType: 'application/json',
        body: JSON.stringify({ message: 'Somente proprietarios ativos podem criar lojas.' }) })
    }
    const store = { id: 'new-store', name: body.name, role: 'OWNER', createdAt: '2026-10-29T00:00:00Z' }
    api.stores.push(store)
    api.storeDetails = store
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(store) })
  })
  return api
}

test('proprietário ativo cria a primeira loja pela tela e ela é selecionada', async ({ page }) => {
  const api = await setupCreation(page, { ...marina, platformOwner: true })
  await page.goto('/')
  await expect(page.getByText('Você ainda não tem lojas. Crie a primeira abaixo.')).toBeVisible()
  await page.getByLabel('Nome da nova loja', { exact: true }).fill('  Móveis Murimel Centro  ')
  await page.getByRole('button', { name: 'Criar loja', exact: true }).click()
  await expect(page.getByLabel('Loja ativa')).toHaveValue('new-store')
  await expect(page.getByRole('option', { name: /Móveis Murimel Centro — Proprietário/ })).toHaveCount(1)
  expect(api.storeCreations).toHaveLength(1)
  expect(api.storeCreations[0].body).toEqual({ name: 'Móveis Murimel Centro' })
  expect(api.storeCreations[0].headers['x-csrf-token']).toBe('test-csrf')
  await expect(page.getByRole('form', { name: 'Criar loja' })).toHaveCount(0)
})

test('erro na criação é exibido e o formulário conserva o nome', async ({ page }) => {
  const api = await setupCreation(page, { ...marina, platformOwner: true })
  api.createStoreStatus = 403
  await page.goto('/')
  await page.getByLabel('Nome da nova loja', { exact: true }).fill('Loja Negada')
  await page.getByRole('button', { name: 'Criar loja', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Somente proprietarios ativos')
  await expect(page.getByLabel('Nome da nova loja', { exact: true })).toHaveValue('Loja Negada')
  expect(api.stores).toHaveLength(0)
})

test('conta sem perfil de proprietário não vê o formulário de loja', async ({ page }) => {
  const api = await setupCreation(page, marina)
  await page.goto('/')
  await expect(page.getByText('Você ainda não participa de uma loja. Solicite um vínculo ao proprietário.')).toBeVisible()
  await expect(page.getByRole('form', { name: 'Criar loja' })).toHaveCount(0)
  expect(api.storeCreations).toHaveLength(0)
})
