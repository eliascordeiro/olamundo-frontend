import { test, expect } from '@playwright/test'
import { marina, mockQueryApi } from './query-api'

async function setupCustomers(page, { role = 'OWNER' } = {}) {
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [{ id: 'north', name: 'Móveis Norte', role }, { id: 'south', name: 'Eletro Sul', role: 'STAFF' }]
  api.customers = []
  api.customerCalls = []
  api.customersStatus = 200
  api.dropCustomerCreation = false
  api.customerWriteStatus = 200
  api.addresses = []
  api.addressCalls = []
  api.addressWriteStatus = 200
  await page.route('**/api/stores/*/customers/*/delivery-addresses**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const [, storeId, customerId, id] = url.pathname.match(/^\/api\/stores\/([^/]+)\/customers\/([^/]+)\/delivery-addresses(?:\/([^/]+))?$/)
    const method = request.method()
    const body = method === 'POST' ? request.postDataJSON() : undefined
    api.addressCalls.push({ storeId, customerId, id, method, body, search: url.search, headers: request.headers() })
    const respond = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (method === 'GET') return respond(200, structuredClone(api.addresses.filter(address => address.customerId === customerId)))
    if (request.headers()['x-csrf-token'] !== 'test-csrf') return respond(403, { message: 'CSRF ausente.' })
    if (api.addressWriteStatus !== 200) return respond(api.addressWriteStatus, { message: 'Endereco alterado em outra operacao. Recarregue.' })
    if (method === 'DELETE') {
      api.addresses = api.addresses.filter(address => address.id !== id)
      return route.fulfill({ status: 204 })
    }
    if (!id) {
      const { requestId, ...fields } = body
      const address = { id: requestId, customerId, version: 0, zip: null, number: null, complement: null, neighborhood: null, city: null, state: null, ...fields }
      api.addresses.push(address)
      return respond(200, address)
    }
    const address = api.addresses.find(item => item.id === id)
    Object.assign(address, body, { version: address.version + 1 })
    return respond(200, address)
  })
  await page.route('**/api/stores/*/customers**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/delivery-addresses') || url.pathname.includes('/delivery-addresses/')) return route.fallback()
    const [, storeId, id] = url.pathname.match(/^\/api\/stores\/([^/]+)\/customers(?:\/([^/]+))?$/)
    const method = request.method()
    const body = method === 'POST' ? request.postDataJSON() : undefined
    api.customerCalls.push({ storeId, id, method, body, search: url.search, headers: request.headers() })
    const respond = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (method === 'GET') {
      if (api.customersStatus !== 200) return respond(api.customersStatus, { message: api.customersMessage ?? 'Falha ao carregar clientes.' })
      if (id) return respond(200, structuredClone(api.customers.find(customer => customer.id === id)))
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const page = Number(url.searchParams.get('page') || 0)
      const size = Number(url.searchParams.get('size') || 20)
      const rows = api.customers.filter(customer => !q || customer.name.toLowerCase().includes(q))
      return respond(200, { content: rows.slice(page * size, (page + 1) * size), page, size, hasNext: rows.length > (page + 1) * size })
    }
    if (request.headers()['x-csrf-token'] !== 'test-csrf') return respond(403, { message: 'CSRF ausente.' })
    if (api.customerWriteStatus !== 200) return respond(api.customerWriteStatus, { message: 'Já existe um cliente com este CPF/CNPJ.' })
    if (!id) {
      let customer = api.customers.find(item => item.id === body.requestId)
      if (!customer) {
        const { requestId, ...fields } = body
        customer = { id: requestId, version: 0, document: null, phone: null, mobile: null, city: null, ...fields }
        api.customers.push(customer)
      }
      if (api.dropCustomerCreation) {
        api.dropCustomerCreation = false
        return route.abort('failed')
      }
      return respond(200, customer)
    }
    const customer = api.customers.find(item => item.id === id)
    if (body.version !== customer.version) return respond(409, { message: 'Cliente alterado em outra operacao. Recarregue.' })
    Object.assign(customer, body, { version: customer.version + 1 })
    return respond(200, customer)
  })
  return api
}

async function openCustomers(page, storeId = 'north') {
  await page.goto('/')
  await page.getByLabel('Loja ativa').selectOption(storeId)
  await page.getByRole('button', { name: 'Clientes', exact: true }).click()
}

test('lista paginada e busca no servidor com CPF formatado', async ({ page }) => {
  const api = await setupCustomers(page)
  api.customers = Array.from({ length: 21 }, (_, index) => ({
    id: `c${index}`, name: index === 20 ? 'Zélia Procurada' : `Cliente ${String(index).padStart(2, '0')}`,
    document: index === 0 ? '52998224725' : null, phone: null, mobile: '41 99999-1234', city: 'Curitiba', version: 0,
  }))
  await openCustomers(page)
  await expect(page.getByRole('heading', { name: 'Cliente 00', exact: true })).toBeVisible()
  await expect(page.getByText('529.982.247-25 · 41 99999-1234 · Curitiba', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Próxima página', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Zélia Procurada', exact: true })).toBeVisible()
  await page.getByLabel('Buscar cliente').fill('zélia')
  await expect(page.getByRole('list', { name: 'Clientes' }).getByRole('listitem')).toHaveCount(1)
  await expect.poll(() => api.customerCalls.some(call => call.search.includes('q=z%C3%A9lia') && call.search.includes('page=0'))).toBe(true)
  await page.getByLabel('Buscar cliente').fill('inexistente')
  await expect(page.getByText('Nenhum cliente encontrado para esta busca.')).toBeVisible()
})

test('qualquer membro cadastra cliente; campos vazios viram nulos e o CSRF é enviado', async ({ page }) => {
  const api = await setupCustomers(page)
  await openCustomers(page, 'south')
  await expect(page.getByText('Nenhum cliente nesta página.')).toBeVisible()
  await page.getByRole('button', { name: '+ Novo cliente', exact: true }).click()
  const form = page.getByRole('form', { name: 'Cadastrar cliente' })
  await form.getByLabel('Nome do cliente', { exact: true }).fill('  Maria Souza ')
  await form.getByLabel('CPF/CNPJ', { exact: true }).fill('529.982.247-25')
  await form.getByLabel('E-mail', { exact: true }).fill('maria@example.com')
  await form.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click()
  await expect(page.getByText('Cliente Maria Souza cadastrado.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Maria Souza', exact: true })).toBeVisible()
  const post = api.customerCalls.find(call => call.method === 'POST')
  expect(post.storeId).toBe('south')
  expect(post.body).toMatchObject({ name: 'Maria Souza', document: '529.982.247-25', email: 'maria@example.com', phone: null, zip: null })
  expect(typeof post.body.requestId).toBe('string')
  expect(post.headers['x-csrf-token']).toBe('test-csrf')
  await expect(page.getByRole('form', { name: 'Editar Maria Souza' })).toBeVisible()
})

test('edição usa versão e conflito exige recarregar antes de salvar de novo', async ({ page }) => {
  const api = await setupCustomers(page)
  api.customers = [{ id: 'c1', name: 'Original', document: null, phone: null, mobile: null, city: null, version: 0 }]
  await openCustomers(page)
  await page.getByRole('button', { name: 'Abrir Original', exact: true }).click()
  const form = page.getByRole('form', { name: 'Editar Original' })
  await form.getByLabel('Nome do cliente', { exact: true }).fill('Editado')
  await form.getByRole('button', { name: 'Salvar cliente', exact: true }).click()
  await expect(page.getByText('Cliente atualizado.')).toBeVisible()
  expect(api.customers[0]).toMatchObject({ name: 'Editado', version: 1 })
  expect(api.customerCalls.filter(call => call.method === 'POST')[0].body.version).toBe(0)

  api.customers[0].name = 'Outra edição'
  api.customers[0].version = 5
  const edit = page.getByRole('form', { name: 'Editar Editado' })
  await edit.getByLabel('Nome do cliente', { exact: true }).fill('Minha edição')
  await edit.getByRole('button', { name: 'Salvar cliente', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Cliente alterado')
  await expect(edit.getByRole('button', { name: 'Salvar cliente', exact: true })).toBeDisabled()
  await edit.getByRole('button', { name: 'Recarregar cadastro', exact: true }).click()
  await expect(page.getByRole('form', { name: 'Editar Outra edição' }).getByLabel('Nome do cliente')).toHaveValue('Outra edição')
  await expect(page.getByRole('form', { name: 'Editar Outra edição' }).getByRole('button', { name: 'Salvar cliente', exact: true })).toBeEnabled()
})

test('cadastro com resposta perdida conserva o envio e não duplica', async ({ page }) => {
  const api = await setupCustomers(page)
  api.dropCustomerCreation = true
  await openCustomers(page)
  await page.getByRole('button', { name: '+ Novo cliente', exact: true }).click()
  const form = page.getByRole('form', { name: 'Cadastrar cliente' })
  await form.getByLabel('Nome do cliente', { exact: true }).fill('Envio incerto')
  await form.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click()
  await page.getByRole('button', { name: 'Clientes', exact: true }).click()
  await page.getByRole('button', { name: '+ Novo cliente', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar mesmo cadastro', exact: true }).click()
  await expect(page.getByText('Cliente Envio incerto cadastrado.')).toBeVisible()
  const writes = api.customerCalls.filter(call => call.method === 'POST')
  expect(writes).toHaveLength(2)
  expect(writes[0].body).toEqual(writes[1].body)
  expect(api.customers).toHaveLength(1)
})

test('erros de consulta e CPF duplicado são exibidos sem fingir lista vazia', async ({ page }) => {
  const api = await setupCustomers(page)
  api.customersStatus = 409
  api.customersMessage = 'Esta loja ainda não pertence a uma empresa. Fale com o administrador da plataforma.'
  await openCustomers(page)
  await expect(page.getByRole('alert')).toContainText('não pertence a uma empresa')
  await expect(page.getByText('Nenhum cliente nesta página.')).toHaveCount(0)
  api.customersStatus = 200
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(page.getByText('Nenhum cliente nesta página.')).toBeVisible()
  api.customerWriteStatus = 409
  await page.getByRole('button', { name: '+ Novo cliente', exact: true }).click()
  const form = page.getByRole('form', { name: 'Cadastrar cliente' })
  await form.getByLabel('Nome do cliente', { exact: true }).fill('Duplicado')
  await form.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click()
  await expect(form.getByRole('alert')).toContainText('Já existe um cliente com este CPF/CNPJ.')
  await expect(form.getByLabel('Nome do cliente', { exact: true })).toHaveValue('Duplicado')
})

test('endereços de entrega: lista, cadastra, edita e remove com confirmação', async ({ page }) => {
  const api = await setupCustomers(page)
  api.customers = [{ id: 'c1', name: 'Com Entrega', document: null, phone: null, mobile: null, city: null, version: 0 }]
  api.addresses = [{ id: 'a1', customerId: 'c1', version: 0, zip: '83709200', street: 'RUA DAS FLORES', number: '5',
    complement: 'Cond. SOL', neighborhood: 'CENTRO', city: 'ARAUCARIA', state: 'PR' }]
  await openCustomers(page)
  await page.getByRole('button', { name: 'Abrir Com Entrega', exact: true }).click()
  const section = page.getByRole('region', { name: 'Endereços de entrega' })
  await expect(section.getByText('RUA DAS FLORES, 5 · Cond. SOL · CENTRO · ARAUCARIA/PR · 83709-200')).toBeVisible()

  const form = section.getByRole('form', { name: 'Cadastrar endereço de entrega' })
  await form.getByLabel('Endereço', { exact: true }).fill(' Rua Nova ')
  await form.getByLabel('UF', { exact: true }).fill('PR')
  await form.getByRole('button', { name: 'Cadastrar endereço', exact: true }).click()
  await expect(section.getByText('Rua Nova · PR')).toBeVisible()
  const created = api.addressCalls.find(call => call.method === 'POST')
  expect(created.body).toMatchObject({ street: 'Rua Nova', state: 'PR', zip: null, number: null })
  expect(created.headers['x-csrf-token']).toBe('test-csrf')

  await section.getByRole('listitem').filter({ hasText: 'RUA DAS FLORES' }).getByRole('button', { name: 'Editar', exact: true }).click()
  const edit = section.getByRole('form', { name: 'Editar endereço RUA DAS FLORES' })
  await edit.getByLabel('Número', { exact: true }).fill('99')
  await edit.getByRole('button', { name: 'Salvar endereço', exact: true }).click()
  await expect(section.getByText('RUA DAS FLORES, 99', { exact: false })).toBeVisible()
  expect(api.addressCalls.filter(call => call.method === 'POST')[1].body.version).toBe(0)

  await section.getByRole('listitem').filter({ hasText: 'Rua Nova' }).getByRole('button', { name: 'Remover', exact: true }).click()
  expect(api.addresses).toHaveLength(2)
  await section.getByRole('button', { name: 'Confirmar remoção', exact: true }).click()
  await expect(section.getByText('Rua Nova')).toHaveCount(0)
  expect(api.addressCalls.at(-2)).toMatchObject({ method: 'DELETE', id: expect.any(String) })
  expect(api.addressCalls.find(call => call.method === 'DELETE').search).toBe('?version=0')
})

test('conflito em endereço de entrega mostra o erro e pede para recarregar', async ({ page }) => {
  const api = await setupCustomers(page)
  api.customers = [{ id: 'c1', name: 'Com Entrega', document: null, phone: null, mobile: null, city: null, version: 0 }]
  api.addresses = [{ id: 'a1', customerId: 'c1', version: 0, street: 'RUA VELHA', number: null, zip: null }]
  await openCustomers(page)
  await page.getByRole('button', { name: 'Abrir Com Entrega', exact: true }).click()
  const section = page.getByRole('region', { name: 'Endereços de entrega' })
  await expect(section.getByText('RUA VELHA')).toBeVisible()
  api.addressWriteStatus = 409
  await section.getByRole('button', { name: 'Remover', exact: true }).click()
  await section.getByRole('button', { name: 'Confirmar remoção', exact: true }).click()
  await expect(section.getByRole('alert')).toContainText('Endereco alterado')
  await expect(section.getByRole('button', { name: 'Recarregar endereços', exact: true })).toBeVisible()
})

test('cadastro abre em janela sobreposta, sem rolar a página, destaca na lista e fecha com Esc', async ({ page }) => {
  const api = await setupCustomers(page)
  api.customers = Array.from({ length: 20 }, (_, index) => ({
    id: `c${index}`, name: `Cliente ${String(index).padStart(2, '0')}`, document: null, phone: null, mobile: null, city: null, version: 0,
  }))
  await page.setViewportSize({ width: 1280, height: 700 })
  await openCustomers(page)
  const last = page.getByRole('button', { name: 'Abrir Cliente 19', exact: true })
  await last.scrollIntoViewIfNeeded()
  await last.click()
  const dialog = page.getByRole('dialog', { name: 'Cliente' })
  await expect(dialog).toBeInViewport()
  await expect(dialog.getByRole('form', { name: 'Editar Cliente 19' })).toBeVisible()
  await expect(page.locator('li.customer-selected')).toContainText('Cliente 19')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await last.click()
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(dialog).toHaveCount(0)
})
