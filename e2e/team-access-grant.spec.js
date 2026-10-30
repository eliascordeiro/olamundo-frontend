import { test, expect } from '@playwright/test'
import { setupTeam, openTeam } from './team-api'

async function openSeller(page, api) {
  api.salespeople.north = [{ id: 'seller', storeId: 'north', name: 'Marina Multiloja', active: true, userId: null, version: 0 }]
  api.salespeople.south = []
  await openTeam(page)
  await page.getByRole('button', { name: 'Gerenciar Marina Multiloja', exact: true }).click()
}

test('proprietário escolhe as lojas por nome e o vendedor ganha acesso em todas', async ({ page }) => {
  const api = await setupTeam(page)
  await openSeller(page, api)
  const current = page.getByLabel('Móveis Norte (esta loja)')
  await expect(current).toBeChecked()
  await expect(current).toBeDisabled()
  await expect(page.getByLabel('Eletro Sul', { exact: true })).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: /Loja colaborador/ })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: /Loja gerente/ })).toHaveCount(0)
  await page.getByLabel('Eletro Sul', { exact: true }).check()
  await page.getByLabel('Perfil em Eletro Sul').selectOption('MANAGER')
  await page.getByLabel('E-mail da conta', { exact: true }).fill('  vendedor@example.com ')
  await page.getByRole('button', { name: 'Vincular conta', exact: true }).click()
  await expect(page.getByText('Conta vinculada e acesso concedido', { exact: false })).toBeVisible()
  await expect(page.getByText('Conta vinculada: vendedor@example.com', { exact: true })).toBeVisible()
  const grant = api.teamCalls.find(call => call.action === 'access')
  expect(grant.body).toEqual({
    email: 'vendedor@example.com', version: 0,
    stores: [{ storeId: 'north', role: 'STAFF' }, { storeId: 'south', role: 'MANAGER' }],
  })
  expect(grant.headers['x-csrf-token']).toBe('test-csrf')
  expect(api.salespeople.south).toHaveLength(1)
  expect(api.salespeople.south[0]).toMatchObject({ name: 'Marina Multiloja', userId: 'account-vendedor' })
})

test('e-mail sem conta gera convite exibido uma única vez para o vendedor criar a senha', async ({ page }) => {
  const api = await setupTeam(page)
  await openSeller(page, api)
  await page.getByLabel('E-mail da conta', { exact: true }).fill('novo@example.com')
  await page.getByRole('button', { name: 'Vincular conta', exact: true }).click()
  const invite = page.getByLabel('Convite emitido')
  await expect(invite).toContainText('/?acesso=seller-token')
  await expect(invite).toContainText('exibido uma única vez')
  await expect(page.getByText('Sem conta vinculada', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Fechar convite', exact: true }).click()
  await expect(invite).toHaveCount(0)
  expect(api.salespeople.south).toHaveLength(0)
})

test('vendedor convidado define a senha pelo link e vê as lojas liberadas', async ({ page }) => {
  const api = await setupTeam(page)
  api.user = null
  const accepts = []
  await page.route('**/api/seller-invites/accept', async route => {
    accepts.push({ body: route.request().postDataJSON(), headers: route.request().headers() })
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ email: 'novo@example.com', stores: ['Móveis Norte', 'Eletro Sul'] }) })
  })
  await page.goto('/?acesso=tok_Abc-123')
  expect(new URL(page.url()).search).toBe('')
  await expect(page.getByText('acessar as lojas de um proprietário', { exact: false })).toBeVisible()
  await page.getByLabel('Seu nome', { exact: true }).fill('Novo Vendedor')
  await page.getByLabel('Nova senha', { exact: true }).fill('uma-senha-bem-longa-123')
  await page.getByRole('button', { name: 'Criar meu acesso', exact: true }).click()
  await expect(page.getByText('Lojas liberadas: Móveis Norte, Eletro Sul.')).toBeVisible()
  expect(accepts[0].body).toEqual({ token: 'tok_Abc-123', name: 'Novo Vendedor', password: 'uma-senha-bem-longa-123' })
  expect(accepts[0].headers['x-csrf-token']).toBe('test-csrf')
  await page.getByRole('button', { name: 'Ir para o login', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.', exact: true })).toBeVisible()
})
