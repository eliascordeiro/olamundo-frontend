import { test, expect } from '@playwright/test'
import { marina, mockQueryApi } from './query-api'

async function setup(page) {
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [
    { id: 'north', name: 'Loja Norte', role: 'MANAGER' },
    { id: 'south', name: 'Loja Sul', role: 'STAFF' },
  ]
  api.products = {
    north: [{ id: 'one', name: 'Produto Norte', sku: 'P1', price: '19.90' }],
    south: [{ id: 'two', name: 'Produto Sul', sku: 'P2', price: '29.90' }],
  }
  await page.goto('/')
  await page.getByLabel('Loja ativa').selectOption('north')
  return api
}

test('menu navega entre operações sem perder a loja ativa ou o perfil', async ({ page }) => {
  await setup(page)
  await expect(page.getByRole('button', { name: 'Catálogo', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Catálogo', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Visão geral', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Estoque', exact: true }).click()
  await page.getByRole('button', { name: 'Ver estoque de Produto Norte', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Estoque — Produto Norte', exact: true })).toBeVisible()

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pedidos', exact: true })).toBeVisible()
  await page.getByLabel('Loja ativa').selectOption('south')
  await expect(page.getByRole('form', { name: 'Criar pedido', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Loja ativa')).toHaveValue('south')
})

test('menu permanece acessível no celular sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  const menu = page.getByRole('navigation', { name: 'Navegação principal' })
  await expect(menu).toBeVisible()
  await page.getByRole('button', { name: 'Pedidos da loja', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pedidos', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pedidos da loja', exact: true })).toHaveAttribute('aria-current', 'page')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
