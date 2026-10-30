const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: { ...options.headers },
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError(
      error.name === 'TimeoutError'
        ? 'O servidor demorou para responder. Tente novamente.'
        : 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      0,
    )
  }
  if (!response.ok) {
    let message = `Não foi possível concluir a solicitação (${response.status}).`
    if (response.headers.get('content-type')?.includes('application/json')) {
      const body = await response.json()
      if (typeof body.message === 'string') message = body.message
    }
    throw new ApiError(message, response.status)
  }
  return response.status === 204 || response.headers.get('content-length') === '0'
    ? null
    : response.text().then((text) => (text ? JSON.parse(text) : null))
}

export const getCurrentUser = ({ signal } = {}) => request('/api/auth/me', { signal })

async function post(path, body) {
  const { token } = await request('/api/auth/csrf')
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
    body: JSON.stringify(body),
  })
}

export const login = (email, password) => post('/api/auth/login', { email, password })
export const register = (name, email, password) => post('/api/auth/register', { name, email, password })
export const logout = () => post('/api/auth/logout')
export const getStores = ({ page = 0, size = 20, signal } = {}) =>
  request(`/api/stores?page=${page}&size=${size}`, { signal })
export const getStore = (storeId, { signal } = {}) =>
  request(`/api/stores/${encodeURIComponent(storeId)}`, { signal })
export const createStore = (name) => post('/api/stores', { name })
export const getProducts = (storeId, { page = 0, size = 20, signal } = {}) =>
  request(`/api/stores/${encodeURIComponent(storeId)}/products?page=${page}&size=${size}`, { signal })
export const createProduct = (storeId, product) =>
  post(`/api/stores/${encodeURIComponent(storeId)}/products`, product)

const stockPath = (storeId, productId) =>
  `/api/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/stock`
export const getStock = (storeId, productId, { signal } = {}) =>
  request(stockPath(storeId, productId), { signal })
export const getStockHistory = (storeId, productId, { page = 0, size = 20, signal } = {}) =>
  request(`${stockPath(storeId, productId)}/movements?page=${page}&size=${size}`, { signal })
export const moveStock = (storeId, productId, movement) =>
  post(`${stockPath(storeId, productId)}/movements`, movement)

const ordersPath = (storeId) => `/api/stores/${encodeURIComponent(storeId)}/orders`
export const getOrders = (storeId, { page = 0, size = 20, signal } = {}) =>
  request(`${ordersPath(storeId)}?page=${page}&size=${size}`, { signal })
export const getOrder = (storeId, orderId, { signal } = {}) =>
  request(`${ordersPath(storeId)}/${encodeURIComponent(orderId)}`, { signal })
export const createOrder = (storeId, order) => post(ordersPath(storeId), order)
export const confirmOrder = (storeId, orderId) =>
  post(`${ordersPath(storeId)}/${encodeURIComponent(orderId)}/confirm`, {})
export const cancelOrder = (storeId, orderId, cancellation) =>
  post(`${ordersPath(storeId)}/${encodeURIComponent(orderId)}/cancel`, cancellation)

const salespeoplePath = (storeId) => `/api/stores/${encodeURIComponent(storeId)}/salespeople`
export const getSalespeople = (storeId, { page = 0, size = 20, signal } = {}) =>
  request(`${salespeoplePath(storeId)}?page=${page}&size=${size}`, { signal })
export const getSalesperson = (storeId, id, { signal } = {}) =>
  request(`${salespeoplePath(storeId)}/${encodeURIComponent(id)}`, { signal })
export const createSalesperson = (storeId, registration) => post(salespeoplePath(storeId), registration)
export const updateSalesperson = (storeId, id, update) =>
  post(`${salespeoplePath(storeId)}/${encodeURIComponent(id)}`, update)
export const linkSalesperson = (storeId, id, account) =>
  post(`${salespeoplePath(storeId)}/${encodeURIComponent(id)}/account`, account)
export const grantSellerAccess = (storeId, id, access) =>
  post(`${salespeoplePath(storeId)}/${encodeURIComponent(id)}/access`, access)
export const acceptSellerInvite = (invite) => post('/api/seller-invites/accept', invite)

export const getPlatformOwners = ({ page = 0, size = 20, signal } = {}) =>
  request(`/api/platform/owners?page=${page}&size=${size}`, { signal })
export const createPlatformOwner = (owner) => post('/api/platform/owners', owner)
export const invitePlatformOwner = (id, email) =>
  post(`/api/platform/owners/${encodeURIComponent(id)}/invite`, { email })
export const acceptOwnerInvite = (invite) => post('/api/platform/invites/accept', invite)
