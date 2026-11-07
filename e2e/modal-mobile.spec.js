import { test, expect } from '@playwright/test'
import { marina, mockQueryApi } from './query-api'

async function expectFullScreen(page, dialog) {
  await expect(dialog).toBeVisible()
  await expect.poll(async () => dialog.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return [rect.top, rect.left, rect.right, rect.bottom].map(Math.round)
  })).toEqual([0, 0, page.viewportSize().width, page.viewportSize().height])
}

test('modais móveis ocupam a janela na primeira abertura e acompanham redimensionamentos', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [{ id: 'north', name: 'Loja Norte', role: 'OWNER' }]
  api.products = { north: [{ id: 'one', name: 'Sofá Norte', sku: '0001', price: 19.90 }] }

  await page.goto('/')
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Novo produto' }).click()
  const productDialog = page.getByRole('dialog', { name: 'Novo produto' })
  await expectFullScreen(page, productDialog)
  await productDialog.getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Ver estoque de Sofá Norte' }).click()
  const stockDialog = page.getByRole('dialog', { name: 'Estoque — Sofá Norte' })
  await expectFullScreen(page, stockDialog)
  await expect(page.getByText('Saldo atual:')).toContainText('0 unidades')

  // Em navegadores com barras móveis, svh e dvh podem ser diferentes.
  const mobileHeight = await page.evaluate(() => {
    const rule = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules])
      .filter(item => item instanceof CSSMediaRule && item.conditionText === '(max-width: 650px)')
      .flatMap(media => [...media.cssRules]).find(item => item.selectorText === '.modal')
    return [rule.style.height, rule.style.maxHeight]
  })
  expect(mobileHeight).toEqual(['100dvh', '100dvh'])

  await page.setViewportSize({ width: 390, height: 620 })
  await expectFullScreen(page, stockDialog)
  const body = stockDialog.locator('.modal-body')
  expect(await body.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  await stockDialog.getByRole('button', { name: 'Próximo histórico' }).scrollIntoViewIfNeeded()
  expect(await body.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await stockDialog.getByRole('button', { name: 'Fechar' }).click()
  await expect(stockDialog).toHaveCount(0)

  await page.getByRole('button', { name: 'Ver estoque de Sofá Norte' }).click()
  await expectFullScreen(page, stockDialog)
  await stockDialog.getByRole('button', { name: 'Fechar' }).click()
})
