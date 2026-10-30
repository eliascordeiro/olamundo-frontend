import { test, expect } from '@playwright/test'
import { marina, mockQueryApi } from './query-api'

async function open(page, viewport) {
  if (viewport) await page.setViewportSize(viewport)
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [{ id: 'north', name: 'Móveis Norte', role: 'OWNER' }]
  await page.goto('/')
  await page.getByLabel('Loja ativa').selectOption('north')
  return api
}

test('menu lateral rola quando a tela é baixa e todos os itens ficam alcançáveis', async ({ page }) => {
  await open(page, { width: 1280, height: 500 })
  const sidebar = page.locator('.workspace-sidebar')
  const overflow = await sidebar.evaluate(element => ({ scrolls: element.scrollHeight > element.clientHeight, style: getComputedStyle(element).overflowY }))
  expect(overflow.style).toBe('auto')
  expect(overflow.scrolls).toBe(true)
  const last = page.getByRole('button', { name: 'Equipe e vendedores', exact: true })
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeInViewport()
  await last.click()
  await expect(last).toHaveAttribute('aria-current', 'page')
})

test('menu recolhe para ícones, mantém a navegação e lembra a preferência', async ({ page }) => {
  await open(page, { width: 1280, height: 800 })
  const sidebar = page.locator('.workspace-sidebar')
  const expanded = (await sidebar.boundingBox()).width
  await page.getByRole('button', { name: 'Recolher menu', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Expandir menu', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBeLessThan(expanded / 2)
  await expect(page.getByText('Fornecedores', { exact: true })).toBeHidden()
  const clients = page.getByRole('button', { name: 'Clientes', exact: true })
  await expect(clients).toHaveAttribute('title', 'Clientes')
  await clients.click()
  await expect(clients).toHaveAttribute('aria-current', 'page')
  await page.reload()
  await page.getByLabel('Loja ativa').selectOption('north')
  await expect(page.getByRole('button', { name: 'Expandir menu', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Expandir menu', exact: true }).click()
  await expect(page.getByText('Fornecedores', { exact: true }).first()).toBeVisible()
  await page.evaluate(() => window.localStorage.removeItem('nexo.sidebar-collapsed'))
})

test('no celular o menu continua em barra horizontal sem botão de recolher', async ({ page }) => {
  await open(page, { width: 390, height: 800 })
  await expect(page.getByRole('button', { name: 'Recolher menu' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Clientes', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
