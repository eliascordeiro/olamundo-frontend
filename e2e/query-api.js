export const marina = { id: 'user-marina', name: 'Marina Negócios', email: 'marina@example.com' }
export const bruno = { id: 'user-bruno', name: 'Bruno Negócios', email: 'bruno@example.com' }

export async function mockQueryApi(page, { user = null, messages = [] } = {}) {
  const state = {
    user,
    messages,
    calls: [],
    sessionStatus: 200,
    messageStatus: 200,
    loginStatus: 200,
    logoutStatus: 204,
    sendStatus: 201,
    holdMessages: null,
    stores: [],
    products: {},
    storesStatus: 200,
    storeStatus: {},
    productStatus: {},
    createProductStatus: 201,
    holdProducts: {},
    stock: {},
    stockHistory: {},
    stockStatus: {},
    stockHistoryStatus: {},
    moveStockStatus: 200,
    dropNextStockResponse: false,
    holdStock: {},
    orders: {},
    ordersStatus: {},
    orderStatus: {},
    createOrderStatus: 200,
    confirmOrderStatus: 200,
    dropNextOrderResponse: false,
    dropNextConfirmResponse: false,
    holdOrders: {},
  }
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    state.calls.push({ path, method, url: request.url(), headers: request.headers(),
      body: method === 'POST' ? request.postDataJSON() : undefined })
    const respond = (status, body) => route.fulfill({
      status,
      ...(body === undefined ? {} : { contentType: 'application/json', body: JSON.stringify(body) }),
    })
    if (method === 'GET' && path === '/api/auth/me') {
      if (state.sessionStatus !== 200) return respond(state.sessionStatus, { message: 'API temporariamente indisponivel.' })
      return state.user ? respond(200, state.user) : respond(401, { message: 'Entre na sua conta.' })
    }
    if (method === 'GET' && path === '/api/auth/csrf') return respond(200, { token: 'test-csrf' })
    const slice = (items) => {
      const pageNumber = Number(url.searchParams.get('page') || 0)
      const size = Number(url.searchParams.get('size') || 20)
      return {
        content: items.slice(pageNumber * size, (pageNumber + 1) * size),
        page: pageNumber, size, hasNext: items.length > (pageNumber + 1) * size,
      }
    }
    if (method === 'GET' && path === '/api/stores') {
      return state.storesStatus === 200
        ? respond(200, slice(state.stores))
        : respond(state.storesStatus, { message: 'Falha ao carregar lojas.' })
    }
    const orderRoute = path.match(/^\/api\/stores\/([^/]+)\/orders(?:\/([^/]+)(\/confirm)?)?$/)
    if (orderRoute) {
      const [, storeId, orderId, confirming] = orderRoute
      const store = state.stores.find(item => item.id === storeId)
      if (!store || state.storeStatus[storeId]) return respond(404, { message: 'Loja nao encontrada.' })
      state.orders[storeId] ??= []
      const orders = state.orders[storeId]
      const order = orders.find(item => item.summary.id === orderId)
      if (method === 'GET') {
        if (orderId) {
          if (state.orderStatus[orderId]) return respond(state.orderStatus[orderId], { message: 'Falha ao consultar pedido.' })
          return order ? respond(200, order) : respond(404, { message: 'Pedido nao encontrado.' })
        }
        if (state.ordersStatus[storeId]) return respond(state.ordersStatus[storeId], { message: 'Falha ao listar pedidos.' })
        const snapshot = slice(orders.map(item => item.summary))
        if (state.holdOrders[storeId]) await state.holdOrders[storeId]
        return respond(200, snapshot)
      }
      if (method === 'POST') {
        if (request.headers()['x-csrf-token'] !== 'test-csrf') return respond(403, { message: 'CSRF ausente.' })
        if (!['OWNER', 'MANAGER'].includes(store.role)) return respond(403, { message: 'Acesso negado.' })
        if (!orderId) {
          if (state.createOrderStatus !== 200) return respond(state.createOrderStatus, { message: 'Criacao de pedido recusada.' })
          const body = request.postDataJSON()
          const previous = orders.find(item => item.summary.id === body.requestId)
          if (previous) return respond(200, previous)
          const decimal = cents => `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`
          const items = body.items.map(item => {
            const product = state.products[storeId].find(product => product.id === item.productId)
            const price = String(product.price).split('.')
            const cents = BigInt(price[0]) * 100n + BigInt((price[1] ?? '').padEnd(2, '0'))
            return { productId: product.id, productName: product.name, sku: product.sku,
              quantity: Number(item.quantity), unitPrice: decimal(cents),
              lineTotal: decimal(cents * BigInt(item.quantity)) }
          })
          const cents = items.reduce((sum, item) => sum + BigInt(item.lineTotal.replace('.', '')), 0n)
          const saved = { summary: { id: body.requestId, storeId, status: 'DRAFT', currency: 'BRL',
            total: decimal(cents), createdBy: state.user.id, createdAt: new Date().toISOString(),
            confirmedAt: null, confirmedBy: null }, items }
          orders.unshift(saved)
          if (state.dropNextOrderResponse) {
            state.dropNextOrderResponse = false
            return route.abort('failed')
          }
          return respond(200, saved)
        }
        if (confirming) {
          if (!order) return respond(404, { message: 'Pedido nao encontrado.' })
          if (state.confirmOrderStatus !== 200) return respond(state.confirmOrderStatus, { message: 'Confirmacao recusada.' })
          if (order.summary.status !== 'CONFIRMED') {
            if (order.items.some(item => (state.stock[`${storeId}/${item.productId}`] ?? 0) < item.quantity)) {
              return respond(409, { message: 'Saldo insuficiente para esta saida.' })
            }
            for (const item of order.items) {
              const key = `${storeId}/${item.productId}`
              state.stock[key] -= item.quantity
              state.stockHistory[key] ??= []
              state.stockHistory[key].unshift({ id: crypto.randomUUID(), storeId, productId: item.productId,
                type: 'OUT', quantity: item.quantity, balanceAfter: state.stock[key],
                reason: `Confirmacao do pedido ${orderId}`, userId: state.user.id,
                createdAt: new Date().toISOString() })
            }
            order.summary.status = 'CONFIRMED'
            order.summary.confirmedAt = new Date().toISOString()
            order.summary.confirmedBy = state.user.id
          }
          if (state.dropNextConfirmResponse) {
            state.dropNextConfirmResponse = false
            return route.abort('failed')
          }
          return respond(200, order)
        }
      }
    }
    const stockRoute = path.match(/^\/api\/stores\/([^/]+)\/products\/([^/]+)\/stock(\/movements)?$/)
    if (stockRoute) {
      const [, storeId, productId, isHistory] = stockRoute
      const key = `${storeId}/${productId}`
      const store = state.stores.find((item) => item.id === storeId)
      const product = state.products[storeId]?.find((item) => item.id === productId)
      if (!store || !product || state.storeStatus[storeId]) return respond(404, { message: 'Produto nao encontrado.' })
      if (method === 'GET') {
        const status = isHistory ? state.stockHistoryStatus[key] : state.stockStatus[key]
        if (status) return respond(status, { message: 'Falha ao consultar estoque.' })
        const snapshot = isHistory ? slice(state.stockHistory[key] ?? [])
          : { storeId, productId, quantity: state.stock[key] ?? 0 }
        if (state.holdStock[key]) await state.holdStock[key]
        return respond(200, snapshot)
      }
      if (method === 'POST' && isHistory) {
        if (request.headers()['x-csrf-token'] !== 'test-csrf') return respond(403, { message: 'CSRF ausente.' })
        if (!['OWNER', 'MANAGER'].includes(store.role)) return respond(403, { message: 'Acesso negado.' })
        if (state.moveStockStatus !== 200) return respond(state.moveStockStatus, { message: 'Movimentacao recusada.' })
        const body = request.postDataJSON()
        state.stockHistory[key] ??= []
        const existing = state.stockHistory[key].find((item) => item.id === body.requestId)
        if (existing) return respond(200, existing)
        const next = (state.stock[key] ?? 0) + (body.type === 'IN' ? 1 : -1) * Number(body.quantity)
        if (next < 0) return respond(409, { message: 'Saldo insuficiente.' })
        const movement = { ...body, id: body.requestId, storeId, productId,
          quantity: Number(body.quantity), balanceAfter: next, userId: state.user.id,
          sequence: state.stockHistory[key].length + 1, createdAt: new Date().toISOString() }
        state.stock[key] = next
        state.stockHistory[key].unshift(movement)
        if (state.dropNextStockResponse) {
          state.dropNextStockResponse = false
          return route.abort('failed')
        }
        return respond(200, movement)
      }
    }
    const storeRoute = path.match(/^\/api\/stores\/([^/]+)(\/products)?$/)
    if (storeRoute) {
      const [, storeId, isProducts] = storeRoute
      const store = state.stores.find((item) => item.id === storeId)
      if (!store || state.storeStatus[storeId]) {
        return respond(state.storeStatus[storeId] || 404, { message: 'Loja nao encontrada.' })
      }
      if (method === 'GET' && !isProducts) return respond(200, store)
      if (method === 'GET' && isProducts) {
        const snapshot = slice(state.products[storeId] ?? [])
        if (state.holdProducts[storeId]) await state.holdProducts[storeId]
        if (state.productStatus[storeId]) {
          return respond(state.productStatus[storeId], { message: 'Falha ao carregar produtos.' })
        }
        return respond(200, snapshot)
      }
      if (method === 'POST' && isProducts) {
        if (request.headers()['x-csrf-token'] !== 'test-csrf') return respond(403, { message: 'CSRF ausente.' })
        if (!['OWNER', 'MANAGER'].includes(store.role)) return respond(403, { message: 'Acesso negado.' })
        if (state.createProductStatus !== 201) {
          return respond(state.createProductStatus, { message: 'SKU ja existe nesta loja.' })
        }
        const product = { ...request.postDataJSON(), id: crypto.randomUUID(), storeId, currency: 'BRL' }
        state.products[storeId] ??= []
        state.products[storeId].push(product)
        return respond(201, product)
      }
    }
    if (method === 'POST') {
      if (request.headers()['x-csrf-token'] !== 'test-csrf') {
        return respond(403, { message: 'Token CSRF ausente.' })
      }
      if (path === '/api/auth/register') return respond(201)
      if (path === '/api/auth/login') {
        if (state.loginStatus !== 200) return respond(state.loginStatus, { message: 'Credenciais invalidas.' })
        state.user = request.postDataJSON().email === bruno.email ? bruno : marina
        return respond(200, state.user)
      }
      if (path === '/api/auth/logout') {
        if (state.logoutStatus !== 204) return respond(state.logoutStatus, { message: 'Falha ao sair.' })
        state.user = null
        return respond(204)
      }
      if (path === '/api/mensagens') {
        if (state.sendStatus !== 201) return respond(state.sendStatus, { message: 'Publicacao recusada.' })
        state.messages.push({ id: String(state.messages.length + 1), texto: request.postDataJSON().texto })
        return respond(201)
      }
    }
    if (method === 'GET' && path === '/api/mensagens') {
      const snapshot = [...state.messages]
      if (state.holdMessages) await state.holdMessages
      if (state.messageStatus !== 200) return respond(state.messageStatus, {
        message: state.messageStatus === 401 ? 'Sessao expirada.' : 'Nao foi possivel carregar o mural.',
      })
      return respond(200, snapshot)
    }
    return respond(501, { message: `Rota nao prevista no teste: ${method} ${path}` })
  })
  return state
}
