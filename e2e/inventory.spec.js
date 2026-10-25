import { test, expect } from '@playwright/test'
import { marina, bruno, mockQueryApi } from './query-api'

async function setup(page, role = 'OWNER') {
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [{ id: 'north', name: 'Loja Norte', role }, { id: 'south', name: 'Loja Sul', role: 'STAFF' }]
  api.products = {
    north: [{ id: 'one', name: 'Sofá Norte', sku: '0001', price: 19.90 },
      { id: 'two', name: 'Cadeira Norte', sku: '0002', price: 29.90 }],
    south: [{ id: 'three', name: 'Sofá Sul', sku: '0001', price: 39.90 }],
  }
  await page.goto('/')
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Ver estoque de Sofá Norte', exact: true }).click()
  await expect(page.getByText('Saldo atual:')).toContainText('0 unidades')
  return api
}

async function draft(page, quantity, reason = 'Recebimento de mercadoria') {
  await page.getByLabel('Quantidade (unidades)', { exact: true }).fill(quantity)
  await page.getByLabel('Motivo', { exact: true }).fill(reason)
}

const writes = api => api.calls.filter(call => call.method === 'POST' && call.path.endsWith('/stock/movements'))

test('gerente registra entrada e saida, atualiza saldo/historico e preserva CSRF', async ({ page }) => {
  const api = await setup(page, 'MANAGER')
  await draft(page, '10')
  await page.getByRole('button', { name: 'Registrar movimentação', exact: true }).click()
  await expect(page.getByText('Saldo atual:')).toContainText('10 unidades')
  await expect(page.getByText('Entrada: 10 unidades', { exact: true })).toBeVisible()
  expect(writes(api)).toHaveLength(1)
  expect(writes(api)[0].headers['x-csrf-token']).toBe('test-csrf')
  expect(writes(api)[0].body).toMatchObject({ quantity: '10', type: 'IN' })
  expect(writes(api)[0].body.requestId).toMatch(/^[0-9a-f-]{36}$/)
  await page.getByLabel('Tipo de movimentação').selectOption('OUT')
  await draft(page, '3', 'Avaria na mercadoria')
  await page.getByRole('button', { name: 'Registrar movimentação', exact: true }).click()
  await expect(page.getByText('Saldo atual:')).toContainText('7 unidades')
  await expect(page.getByText('Saída: 3 unidades', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Ver estoque de Sofá Norte', exact: true }).click()
  await expect(page.getByText('Saldo atual:')).toContainText('7 unidades')
})

test('reenvio apos resposta perdida usa mesmo identificador mesmo trocando de produto', async ({ page }) => {
  const api = await setup(page)
  api.dropNextStockResponse = true
  await draft(page, '5')
  await page.getByRole('button', { name: 'Registrar movimentação', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar')
  expect(writes(api)).toHaveLength(1)
  expect(api.stock['north/one']).toBe(5)
  await expect(page.getByLabel('Quantidade (unidades)')).toBeDisabled()
  await page.getByRole('button', { name: 'Ver estoque de Cadeira Norte', exact: true }).click()
  await expect(page.getByText('Saldo atual:')).toContainText('0 unidades')
  await page.getByRole('button', { name: 'Ver estoque de Sofá Norte', exact: true }).click()
  await expect(page.getByLabel('Quantidade (unidades)')).toHaveValue('5')
  await page.getByRole('button', { name: 'Confirmar mesmo envio', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Movimentação confirmada.')
  expect(writes(api)).toHaveLength(2)
  expect(writes(api)[0].body).toEqual(writes(api)[1].body)
  expect(api.stock['north/one']).toBe(5)
  expect(api.stockHistory['north/one']).toHaveLength(1)
})

test('quantidade fracionada nao envia; saldo insuficiente mantem rascunho e permite corrigir', async ({ page }) => {
  const api = await setup(page)
  await draft(page, '1.5')
  await page.getByRole('button', { name: 'Registrar movimentação', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('quantidade inteira')
  expect(writes(api)).toHaveLength(0)
  await page.getByLabel('Tipo de movimentação').selectOption('OUT')
  await draft(page, '1')
  await page.getByRole('button', { name: 'Registrar movimentação', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Saldo insuficiente.')
  await expect(page.getByLabel('Quantidade (unidades)')).toBeEnabled()
  await expect(page.getByLabel('Quantidade (unidades)')).toHaveValue('1')
  await page.getByLabel('Tipo de movimentação').selectOption('IN')
  await page.getByRole('button', { name: 'Registrar movimentação', exact: true }).click()
  await expect(page.getByText('Saldo atual:')).toContainText('1 unidades')
  expect(writes(api)).toHaveLength(2)
  expect(writes(api)[0].body.requestId).not.toBe(writes(api)[1].body.requestId)
})

test('colaborador consulta e erros nao simulam saldo zero; produto e loja isolados', async ({ page }) => {
  const api = await setup(page)
  await draft(page, '9')
  await page.getByRole('button', { name: 'Registrar movimentação', exact: true }).click()
  await expect(page.getByText('Saldo atual:')).toContainText('9 unidades')
  api.stockStatus['north/two'] = 503
  await page.getByRole('button', { name: 'Ver estoque de Cadeira Norte', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível consultar o saldo')
  await expect(page.getByText('Saldo atual:')).toHaveCount(0)
  delete api.stockStatus['north/two']
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(page.getByText('Saldo atual:')).toContainText('0 unidades')
  await page.getByLabel('Loja ativa').selectOption('south')
  await expect(page.getByRole('heading', { name: 'Estoque — Cadeira Norte', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver estoque de Sofá Sul', exact: true }).click()
  await expect(page.getByText('Saldo atual:')).toContainText('0 unidades')
  await expect(page.getByRole('form', { name: 'Movimentar estoque', exact: true })).toHaveCount(0)
  await expect(page.getByText('Recebimento de mercadoria', { exact: true })).toHaveCount(0)
})

test('paginacao do historico e layout movel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const api = await setup(page, 'STAFF')
  api.stockHistory['north/two'] = Array.from({ length: 21 }, (_, i) => ({
    id: `movement-${i}`, type: 'IN', quantity: 1, balanceAfter: 21 - i,
    reason: `Movimento ${21 - i}`, userId: marina.id, createdAt: '2026-10-25T12:00:00Z',
  }))
  await page.getByRole('button', { name: 'Ver estoque de Cadeira Norte', exact: true }).click()
  await expect(page.getByText('Movimento 21', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Próximo histórico', exact: true }).click()
  await expect(page.getByText('Movimento 1', { exact: true })).toBeVisible()
  await expect(page.getByText('Movimento 21', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Próximo histórico', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('logout remove operacao incerta antes de entrar com outra conta', async ({ page }) => {
  const api = await setup(page)
  api.dropNextStockResponse = true
  await draft(page, '2')
  await page.getByRole('button', { name: 'Registrar movimentação', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(bruno.email)
  await page.getByLabel('Senha', { exact: true }).fill('a-unique-business-passphrase')
  await page.getByRole('button', { name: 'Entrar no workspace' }).click()
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Ver estoque de Sofá Norte', exact: true }).click()
  await expect(page.getByLabel('Quantidade (unidades)')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Confirmar mesmo envio', exact: true })).toHaveCount(0)
  expect(writes(api)).toHaveLength(1)
})

test('resposta atrasada de estoque nao aparece na outra loja', async ({ page }) => {
  const api = await setup(page)
  let release
  api.holdStock['north/two'] = new Promise(resolve => { release = resolve })
  await page.getByRole('button', { name: 'Ver estoque de Cadeira Norte', exact: true }).click()
  await expect.poll(() => api.calls.some(call => call.path === '/api/stores/north/products/two/stock')).toBe(true)
  await page.getByLabel('Loja ativa').selectOption('south')
  await page.getByRole('button', { name: 'Ver estoque de Sofá Sul', exact: true }).click()
  await expect(page.getByText('Saldo atual:')).toContainText('0 unidades')
  release()
  await expect(page.getByRole('heading', { name: 'Estoque — Cadeira Norte', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Estoque — Sofá Sul', exact: true })).toBeVisible()
})

test('falha no historico e recuperavel e 401 no estoque encerra sessao', async ({ page }) => {
  const api = await setup(page)
  api.stockHistoryStatus['north/two'] = 503
  await page.getByRole('button', { name: 'Ver estoque de Cadeira Norte', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível consultar o histórico')
  await expect(page.getByText('Nenhuma movimentação nesta página.', { exact: true })).toHaveCount(0)
  delete api.stockHistoryStatus['north/two']
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(page.getByText('Nenhuma movimentação nesta página.', { exact: true })).toBeVisible()
  api.stockStatus['north/one'] = 401
  await page.getByRole('button', { name: 'Ver estoque de Sofá Norte', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.', exact: true })).toBeVisible()
  await expect(page.getByText('Saldo atual:')).toHaveCount(0)
})

test('permissao revogada impede movimentacao sem repetir POST', async ({ page }) => {
  const api = await setup(page, 'MANAGER')
  api.stores[0].role = 'STAFF'
  await draft(page, '1')
  await page.getByRole('button', { name: 'Registrar movimentação', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Acesso negado.')
  await expect(page.getByLabel('Quantidade (unidades)')).toHaveValue('1')
  expect(writes(api)).toHaveLength(1)
  expect(api.stock['north/one']).toBeUndefined()
})
