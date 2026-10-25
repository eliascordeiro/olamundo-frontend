import { test, expect } from '@playwright/test'
import { marina, bruno, mockQueryApi } from './query-api'

const storeA = { id: 'store-a', name: 'Loja Norte', role: 'OWNER' }
const storeB = { id: 'store-b', name: 'Loja Sul', role: 'STAFF' }
const product = (name, id = name) => ({ id, name, sku: id, description: 'Descrição do produto', price: 19.90, currency: 'BRL' })

async function setup(page) {
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [{ ...storeA }, { ...storeB }]
  api.products = {
    [storeA.id]: [product('Produto Norte')],
    [storeB.id]: [product('Produto Sul')],
  }
  return api
}

async function selectStore(page, id) {
  await page.getByLabel('Loja ativa').selectOption(id)
}

async function fillProduct(page, { sku = 'NOVO-1', price = '19,90' } = {}) {
  await page.getByLabel('Nome do produto', { exact: true }).fill('Novo produto teste')
  await page.getByLabel('SKU', { exact: true }).fill(sku)
  await page.getByLabel('Preço (R$)', { exact: true }).fill(price)
  await page.getByLabel('Descrição', { exact: true }).fill('Descrição de teste')
}

test('seletor isola catalogos e o papel por loja sem alterar o mural', async ({ page }) => {
  await setup(page)
  await page.goto('/')
  await expect(page.getByLabel('Loja ativa')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mural de conexões' })).toBeVisible()
  await selectStore(page, storeA.id)
  await expect(page.getByRole('heading', { name: 'Produto Norte', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cadastrar produto', exact: true })).toBeVisible()
  await selectStore(page, storeB.id)
  await expect(page.getByRole('heading', { name: 'Produto Sul', exact: true })).toBeVisible()
  await expect(page.getByText('Produto Norte', { exact: true })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Cadastrar produto', exact: true })).toBeHidden()
  await expect(page.getByText('Seu acesso permite consultar produtos.', { exact: false })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Loja ativa')).toHaveValue('')
  await expect(page.getByRole('heading', { name: 'Produto Sul', exact: true })).toBeHidden()
})

test('cadastro preserva preco decimal e CSRF e invalida somente o catalogo da loja', async ({ page }) => {
  const api = await setup(page)
  api.stores[0].role = 'MANAGER'
  await page.goto('/')
  await selectStore(page, storeB.id)
  await expect(page.getByRole('heading', { name: 'Produto Sul', exact: true })).toBeVisible()
  const southReads = api.calls.filter((call) => call.path === `/api/stores/${storeB.id}/products`).length
  await selectStore(page, storeA.id)
  await expect(page.getByRole('heading', { name: 'Produto Norte', exact: true })).toBeVisible()
  await fillProduct(page, { price: '0,10', sku: 'novo-1' })
  await page.getByRole('button', { name: 'Cadastrar produto', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Produto cadastrado com sucesso.')
  await expect(page.getByRole('heading', { name: 'Novo produto teste', exact: true })).toBeVisible()
  const writes = api.calls.filter((call) => call.path.endsWith('/products') && call.method === 'POST')
  expect(writes).toHaveLength(1)
  expect(writes[0].body).toMatchObject({ sku: 'NOVO-1', price: '0.10' })
  expect(writes[0].headers['x-csrf-token']).toBe('test-csrf')
  expect(api.calls.filter((call) => call.path === `/api/stores/${storeB.id}/products`).length).toBe(southReads)
  await expect(page.getByLabel('Nome do produto', { exact: true })).toHaveValue('')
  await page.reload()
  await selectStore(page, storeA.id)
  await expect(page.getByRole('heading', { name: 'Novo produto teste', exact: true })).toBeVisible()
})

test('validacao decimal e conflito de SKU preservam formulario sem repetir POST', async ({ page }) => {
  const api = await setup(page)
  api.createProductStatus = 409
  await page.goto('/')
  await selectStore(page, storeA.id)
  await fillProduct(page, { price: '1,001' })
  await page.getByRole('button', { name: 'Cadastrar produto', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('duas casas decimais')
  expect(api.calls.filter((call) => call.path.endsWith('/products') && call.method === 'POST')).toHaveLength(0)
  await page.getByLabel('Preço (R$)', { exact: true }).fill('19,90')
  await page.getByRole('button', { name: 'Cadastrar produto', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('SKU ja existe')
  await expect(page.getByLabel('Nome do produto', { exact: true })).toHaveValue('Novo produto teste')
  expect(api.calls.filter((call) => call.path.endsWith('/products') && call.method === 'POST')).toHaveLength(1)
  api.createProductStatus = 201
  await page.getByRole('button', { name: 'Cadastrar produto', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Novo produto teste', exact: true })).toBeVisible()
})

test('paginacao carrega todas as lojas e troca a pagina do catalogo sem misturar dados', async ({ page }) => {
  const api = await setup(page)
  api.stores = Array.from({ length: 21 }, (_, index) => ({
    id: `store-${index}`, name: `Loja ${index}`, role: 'OWNER',
  }))
  api.products['store-20'] = Array.from({ length: 21 }, (_, index) => product(`Item ${index}`, `SKU-${index}`))
  await page.goto('/')
  await expect(page.getByRole('option', { name: 'Loja 20 — Proprietário', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Carregar mais lojas' }).click()
  await selectStore(page, 'store-20')
  await expect(page.getByRole('heading', { name: 'Item 0', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Próxima página', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Item 20', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Item 0', exact: true })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Próxima página', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Página anterior', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Item 0', exact: true })).toBeVisible()
})

test('permissao alterada no servidor bloqueia cadastro sem perder o rascunho', async ({ page }) => {
  const api = await setup(page)
  api.stores[0].role = 'MANAGER'
  await page.goto('/')
  await selectStore(page, storeA.id)
  await expect(page.getByRole('heading', { name: 'Produto Norte', exact: true })).toBeVisible()
  await fillProduct(page)
  api.stores[0].role = 'STAFF'
  await page.getByRole('button', { name: 'Cadastrar produto', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Acesso negado.')
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.getByLabel('SKU', { exact: true })).toHaveValue('NOVO-1')
  expect(api.calls.filter((call) => call.path.endsWith('/products') && call.method === 'POST')).toHaveLength(1)
  expect(api.products[storeA.id]).toHaveLength(1)
  await selectStore(page, storeB.id)
  await expect(page.getByRole('heading', { name: 'Produto Sul', exact: true })).toBeVisible()
  await selectStore(page, storeA.id)
  await expect(page.getByRole('button', { name: 'Cadastrar produto', exact: true })).toBeHidden()
  await expect(page.getByText('Seu acesso permite consultar produtos.', { exact: false })).toBeVisible()
})

test('consulta atrasada da loja anterior nao aparece depois da troca', async ({ page }) => {
  const api = await setup(page)
  let release
  api.holdProducts[storeA.id] = new Promise((resolve) => { release = resolve })
  await page.goto('/')
  await selectStore(page, storeA.id)
  await expect.poll(() => api.calls.some((call) => call.path === `/api/stores/${storeA.id}/products`)).toBe(true)
  await selectStore(page, storeB.id)
  await expect(page.getByRole('heading', { name: 'Produto Sul', exact: true })).toBeVisible()
  release()
  await expect(page.getByText('Produto Norte', { exact: true })).toBeHidden()
  await expect(page.getByLabel('Loja ativa')).toHaveValue(storeB.id)
})

test('erros de lojas e catalogo sao explicitos e recuperaveis; revogacao bloqueia visualizacao', async ({ page }) => {
  const api = await setup(page)
  api.storesStatus = 503
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Falha ao carregar lojas.')
  api.storesStatus = 200
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await selectStore(page, storeA.id)
  await expect(page.getByRole('heading', { name: 'Produto Norte', exact: true })).toBeVisible()
  api.storeStatus[storeB.id] = 404
  await selectStore(page, storeB.id)
  await expect(page.getByRole('alert')).toContainText('Loja nao encontrada.')
  await expect(page.getByText('Produto Norte', { exact: true })).toBeHidden()
  delete api.storeStatus[storeB.id]
  api.productStatus[storeB.id] = 503
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('alert')).toContainText('Falha ao carregar produtos.')
  delete api.productStatus[storeB.id]
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('heading', { name: 'Produto Sul', exact: true })).toBeVisible()
})

test('logout remove selecao e cache do catalogo antes do login de outra conta', async ({ page }) => {
  const api = await setup(page)
  await page.goto('/')
  await selectStore(page, storeA.id)
  await expect(page.getByRole('heading', { name: 'Produto Norte', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
  api.stores = [{ ...storeB }]
  await page.getByLabel('E-mail', { exact: true }).fill(bruno.email)
  await page.getByLabel('Senha', { exact: true }).fill('a-unique-business-passphrase')
  await page.getByRole('button', { name: 'Entrar no workspace' }).click()
  await expect(page.getByLabel('Loja ativa')).toHaveValue('')
  await expect(page.getByRole('option', { name: /Loja Norte/ })).toHaveCount(0)
  await selectStore(page, storeB.id)
  await expect(page.getByRole('heading', { name: 'Produto Sul', exact: true })).toBeVisible()
  await expect(page.getByText('Produto Norte', { exact: true })).toBeHidden()
})

test('layout movel e estado sem lojas continuam utilizaveis', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const api = await mockQueryApi(page, { user: marina })
  await page.goto('/')
  await expect(page.getByText('Você ainda não participa de uma loja.', { exact: false })).toBeVisible()
  api.stores = [{ ...storeA }]
  await page.getByRole('button', { name: 'Atualizar lojas', exact: true }).click()
  await selectStore(page, storeA.id)
  await expect(page.getByRole('button', { name: 'Cadastrar produto', exact: true })).toBeVisible()
  await expect(page.getByText('Nenhum produto nesta página.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
