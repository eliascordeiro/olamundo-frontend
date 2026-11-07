import { test, expect } from '@playwright/test'
import { marina, mockQueryApi } from './query-api'

const channels = value => value.match(/[\d.]+/g).slice(0, 3).map(Number)
const luminance = value => {
  const [r, g, b] = channels(value).map(channel => {
    const normalized = channel / 255
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (first, second) => {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (high + 0.05) / (low + 0.05)
}

test('tema escuro separa camadas, campos e botões desabilitados', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [{ id: 'north', name: 'Loja Norte', role: 'OWNER' }]
  api.products = { north: [{ id: 'one', name: 'Sofá Norte', sku: '0001', price: 19.90 }] }
  await page.addInitScript(() => localStorage.setItem('nexo.theme', 'dark'))
  await page.goto('/')
  await page.getByLabel('Loja ativa').selectOption('north')
  await page.getByRole('button', { name: 'Ver estoque de Sofá Norte' }).click()
  const dialog = page.getByRole('dialog', { name: 'Estoque — Sofá Norte' })
  await expect(dialog.getByText('Saldo atual:')).toContainText('0 unidades')
  await expect(dialog.getByText('Nenhuma movimentação nesta página.')).toHaveClass(/empty-state/)

  const styles = await dialog.evaluate(element => {
    const read = (selector, property) => getComputedStyle(element.querySelector(selector))[property]
    return {
      modal: getComputedStyle(element).backgroundColor,
      card: read('.stock-form', 'backgroundColor'),
      cardBorder: read('.stock-form', 'borderTopColor'),
      header: read('.modal-header', 'backgroundColor'),
      field: read('.stock-form input', 'backgroundColor'),
      fieldBorder: read('.stock-form input', 'borderTopColor'),
      hint: read('.stock-panel > .catalog-hint', 'color'),
      disabled: read('.catalog-pagination .secondary-button:disabled', 'color'),
      disabledBackground: read('.catalog-pagination .secondary-button:disabled', 'backgroundColor'),
      disabledOpacity: read('.catalog-pagination .secondary-button:disabled', 'opacity'),
    }
  })
  expect(luminance(styles.card)).toBeGreaterThan(luminance(styles.modal))
  expect(luminance(styles.header)).toBeGreaterThan(luminance(styles.card))
  expect(contrast(styles.cardBorder, styles.card)).toBeGreaterThanOrEqual(1.25)
  expect(contrast(styles.fieldBorder, styles.field)).toBeGreaterThanOrEqual(2)
  expect(styles.field).not.toBe(styles.card)
  expect(contrast(styles.hint, styles.modal)).toBeGreaterThanOrEqual(4.5)
  expect(styles.disabledOpacity).toBe('1')
  expect(contrast(styles.disabled, styles.disabledBackground)).toBeGreaterThanOrEqual(3)
})
