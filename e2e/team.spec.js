import { test, expect } from '@playwright/test'
import { setupTeam, openTeam } from './team-api'

test('proprietário cadastra, vincula e inativa vendedor sem conceder acesso', async ({ page }) => {
  const api = await setupTeam(page)
  await openTeam(page)
  await expect(page.getByText('Nenhum vendedor nesta página.')).toBeVisible()
  await page.getByRole('button', { name: '+ Novo vendedor', exact: true }).click()
  await page.getByLabel('Nome do novo vendedor', { exact: true }).fill('  Marina Silva  ')
  await page.getByRole('button', { name: 'Cadastrar vendedor', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Marina Silva', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Gerenciar vendedor' })).toBeVisible()
  await page.getByLabel('Nome do vendedor', { exact: true }).fill('Marina Comercial')
  await page.getByLabel('Vendedor ativo', { exact: true }).uncheck()
  await page.getByLabel('E-mail da conta', { exact: true }).fill(api.memberEmail)
  await page.getByRole('button', { name: 'Vincular conta', exact: true }).click()
  await expect(page.getByText('Conta vinculada: vendedor@example.com', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Nome do vendedor', { exact: true })).toHaveValue('Marina Comercial')
  await expect(page.getByLabel('Vendedor ativo', { exact: true })).not.toBeChecked()
  await page.getByRole('button', { name: 'Salvar cadastro comercial', exact: true }).click()
  await expect(page.getByText('Inativo', { exact: true })).toBeVisible()
  await expect(page.getByText('Inativar não bloqueia o login nem revoga permissões.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Desvincular conta', exact: true }).click()
  await expect(page.getByText('Sem conta vinculada', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Equipe e vendedores', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Marina Comercial', exact: true })).toBeVisible()
  expect(api.salespeople.north).toHaveLength(1)
  expect(api.salespeople.north[0]).toMatchObject({ active: false, userId: null, version: 3 })
  expect(api.calls.filter(call => call.method === 'POST' && !call.path.includes('/auth/'))).toHaveLength(0)
  expect(api.teamCalls.filter(call => call.method === 'POST').every(call => call.headers['x-csrf-token'] === 'test-csrf')).toBe(true)
})

test('vendedores têm paginação e interface responsiva em telas pequenas', async ({ page }) => {
  const api = await setupTeam(page)
  api.salespeople.north = Array.from({ length: 21 }, (_, index) => ({
    id: `seller-${index}`, storeId: 'north', name: `Vendedor ${index}`, active: true, userId: null, version: 0,
  }))
  await openTeam(page)
  await page.getByRole('button', { name: 'Próxima página de vendedores', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Vendedor 20', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Gerenciar Vendedor 20', exact: true }).click()
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('button', { name: 'Salvar cadastro comercial', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
