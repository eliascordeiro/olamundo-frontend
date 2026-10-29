import { test, expect } from '@playwright/test'
import { setupTeam, openTeam } from './team-api'

test('colaborador e gerente não recebem consultas ou formulários de equipe', async ({ page }) => {
  const api = await setupTeam(page)
  await openTeam(page, 'staff')
  await expect(page.getByText('Somente o proprietário pode gerenciar a equipe desta loja.')).toBeVisible()
  await page.getByLabel('Loja ativa').selectOption('manager')
  await expect(page.getByRole('form', { name: 'Cadastrar vendedor', exact: true })).toHaveCount(0)
  expect(api.teamCalls).toHaveLength(0)
  await page.getByLabel('Loja ativa').selectOption('north')
  await expect(page.getByRole('form', { name: 'Cadastrar vendedor', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByLabel('Loja ativa')).toHaveCount(0)
  await expect(page.getByRole('form', { name: 'Cadastrar vendedor', exact: true })).toHaveCount(0)
})

test('troca de loja descarta edição e isola resposta atrasada', async ({ page }) => {
  const api = await setupTeam(page)
  let release
  api.holdTeam = new Promise(resolve => { release = resolve })
  await openTeam(page)
  await expect.poll(() => api.teamCalls.length).toBeGreaterThan(0)
  api.holdTeam = null
  await page.getByLabel('Loja ativa').selectOption('south')
  await expect(page.getByText('Nenhum vendedor nesta página.')).toBeVisible()
  release()
  await page.getByLabel('Nome do novo vendedor', { exact: true }).fill('Vendedor Sul')
  await page.getByRole('button', { name: 'Cadastrar vendedor', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Vendedor Sul', exact: true })).toBeVisible()
  await page.getByLabel('Loja ativa').selectOption('north')
  await expect(page.getByRole('heading', { name: 'Vendedor Sul', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Nome do novo vendedor', { exact: true })).toHaveValue('')
  expect(api.salespeople.north).toHaveLength(0)
  expect(api.salespeople.south).toHaveLength(1)
})

test('expiração de sessão na consulta de equipe limpa dados privados', async ({ page }) => {
  const api = await setupTeam(page)
  api.teamStatus = 401
  await openTeam(page)
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.', exact: true })).toBeVisible()
  await expect(page.getByLabel('Loja ativa')).toHaveCount(0)
})
