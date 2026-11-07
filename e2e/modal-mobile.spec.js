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
  const header = stockDialog.locator('.modal-header')
  const headerTop = (await header.boundingBox()).y
  await stockDialog.getByRole('button', { name: 'Próximo histórico' }).scrollIntoViewIfNeeded()
  expect(await body.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  expect((await header.boundingBox()).y).toBe(headerTop)
  await expect(stockDialog.getByRole('button', { name: 'Fechar' })).toBeVisible()
  await expect(stockDialog.getByRole('region', { name: 'Histórico de movimentações' })).toBeVisible()
  expect(await stockDialog.getByLabel('Quantidade (unidades)').evaluate(element => getComputedStyle(element).fontSize)).toBe('16px')
  await stockDialog.getByRole('button', { name: 'Fechar' }).click()
  await expect(stockDialog).toHaveCount(0)

  await page.getByRole('button', { name: 'Ver estoque de Sofá Norte' }).click()
  await expectFullScreen(page, stockDialog)
  await stockDialog.getByRole('button', { name: 'Fechar' }).click()
})

for (const theme of ['dark', 'contrast']) {
  test(`modal de estoque mantém hierarquia e contraste no tema ${theme}`, async ({ page }) => {
    const api = await mockQueryApi(page, { user: marina })
    api.stores = [{ id: 'north', name: 'Loja Norte', role: 'OWNER' }]
    api.products = { north: [{ id: 'one', name: 'Sofá Norte', sku: '0001', price: 19.90 }] }
    await page.addInitScript(value => localStorage.setItem('nexo.theme', value), theme)
    await page.goto('/')
    await page.getByLabel('Loja ativa').selectOption('north')
    await page.getByRole('button', { name: 'Ver estoque de Sofá Norte' }).click()
    const dialog = page.getByRole('dialog', { name: 'Estoque — Sofá Norte' })
    await expect(dialog.getByText('Saldo atual:')).toContainText('0 unidades')

    const styles = await dialog.evaluate(element => {
      const color = selector => {
        const target = element.querySelector(selector)
        const style = getComputedStyle(target)
        return { foreground: style.color, background: style.backgroundColor, fontSize: parseFloat(style.fontSize) }
      }
      return {
        header: color('.modal-header'),
        title: color('.modal-header h2'),
        balance: color('.stock-balance'),
        value: color('.stock-balance strong'),
        body: color('.modal-body'),
      }
    })
    const contrast = (foreground, background) => {
      const luminance = value => {
        const channels = value.match(/\d+/g).slice(0, 3).map(Number).map(channel => {
          const normalized = channel / 255
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
      }
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
      return (values[0] + 0.05) / (values[1] + 0.05)
    }
    expect(styles.header.background).not.toBe('rgba(0, 0, 0, 0)')
    expect(styles.balance.background).not.toBe(styles.header.background)
    expect(styles.value.fontSize).toBeGreaterThan(styles.balance.fontSize)
    expect(contrast(styles.title.foreground, styles.header.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(styles.balance.foreground, styles.balance.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(styles.value.foreground, styles.balance.background)).toBeGreaterThanOrEqual(4.5)
    expect((await dialog.getByRole('button', { name: 'Fechar' }).boundingBox()).height).toBeGreaterThanOrEqual(44)
  })
}
