import { test, expect } from '@playwright/test'
import { setupTeam, openTeam } from './team-api'

test('erro de consulta não aparece como lista vazia e permite recuperação', async ({ page }) => {
  const api = await setupTeam(page)
  api.teamStatus = 503
  await openTeam(page)
  await expect(page.getByRole('alert')).toContainText('Falha ao carregar vendedores')
  await expect(page.getByText('Nenhum vendedor nesta página.')).toHaveCount(0)
  api.teamStatus = 200
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(page.getByText('Nenhum vendedor nesta página.')).toBeVisible()
})

test('cadastro com resposta perdida conserva envio entre seções e não duplica', async ({ page }) => {
  const api = await setupTeam(page)
  api.dropTeamCreation = true
  await openTeam(page)
  await page.getByRole('button', { name: '+ Novo vendedor', exact: true }).click()
  await page.getByLabel('Nome do novo vendedor', { exact: true }).fill('Envio incerto')
  await page.getByRole('button', { name: 'Cadastrar vendedor', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click()
  await page.getByRole('button', { name: 'Equipe e vendedores', exact: true }).click()
  await page.getByRole('button', { name: '+ Novo vendedor', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar mesmo cadastro', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Envio incerto', exact: true })).toBeVisible()
  const writes = api.teamCalls.filter(call => call.method === 'POST')
  expect(writes).toHaveLength(2)
  expect(writes[0].body).toEqual(writes[1].body)
  expect(api.salespeople.north).toHaveLength(1)
})

test('vínculo inválido preserva conta e conflito exige recarregar antes de editar', async ({ page }) => {
  const api = await setupTeam(page)
  api.salespeople.north = [{ id: 'seller', storeId: 'north', name: 'Original', active: true, userId: null, version: 0 }]
  await openTeam(page)
  await page.getByRole('button', { name: 'Gerenciar Original', exact: true }).click()
  api.accessError = { status: 400, message: 'A loja deste cadastro deve estar na lista.' }
  await page.getByLabel('E-mail da conta', { exact: true }).fill('fora@example.com')
  await page.getByRole('button', { name: 'Vincular conta', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('A loja deste cadastro deve estar na lista')
  expect(api.salespeople.north[0].userId).toBeNull()
  api.salespeople.north[0].name = 'Outra edição'
  api.salespeople.north[0].version = 1
  await page.getByLabel('Nome do vendedor', { exact: true }).fill('Minha edição')
  await page.getByRole('button', { name: 'Salvar cadastro comercial', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Cadastro alterado')
  await expect(page.getByRole('button', { name: 'Salvar cadastro comercial', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Recarregar cadastro', exact: true }).click()
  await expect(page.getByLabel('Nome do vendedor', { exact: true })).toHaveValue('Outra edição')
  await page.getByLabel('Nome do vendedor', { exact: true }).fill('Minha edição revisada')
  await page.getByRole('button', { name: 'Salvar cadastro comercial', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Minha edição revisada', exact: true })).toBeVisible()
})
