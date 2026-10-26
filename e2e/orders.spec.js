import { test, expect } from '@playwright/test'
import { marina, bruno, mockQueryApi } from './query-api'

async function setup(page, role = 'OWNER') {
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [{ id: 'north', name: 'Loja Norte', role }, { id: 'south', name: 'Loja Sul', role: 'STAFF' }]
  api.products = {
    north: [{ id: 'one', name: 'Produto Norte', sku: 'P1', price: '0.10' },
      { id: 'two', name: 'Outro Norte', sku: 'P2', price: '19.90' }],
    south: [{ id: 'three', name: 'Produto Sul', sku: 'P1', price: '1.00' }],
  }
  api.stock = { 'north/one': 10, 'north/two': 10, 'south/three': 5 }
  await page.goto('/')
  await page.getByLabel('Loja ativa').selectOption('north')
  return api
}

async function add(page, name = 'Produto Norte') {
  await page.getByRole('button', { name: 'Catálogo', exact: true }).click()
  await page.getByRole('button', { name: `Adicionar ${name} ao pedido`, exact: true }).click()
}

async function orders(page) {
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
}

async function viewStock(page, name) {
  await page.getByRole('button', { name: 'Catálogo', exact: true }).click()
  await page.getByRole('button', { name: `Ver estoque de ${name}`, exact: true }).click()
}

async function save(page) {
  await orders(page)
  await page.getByRole('button', { name: 'Salvar rascunho do pedido', exact: true }).click()
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Rascunho')
}

async function confirm(page) {
  await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar e baixar estoque', exact: true }).click()
}

const writes = api => api.calls.filter(call => call.method === 'POST' && /\/orders(?:\/[^/]+\/confirm)?$/.test(call.path))

test('gerente cria rascunho com valores do servidor e confirma baixando estoque', async ({ page }) => {
  const api = await setup(page, 'MANAGER')
  await viewStock(page, 'Produto Norte')
  await expect(page.getByText('Saldo atual:')).toContainText('10 unidades')
  await add(page)
  await page.getByLabel('Quantidade de Produto Norte', { exact: true }).fill('3')
  await save(page)
  await expect(page.getByText('Total do pedido:')).toContainText('R$ 0,30')
  expect(api.stock['north/one']).toBe(10)
  expect(writes(api)[0].body).toMatchObject({ items: [{ productId: 'one', quantity: '3' }] })
  expect(writes(api)[0].body.items[0]).not.toHaveProperty('price')
  expect(writes(api)[0].headers['x-csrf-token']).toBe('test-csrf')
  api.products.north[0].price = '9.99'
  await confirm(page)
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Confirmado')
  await expect(page.getByText('Total do pedido:')).toContainText('R$ 0,30')
  await viewStock(page, 'Produto Norte')
  await expect(page.getByText('Saldo atual:')).toContainText('7 unidades')
  expect(api.stockHistory['north/one']).toHaveLength(1)
  await expect(page.getByRole('button', { name: 'Confirmar pedido', exact: true })).toHaveCount(0)
  await page.reload()
  await page.getByLabel('Loja ativa').selectOption('north')
  await orders(page)
  await page.getByRole('button', { name: `Ver pedido ${api.orders.north[0].summary.id}`, exact: true }).click()
  await expect(page.getByText('Total do pedido:')).toContainText('R$ 0,30')
})

test('saldo insuficiente mantem pedido como rascunho e nao baixa parcialmente', async ({ page }) => {
  const api = await setup(page)
  api.stock['north/two'] = 0
  await add(page)
  await add(page, 'Outro Norte')
  await save(page)
  await confirm(page)
  await expect(page.getByRole('alert')).toContainText('Saldo insuficiente')
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Rascunho')
  expect(api.stock['north/one']).toBe(10)
  api.stock['north/two'] = 1
  await page.getByRole('button', { name: 'Confirmar e baixar estoque', exact: true }).click()
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Confirmado')
  expect(api.stock['north/one']).toBe(9)
  expect(api.stock['north/two']).toBe(0)
})

test('criacao com resposta perdida preserva identificador ao trocar de loja', async ({ page }) => {
  const api = await setup(page)
  api.dropNextOrderResponse = true
  await add(page)
  await orders(page)
  await page.getByRole('button', { name: 'Salvar rascunho do pedido', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar')
  expect(writes(api)).toHaveLength(1)
  await expect(page.getByLabel('Quantidade de Produto Norte')).toBeDisabled()
  await page.getByLabel('Loja ativa').selectOption('south')
  await page.getByLabel('Loja ativa').selectOption('north')
  await orders(page)
  await expect(page.getByLabel('Quantidade de Produto Norte')).toHaveValue('1')
  await page.getByRole('button', { name: 'Confirmar mesmo rascunho', exact: true }).click()
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Rascunho')
  expect(writes(api)).toHaveLength(2)
  expect(writes(api)[0].body).toEqual(writes(api)[1].body)
  expect(api.orders.north).toHaveLength(1)
})

test('resposta perdida na confirmacao permite repetir sem nova baixa', async ({ page }) => {
  const api = await setup(page)
  await add(page)
  await save(page)
  api.dropNextConfirmResponse = true
  await confirm(page)
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar')
  expect(api.stock['north/one']).toBe(9)
  await page.getByRole('button', { name: 'Confirmar e baixar estoque', exact: true }).click()
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Confirmado')
  expect(api.stock['north/one']).toBe(9)
  expect(api.stockHistory['north/one']).toHaveLength(1)
})

test('validacao de quantidade e produtos distintos mantem carrinho corrigivel', async ({ page }) => {
  const api = await setup(page)
  await add(page)
  await add(page)
  await expect(page.getByLabel('Quantidade de Produto Norte')).toHaveCount(1)
  await page.getByLabel('Quantidade de Produto Norte').fill('1.5')
  await page.getByRole('button', { name: 'Salvar rascunho do pedido', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('quantidades inteiras')
  expect(writes(api)).toHaveLength(0)
  await page.getByLabel('Quantidade de Produto Norte').fill('2')
  api.createOrderStatus = 403
  await page.getByRole('button', { name: 'Salvar rascunho do pedido', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Criacao de pedido recusada')
  await expect(page.getByLabel('Quantidade de Produto Norte')).toBeEnabled()
  await expect(page.getByLabel('Quantidade de Produto Norte')).toHaveValue('2')
  api.createOrderStatus = 200
  await save(page)
  expect(writes(api)).toHaveLength(2)
})

test('colaborador consulta sem criar nem confirmar; dados nao atravessam lojas', async ({ page }) => {
  const api = await setup(page)
  await add(page)
  await save(page)
  await page.getByLabel('Loja ativa').selectOption('south')
  await expect(page.getByText('Total do pedido:')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Adicionar Produto Sul ao pedido', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await expect(page.getByText('Nenhum pedido nesta página.', { exact: true })).toBeVisible()
  api.stores[0].role = 'STAFF'
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await page.getByRole('button', { name: `Ver pedido ${api.orders.north[0].summary.id}`, exact: true }).click()
  await expect(page.getByText('Total do pedido:')).toContainText('R$ 0,10')
  await expect(page.getByRole('form', { name: 'Criar pedido', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Confirmar pedido', exact: true })).toHaveCount(0)
})

test('lista e detalhe exibem erros recuperaveis e pagina pedidos no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const api = await setup(page, 'STAFF')
  api.orders.north = Array.from({ length: 21 }, (_, i) => ({
    summary: { id: `order-${i}`, storeId: 'north', status: 'DRAFT', total: '19.90', currency: 'BRL',
      createdBy: marina.id, createdAt: '2026-10-25T12:00:00Z' },
    items: [{ productId: 'one', productName: 'Produto Norte', sku: 'P1', quantity: 1, unitPrice: '19.90', lineTotal: '19.90' }],
  }))
  api.ordersStatus.north = 503
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível listar')
  delete api.ordersStatus.north
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ver pedido order-0', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Próximos pedidos', exact: true }).click()
  api.orderStatus['order-20'] = 404
  await page.getByRole('button', { name: 'Ver pedido order-20', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível consultar o pedido')
  delete api.orderStatus['order-20']
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(page.getByText('Total do pedido:')).toContainText('R$ 19,90')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('logout limpa rascunho e criacao incerta antes da proxima conta', async ({ page }) => {
  const api = await setup(page)
  api.dropNextOrderResponse = true
  await add(page)
  await page.getByRole('button', { name: 'Salvar rascunho do pedido', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(bruno.email)
  await page.getByLabel('Senha', { exact: true }).fill('a-unique-business-passphrase')
  await page.getByRole('button', { name: 'Entrar no workspace', exact: true }).click()
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await expect(page.getByLabel('Quantidade de Produto Norte')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Confirmar mesmo rascunho', exact: true })).toHaveCount(0)
  expect(writes(api)).toHaveLength(1)
})

test('valores grandes permanecem exatos na exibicao do pedido', async ({ page }) => {
  const api = await setup(page)
  api.products.north[0].price = '9999999999.99'
  await add(page)
  await page.getByLabel('Quantidade de Produto Norte').fill('2147483647')
  await save(page)
  await expect(page.getByText('Total do pedido:')).toContainText('R$ 21.474.836.469.978.525.163,53')
})

test('lista atrasada de outra loja nao reaparece e revogacao bloqueia confirmacao', async ({ page }) => {
  const api = await setup(page)
  await add(page)
  await save(page)
  api.stores[0].role = 'STAFF'
  await confirm(page)
  await expect(page.getByRole('alert')).toContainText('Acesso negado.')
  expect(api.stock['north/one']).toBe(10)
  await page.getByLabel('Loja ativa').selectOption('south')
  let release
  api.holdOrders.south = new Promise(resolve => { release = resolve })
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await expect.poll(() => api.calls.some(call => call.path === '/api/stores/south/orders')).toBe(true)
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await expect(page.getByRole('button', { name: `Ver pedido ${api.orders.north[0].summary.id}`, exact: true })).toBeVisible()
  release()
  await expect(page.getByRole('heading', { name: 'Pedidos internos — Loja Sul', exact: true })).toHaveCount(0)
})

async function openCancellation(page, reason = 'Desistencia interna') {
  await page.getByRole('button', { name: 'Cancelar pedido', exact: true }).click()
  await page.getByLabel('Motivo do cancelamento', { exact: true }).fill(reason)
}

const cancellations = api => api.calls.filter(call => call.method === 'POST' && call.path.endsWith('/cancel'))

test('gerente cancela confirmado, devolve estoque e preserva valores e auditoria apos reload', async ({ page }) => {
  const api = await setup(page, 'MANAGER')
  await viewStock(page, 'Produto Norte')
  await add(page)
  await page.getByLabel('Quantidade de Produto Norte', { exact: true }).fill('3')
  await save(page)
  await confirm(page)
  await viewStock(page, 'Produto Norte')
  await expect(page.getByText('Saldo atual:')).toContainText('7 unidades')
  await orders(page)
  await openCancellation(page, '  Desistencia interna  ')
  await expect(page.getByRole('form', { name: 'Cancelar pedido', exact: true })).toContainText('devolverá integralmente')
  expect(cancellations(api)).toHaveLength(0)
  await page.getByRole('button', { name: 'Confirmar cancelamento definitivo', exact: true }).click()
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Cancelado')
  await expect(page.getByText('Total do pedido:')).toContainText('R$ 0,30')
  await viewStock(page, 'Produto Norte')
  await expect(page.getByText('Saldo atual:')).toContainText('10 unidades')
  await orders(page)
  await expect(page.getByText('Motivo: Desistencia interna', { exact: true })).toBeVisible()
  await expect(page.getByText('Estoque devolvido integralmente.', { exact: false })).toBeVisible()
  expect(cancellations(api)[0].body).toEqual({ reason: 'Desistencia interna' })
  expect(cancellations(api)[0].headers['x-csrf-token']).toBe('test-csrf')
  expect(api.stockHistory['north/one']).toHaveLength(2)
  expect(api.stockHistory['north/one'][0]).toMatchObject({
    type: 'IN', quantity: 3, reason: `Cancelamento do pedido ${api.orders.north[0].summary.id}`, userId: marina.id,
  })
  await page.reload()
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await page.getByRole('button', { name: `Ver pedido ${api.orders.north[0].summary.id}`, exact: true }).click()
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Cancelado')
  await expect(page.getByRole('button', { name: 'Cancelar pedido', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Confirmar pedido', exact: true })).toHaveCount(0)
})

test('cancelamento de rascunho exige motivo e segundo passo, sem movimentar estoque', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const api = await setup(page)
  await add(page)
  await save(page)
  await openCancellation(page, '   ')
  await page.getByRole('button', { name: 'Confirmar cancelamento definitivo', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('motivo de cancelamento de 2 a 500')
  expect(cancellations(api)).toHaveLength(0)
  await page.getByRole('button', { name: 'Manter pedido', exact: true }).click()
  await expect(page.getByRole('form', { name: 'Cancelar pedido', exact: true })).toHaveCount(0)
  await openCancellation(page, 'Rascunho duplicado')
  await expect(page.getByLabel('Motivo do cancelamento', { exact: true })).toHaveAttribute('maxlength', '500')
  await page.getByRole('button', { name: 'Confirmar cancelamento definitivo', exact: true }).click()
  await expect(page.getByText('Rascunho cancelado sem movimentar estoque.', { exact: true })).toBeVisible()
  expect(api.stock['north/one']).toBe(10)
  expect(api.stockHistory['north/one'] ?? []).toHaveLength(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('cancelamento com resposta perdida permite repetir mesmo motivo sem duplicar devolucao', async ({ page }) => {
  const api = await setup(page)
  await add(page)
  await save(page)
  await confirm(page)
  await openCancellation(page)
  api.dropNextCancelResponse = true
  await page.getByRole('button', { name: 'Confirmar cancelamento definitivo', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar')
  expect(api.stock['north/one']).toBe(10)
  expect(cancellations(api)).toHaveLength(1)
  await expect(page.getByLabel('Motivo do cancelamento', { exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Repetir mesmo cancelamento', exact: true }).click()
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Cancelado')
  expect(cancellations(api)).toHaveLength(2)
  expect(cancellations(api)[0].body).toEqual(cancellations(api)[1].body)
  expect(api.stockHistory['north/one']).toHaveLength(2)
  expect(api.stock['north/one']).toBe(10)
})

test('cancelamento incerto preserva motivo por pedido e loja sem repetir POST automaticamente', async ({ page }) => {
  const api = await setup(page)
  await add(page)
  await save(page)
  await openCancellation(page, 'Motivo preservado')
  api.cancelOrderStatus = 503
  await page.getByRole('button', { name: 'Confirmar cancelamento definitivo', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Cancelamento recusado')
  await page.getByLabel('Loja ativa').selectOption('south')
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await expect(page.getByLabel('Motivo do cancelamento', { exact: true })).toHaveCount(0)
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await page.getByRole('button', { name: `Ver pedido ${api.orders.north[0].summary.id}`, exact: true }).click()
  await expect(page.getByLabel('Motivo do cancelamento', { exact: true })).toHaveValue('Motivo preservado')
  await expect(page.getByLabel('Motivo do cancelamento', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Confirmar pedido', exact: true })).toHaveCount(0)
  expect(cancellations(api)).toHaveLength(1)
  api.cancelOrderStatus = 200
  await page.getByRole('button', { name: 'Repetir mesmo cancelamento', exact: true }).click()
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Cancelado')
  expect(cancellations(api)[0].body).toEqual(cancellations(api)[1].body)
})

test('limite de saldo impede devolucao parcial e permite nova tentativa', async ({ page }) => {
  const api = await setup(page)
  await add(page)
  await add(page, 'Outro Norte')
  await save(page)
  await confirm(page)
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Confirmado')
  api.stock['north/two'] = 2147483647
  await openCancellation(page)
  await page.getByRole('button', { name: 'Confirmar cancelamento definitivo', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('excederia o limite')
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Confirmado')
  expect(api.stock['north/one']).toBe(9)
  expect(api.stockHistory['north/one']).toHaveLength(1)
  await expect(page.getByLabel('Motivo do cancelamento', { exact: true })).toBeEnabled()
  api.stock['north/two'] = 9
  await page.getByRole('button', { name: 'Confirmar cancelamento definitivo', exact: true }).click()
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Cancelado')
  expect(api.stock['north/one']).toBe(10)
  expect(api.stock['north/two']).toBe(10)
})

test('revogacao de permissao recusa cancelamento e STAFF apenas consulta auditoria', async ({ page }) => {
  const api = await setup(page)
  await add(page)
  await save(page)
  await openCancellation(page)
  api.stores[0].role = 'STAFF'
  await page.getByRole('button', { name: 'Confirmar cancelamento definitivo', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Acesso negado.')
  expect(api.orders.north[0].summary.status).toBe('DRAFT')
  expect(api.stock['north/one']).toBe(10)
  Object.assign(api.orders.north[0].summary, { status: 'CANCELLED', cancelledBy: 'manager-id',
    cancelledAt: new Date().toISOString(), cancellationReason: 'Cancelado pelo gerente' })
  await page.getByLabel('Loja ativa').selectOption('south')
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await page.getByRole('button', { name: `Ver pedido ${api.orders.north[0].summary.id}`, exact: true }).click()
  await expect(page.getByText('Motivo: Cancelado pelo gerente', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancelar pedido', exact: true })).toHaveCount(0)
})

test('resposta tardia do cancelamento nao interfere na loja ativa', async ({ page }) => {
  const api = await setup(page)
  await add(page)
  await save(page)
  await openCancellation(page)
  let release
  api.holdCancelResponse = new Promise(resolve => { release = resolve })
  await page.getByRole('button', { name: 'Confirmar cancelamento definitivo', exact: true }).click()
  await expect.poll(() => cancellations(api).length).toBe(1)
  await expect(page.getByRole('button', { name: 'Cancelando pedido...', exact: true })).toBeDisabled()
  await page.getByLabel('Loja ativa').selectOption('south')
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  release()
  await expect(page.getByText('Nenhum pedido nesta página.', { exact: true })).toBeVisible()
  await expect(page.getByText('Motivo: Desistencia interna', { exact: true })).toHaveCount(0)
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await page.getByRole('button', { name: `Ver pedido ${api.orders.north[0].summary.id}`, exact: true }).click()
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Cancelado')
})

test('logout descarta cancelamento incerto antes da proxima conta', async ({ page }) => {
  const api = await setup(page)
  await add(page)
  await save(page)
  await openCancellation(page, 'Motivo privado')
  api.cancelOrderStatus = 503
  await page.getByRole('button', { name: 'Confirmar cancelamento definitivo', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Cancelamento recusado')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(bruno.email)
  await page.getByLabel('Senha', { exact: true }).fill('a-unique-business-passphrase')
  await page.getByRole('button', { name: 'Entrar no workspace', exact: true }).click()
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await page.getByRole('button', { name: `Ver pedido ${api.orders.north[0].summary.id}`, exact: true }).click()
  await expect(page.getByRole('button', { name: 'Repetir mesmo cancelamento', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancelar pedido', exact: true }).click()
  await expect(page.getByLabel('Motivo do cancelamento', { exact: true })).toHaveValue('')
  expect(cancellations(api)).toHaveLength(1)
})

test('atualizar pedido apos resposta perdida recupera situacao e estoque sem novo POST', async ({ page }) => {
  const api = await setup(page)
  await viewStock(page, 'Produto Norte')
  await add(page)
  await save(page)
  await confirm(page)
  await viewStock(page, 'Produto Norte')
  await expect(page.getByText('Saldo atual:')).toContainText('9 unidades')
  await orders(page)
  await openCancellation(page)
  api.dropNextCancelResponse = true
  await page.getByRole('button', { name: 'Confirmar cancelamento definitivo', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar')
  await page.getByRole('button', { name: 'Atualizar pedido', exact: true }).click()
  await expect(page.getByText('Situação:', { exact: false })).toContainText('Cancelado')
  await viewStock(page, 'Produto Norte')
  await expect(page.getByText('Saldo atual:')).toContainText('10 unidades')
  expect(cancellations(api)).toHaveLength(1)
  expect(api.stockHistory['north/one']).toHaveLength(2)
})
