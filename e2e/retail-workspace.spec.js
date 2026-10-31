import { test, expect } from '@playwright/test'
import { marina, mockQueryApi } from './query-api'

async function setup(page) {
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [
    { id: 'north', name: 'Móveis Norte', role: 'MANAGER' },
    { id: 'south', name: 'Eletro Sul', role: 'STAFF' },
  ]
  api.products = {
    north: [
      { id: 'sofa', name: 'Sofá retrátil', sku: '001.0001', description: '3 lugares · tecido cinza', price: '1899.90' },
      { id: 'fridge', name: 'Refrigerador duplex', sku: 'ELETRO-02', price: '2499.00' },
    ],
    south: [{ id: 'stove', name: 'Fogão 4 bocas', sku: 'ELETRO-01', price: '799.00' }],
  }
  api.stock = { 'north/sofa': 5 }
  await page.goto('/')
  await page.getByLabel('Loja ativa').selectOption('north')
  return api
}

test('varejo mantém o pedido e os valores reais ao navegar pelo futuro fluxo de vendas', async ({ page }) => {
  const api = await setup(page)
  await page.getByRole('button', { name: 'Adicionar Sofá retrátil ao pedido', exact: true }).click()
  await page.getByLabel('Quantidade de Sofá retrátil', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click()
  await expect(page.getByText('Há 1 produto no novo pedido.', { exact: true })).toBeVisible()
  await expect(page.getByText('Seleção em memória, ainda não salva no servidor.')).toBeVisible()
  await page.getByRole('button', { name: 'Conhecer o fluxo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Vendas de balcão', exact: true })).toBeVisible()
  await expect(page.getByText('Este módulo ainda não registra vendas.', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pagamento e caixa', exact: true })).toBeVisible()
  await expect(page.getByText('Sem percentuais ou valores simulados.', { exact: false })).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
  await page.getByRole('button', { name: 'Abrir pedidos internos', exact: true }).click()
  await expect(page.getByLabel('Quantidade de Sofá retrátil', { exact: true })).toHaveValue('2')
  await page.getByRole('button', { name: 'Salvar rascunho do pedido', exact: true }).click()
  await expect(page.getByText('Total do pedido:')).toContainText('R$ 3.799,80')
  expect(api.stock['north/sofa']).toBe(5)
  const orderId = api.orders.north[0].summary.id
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Vendas', exact: true }).click()
  await page.getByRole('button', { name: 'Abrir pedidos internos', exact: true }).click()
  await page.getByRole('button', { name: `Ver pedido ${orderId}`, exact: true }).click()
  await expect(page.getByRole('heading', { name: `Pedido ${orderId}`, exact: true })).toBeVisible()
  await page.reload()
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await page.getByRole('button', { name: `Ver pedido ${orderId}`, exact: true }).click()
  await expect(page.getByText('Total do pedido:')).toContainText('R$ 3.799,80')
})

test('busca por nome sem acentos e SKU preserva escopo e explica a paginação', async ({ page }) => {
  const api = await setup(page)
  api.products.north.push(...Array.from({ length: 19 }, (_, index) => ({
    id: `other-${index}`, name: `Mesa ${index}`, sku: `M-${index}`, price: '100.00',
  })))
  await page.reload()
  await page.getByLabel('Loja ativa').selectOption('north')
  const search = page.getByRole('searchbox', { name: 'Buscar nesta página', exact: true })
  await search.fill('sofa')
  await expect(page.getByRole('heading', { name: 'Sofá retrátil', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Refrigerador duplex', exact: true })).toBeHidden()
  await search.fill('001.0001')
  await expect(page.getByRole('heading', { name: 'Sofá retrátil', exact: true })).toBeVisible()
  await search.fill('Mesa 18')
  await expect(page.getByText('Nenhum produto encontrado nesta página.', { exact: false })).toBeVisible()
  await expect(page.getByText('Busca somente nos 20 produtos desta página.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Próxima página', exact: true }).click()
  await expect(search).toHaveValue('')
  await expect(page.getByRole('heading', { name: 'Mesa 18', exact: true })).toBeVisible()
  await page.getByLabel('Loja ativa').selectOption('south')
  await expect(search).toHaveValue('')
  await expect(page.getByRole('heading', { name: 'Fogão 4 bocas', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mesa 18', exact: true })).toBeHidden()
})

test('entrada no varejo não concede permissão comercial ao colaborador', async ({ page }) => {
  const api = await setup(page)
  await page.getByRole('button', { name: 'Vendas', exact: true }).click()
  await page.getByLabel('Loja ativa').selectOption('south')
  await page.getByRole('button', { name: 'Consultar produtos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Fogão 4 bocas', exact: true })).toBeVisible()
  await expect(page.getByRole('form', { name: 'Cadastrar produto', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Adicionar Fogão 4 bocas ao pedido', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click()
  await page.getByRole('button', { name: 'Acompanhar pedidos', exact: true }).click()
  await expect(page.getByRole('form', { name: 'Criar pedido', exact: true })).toHaveCount(0)
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.', exact: true })).toBeVisible()
  await expect(page.getByLabel('Loja ativa')).toHaveCount(0)
})

test('varejo funciona de 320px ao desktop sem overflow nem ações cobertas pelo menu', async ({ page }, testInfo) => {
  await setup(page)
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.getByRole('button', { name: 'Vendas', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Vendas de balcão', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 1280) await page.screenshot({ path: testInfo.outputPath('retail-sales-desktop.png'), fullPage: true })
    await page.getByRole('button', { name: 'Consultar produtos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sofá retrátil', exact: true })).toBeVisible()
    if (width === 390 || width === 1280) await page.screenshot({ path: testInfo.outputPath(`retail-catalog-${width}.png`), fullPage: true })
    await page.getByRole('link', { name: 'Novo produto', exact: false }).click()
    await page.getByLabel('Nome do produto', { exact: true }).fill('Mesa de jantar')
    await expect(page.getByLabel('Nome do produto', { exact: true })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Visão geral', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 390 || width === 1280) await page.screenshot({ path: testInfo.outputPath(`retail-overview-${width}.png`), fullPage: true })
  }
})
