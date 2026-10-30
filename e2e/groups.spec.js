import { test, expect } from '@playwright/test'
import { marina, mockQueryApi } from './query-api'

async function setupGroups(page) {
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [{ id: 'north', name: 'Móveis Norte', role: 'OWNER' }, { id: 'staff', name: 'Loja colaborador', role: 'STAFF' }]
  api.groups = []
  api.groupCalls = []
  api.groupsStatus = 200
  api.groupWriteStatus = 200
  const pct = (value) => (value === null || value === undefined ? 0 : value)
  await page.route('**/api/stores/*/product-groups**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const match = url.pathname.match(/^\/api\/stores\/([^/]+)\/product-groups(?:\/([^/]+)(?:\/subgroups(?:\/([^/]+))?)?)?$/)
    const [, storeId, groupId, subId] = match
    const isSub = url.pathname.includes('/subgroups')
    const method = request.method()
    const body = method === 'POST' ? request.postDataJSON() : undefined
    api.groupCalls.push({ storeId, groupId, subId, isSub, method, body, headers: request.headers() })
    const respond = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (method === 'GET') {
      if (api.groupsStatus !== 200) return respond(api.groupsStatus, { message: 'Falha ao carregar grupos.' })
      return respond(200, structuredClone(api.groups))
    }
    if (request.headers()['x-csrf-token'] !== 'test-csrf') return respond(403, { message: 'CSRF ausente.' })
    if (api.groupWriteStatus !== 200) return respond(api.groupWriteStatus, { message: 'Já existe um grupo com este nome.' })
    if (!isSub) {
      if (!groupId) {
        const { requestId, ...fields } = body
        const group = { id: requestId, version: 0, subgroups: [], ncm: null, commission: 0, assemblyCommission: 0,
          assemblyDiscount: 0, markup: 0, pautaDiscount: 0, flexibleDiscount: 0, ...fields }
        for (const key of ['commission', 'assemblyCommission', 'assemblyDiscount', 'markup', 'pautaDiscount', 'flexibleDiscount']) group[key] = pct(group[key])
        api.groups.push(group)
        return respond(200, group)
      }
      const group = api.groups.find(item => item.id === groupId)
      if (body.version !== group.version) return respond(409, { message: 'Cadastro alterado em outra operacao.' })
      Object.assign(group, body, { version: group.version + 1 })
      return respond(200, group)
    }
    const group = api.groups.find(item => item.id === groupId)
    if (!subId) {
      const { requestId, ...fields } = body
      const subgroup = { id: requestId, groupId, version: 0, markup: 0, margin: 0, pautaDiscount: 0, flexibleDiscount: 0, ...fields }
      group.subgroups.push(subgroup)
      return respond(200, subgroup)
    }
    const subgroup = group.subgroups.find(item => item.id === subId)
    if (body.version !== subgroup.version) return respond(409, { message: 'Cadastro alterado em outra operacao.' })
    Object.assign(subgroup, body, { version: subgroup.version + 1 })
    return respond(200, subgroup)
  })
  return api
}

async function openGroups(page, storeId = 'north') {
  await page.goto('/')
  await page.getByLabel('Loja ativa').selectOption(storeId)
  await page.getByRole('button', { name: 'Grupos de produtos', exact: true }).click()
}

test('proprietário cadastra grupo e subgrupo e os edita', async ({ page }) => {
  const api = await setupGroups(page)
  await openGroups(page)
  await expect(page.getByText('Nenhum grupo cadastrado.')).toBeVisible()
  await page.getByRole('button', { name: 'Novo grupo', exact: true }).click()
  const form = page.getByRole('form', { name: 'Cadastrar grupo' })
  await form.getByLabel('Nome do grupo', { exact: true }).fill(' SOFA ')
  await form.getByLabel('NCM', { exact: true }).fill('9401.61.00')
  await form.getByLabel('Comissão (%)', { exact: true }).fill('1,5')
  await form.getByLabel('Markup (%)', { exact: true }).fill('130')
  await form.getByRole('button', { name: 'Cadastrar grupo', exact: true }).click()
  await expect(page.getByText('Grupo cadastrado.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'SOFA', exact: true })).toBeVisible()
  await expect(page.getByText('NCM 9401.61.00 · Comissão 1,5% · Markup 130%', { exact: true })).toBeVisible()
  const created = api.groupCalls.find(call => call.method === 'POST')
  expect(created.body).toMatchObject({ name: 'SOFA', ncm: '9401.61.00', commission: 1.5, markup: 130, assemblyCommission: null })
  expect(created.headers['x-csrf-token']).toBe('test-csrf')

  await page.getByRole('button', { name: 'Novo subgrupo em SOFA', exact: true }).click()
  const sub = page.getByRole('form', { name: 'Cadastrar subgrupo em SOFA' })
  await sub.getByLabel('Nome do subgrupo', { exact: true }).fill('RETRATIL')
  await sub.getByLabel('Margem (%)', { exact: true }).fill('25.5')
  await sub.getByRole('button', { name: 'Cadastrar subgrupo', exact: true }).click()
  await expect(page.getByText('Subgrupo cadastrado.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Subgrupos de SOFA' }).getByText('Markup 0% · Margem 25,5%', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Editar grupo SOFA', exact: true }).click()
  const edit = page.getByRole('form', { name: 'Editar grupo SOFA' })
  await edit.getByLabel('Nome do grupo', { exact: true }).fill('SOFAS')
  await edit.getByRole('button', { name: 'Salvar grupo', exact: true }).click()
  await expect(page.getByText('Grupo atualizado.')).toBeVisible()
  expect(api.groups[0]).toMatchObject({ name: 'SOFAS', version: 1 })

  await page.getByRole('button', { name: 'Editar subgrupo RETRATIL', exact: true }).click()
  const editSub = page.getByRole('form', { name: 'Editar subgrupo RETRATIL' })
  await editSub.getByLabel('Markup (%)', { exact: true }).fill('40')
  await editSub.getByRole('button', { name: 'Salvar subgrupo', exact: true }).click()
  await expect(page.getByText('Subgrupo atualizado.')).toBeVisible()
  expect(api.groups[0].subgroups[0]).toMatchObject({ markup: 40, version: 1 })
})

test('colaborador consulta grupos sem botões de cadastro ou edição', async ({ page }) => {
  const api = await setupGroups(page)
  api.groups = [{ id: 'g1', name: 'ELETRO', ncm: null, commission: 1, assemblyCommission: 0, assemblyDiscount: 0, markup: 40,
    pautaDiscount: 0, flexibleDiscount: 0, version: 0,
    subgroups: [{ id: 's1', groupId: 'g1', name: 'GELADEIRA', markup: 10, margin: 5, pautaDiscount: 0, flexibleDiscount: 0, version: 0 }] }]
  await openGroups(page, 'staff')
  await expect(page.getByRole('heading', { name: 'ELETRO', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'GELADEIRA', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Novo grupo' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Editar/ })).toHaveCount(0)
  expect(api.groupCalls.filter(call => call.method === 'POST')).toHaveLength(0)
})

test('erro de consulta e nome duplicado são exibidos', async ({ page }) => {
  const api = await setupGroups(page)
  api.groupsStatus = 503
  await openGroups(page)
  await expect(page.getByRole('alert')).toContainText('Falha ao carregar grupos')
  await expect(page.getByText('Nenhum grupo cadastrado.')).toHaveCount(0)
  api.groupsStatus = 200
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  api.groupWriteStatus = 409
  await page.getByRole('button', { name: 'Novo grupo', exact: true }).click()
  const form = page.getByRole('form', { name: 'Cadastrar grupo' })
  await form.getByLabel('Nome do grupo', { exact: true }).fill('Repetido')
  await form.getByRole('button', { name: 'Cadastrar grupo', exact: true }).click()
  await expect(form.getByRole('alert')).toContainText('Já existe um grupo com este nome.')
  await expect(form.getByLabel('Nome do grupo', { exact: true })).toHaveValue('Repetido')
})
