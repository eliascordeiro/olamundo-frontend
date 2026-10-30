import { test, expect } from '@playwright/test'
import { marina, mockQueryApi } from './query-api'

async function setupSuppliers(page) {
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [{ id: 'north', name: 'Móveis Norte', role: 'OWNER' }, { id: 'staff', name: 'Loja colaborador', role: 'STAFF' }]
  api.suppliers = []
  api.supplierCalls = []
  api.suppliersStatus = 200
  api.supplierWriteStatus = 200
  api.dropSupplierCreation = false
  await page.route('**/api/stores/*/suppliers**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const [, storeId, id] = url.pathname.match(/^\/api\/stores\/([^/]+)\/suppliers(?:\/([^/]+))?$/)
    const method = request.method()
    const body = method === 'POST' ? request.postDataJSON() : undefined
    api.supplierCalls.push({ storeId, id, method, body, search: url.search, headers: request.headers() })
    const respond = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (method === 'GET') {
      if (api.suppliersStatus !== 200) return respond(api.suppliersStatus, { message: 'Falha ao carregar fornecedores.' })
      if (id) return respond(200, structuredClone(api.suppliers.find(supplier => supplier.id === id)))
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const rows = api.suppliers.filter(supplier => !q || supplier.name.toLowerCase().includes(q))
      return respond(200, { content: rows.slice(0, 20), page: 0, size: 20, hasNext: rows.length > 20 })
    }
    if (request.headers()['x-csrf-token'] !== 'test-csrf') return respond(403, { message: 'CSRF ausente.' })
    if (api.supplierWriteStatus !== 200) return respond(api.supplierWriteStatus, { message: 'Já existe um fornecedor com este CNPJ/CPF.' })
    if (!id) {
      let supplier = api.suppliers.find(item => item.id === body.requestId)
      if (!supplier) {
        const { requestId, ...fields } = body
        supplier = { id: requestId, version: 0, active: true, document: null, phone: null, city: null, ...fields }
        api.suppliers.push(supplier)
      }
      if (api.dropSupplierCreation) {
        api.dropSupplierCreation = false
        return route.abort('failed')
      }
      return respond(200, supplier)
    }
    const supplier = api.suppliers.find(item => item.id === id)
    if (body.version !== supplier.version) return respond(409, { message: 'Fornecedor alterado em outra operacao.' })
    Object.assign(supplier, body, { version: supplier.version + 1 })
    return respond(200, supplier)
  })
  return api
}

async function openSuppliers(page, storeId = 'north') {
  await page.goto('/')
  await page.getByLabel('Loja ativa').selectOption(storeId)
  await page.getByRole('button', { name: 'Fornecedores', exact: true }).click()
}

test('proprietário cadastra fornecedor, que aparece formatado e abre para edição', async ({ page }) => {
  const api = await setupSuppliers(page)
  await openSuppliers(page)
  await expect(page.getByText('Nenhum fornecedor nesta página.')).toBeVisible()
  const form = page.getByRole('form', { name: 'Cadastrar fornecedor' })
  await form.getByLabel('Nome do fornecedor', { exact: true }).fill('  Madeireira Sul ')
  await form.getByLabel('CNPJ/CPF', { exact: true }).fill('11.222.333/0001-81')
  await form.getByLabel('Telefone', { exact: true }).fill('(41) 3797-8329')
  await form.getByRole('button', { name: 'Cadastrar fornecedor', exact: true }).click()
  await expect(page.getByText('Fornecedor Madeireira Sul cadastrado.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Fornecedores' }).getByText('11.222.333/0001-81 · (41) 3797-8329', { exact: true })).toBeVisible()
  const post = api.supplierCalls.find(call => call.method === 'POST')
  expect(post.body).toMatchObject({ name: 'Madeireira Sul', document: '11.222.333/0001-81', phone: '(41) 3797-8329', email: null })
  expect(post.headers['x-csrf-token']).toBe('test-csrf')

  const edit = page.getByRole('form', { name: 'Editar Madeireira Sul' })
  await edit.getByLabel('Nome do fornecedor', { exact: true }).fill('Madeireira Sul Ltda')
  await edit.getByLabel('Fornecedor ativo').uncheck()
  await edit.getByRole('button', { name: 'Salvar fornecedor', exact: true }).click()
  await expect(page.getByText('Fornecedor atualizado.')).toBeVisible()
  expect(api.suppliers[0]).toMatchObject({ name: 'Madeireira Sul Ltda', active: false, version: 1 })
  await expect(page.getByText('Inativo', { exact: false }).first()).toBeVisible()
})

test('colaborador consulta mas não vê formulários de cadastro nem de edição', async ({ page }) => {
  const api = await setupSuppliers(page)
  api.suppliers = [{ id: 's1', name: 'Fornecedor Existente', document: null, phone: null, city: null, active: true, version: 0 }]
  await openSuppliers(page, 'staff')
  await expect(page.getByRole('heading', { name: 'Fornecedor Existente', exact: true })).toBeVisible()
  await expect(page.getByRole('form', { name: 'Cadastrar fornecedor' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Abrir Fornecedor Existente', exact: true }).click()
  const edit = page.getByRole('form', { name: 'Editar Fornecedor Existente' })
  await expect(edit.getByLabel('Nome do fornecedor', { exact: true })).toBeDisabled()
  await expect(edit.getByRole('button', { name: 'Salvar fornecedor' })).toHaveCount(0)
  await expect(page.getByText('Somente proprietário e gerente editam fornecedores.', { exact: false })).toBeVisible()
  expect(api.supplierCalls.filter(call => call.method === 'POST')).toHaveLength(0)
})

test('busca no servidor, erro de consulta e CNPJ duplicado são exibidos', async ({ page }) => {
  const api = await setupSuppliers(page)
  api.suppliers = [
    { id: 'a', name: 'Alfa Moveis', document: null, phone: null, city: null, active: true, version: 0 },
    { id: 'b', name: 'Beta Colchoes', document: null, phone: null, city: null, active: true, version: 0 },
  ]
  api.suppliersStatus = 503
  await openSuppliers(page)
  await expect(page.getByRole('alert')).toContainText('Falha ao carregar fornecedores')
  await expect(page.getByText('Nenhum fornecedor nesta página.')).toHaveCount(0)
  api.suppliersStatus = 200
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await page.getByLabel('Buscar fornecedor').fill('beta')
  await expect(page.getByRole('list', { name: 'Fornecedores' }).getByRole('listitem')).toHaveCount(1)
  await expect.poll(() => api.supplierCalls.some(call => call.search.includes('q=beta'))).toBe(true)
  api.supplierWriteStatus = 409
  const form = page.getByRole('form', { name: 'Cadastrar fornecedor' })
  await form.getByLabel('Nome do fornecedor', { exact: true }).fill('Duplicado')
  await form.getByRole('button', { name: 'Cadastrar fornecedor', exact: true }).click()
  await expect(form.getByRole('alert')).toContainText('Já existe um fornecedor com este CNPJ/CPF.')
  await expect(form.getByLabel('Nome do fornecedor', { exact: true })).toHaveValue('Duplicado')
})

test('cadastro com resposta perdida conserva o envio e não duplica', async ({ page }) => {
  const api = await setupSuppliers(page)
  api.dropSupplierCreation = true
  await openSuppliers(page)
  const form = page.getByRole('form', { name: 'Cadastrar fornecedor' })
  await form.getByLabel('Nome do fornecedor', { exact: true }).fill('Envio incerto')
  await form.getByRole('button', { name: 'Cadastrar fornecedor', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar')
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click()
  await page.getByRole('button', { name: 'Fornecedores', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar mesmo cadastro', exact: true }).click()
  await expect(page.getByText('Fornecedor Envio incerto cadastrado.')).toBeVisible()
  const writes = api.supplierCalls.filter(call => call.method === 'POST')
  expect(writes).toHaveLength(2)
  expect(writes[0].body).toEqual(writes[1].body)
  expect(api.suppliers).toHaveLength(1)
})
