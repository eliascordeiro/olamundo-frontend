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
      signal: AbortSignal.timeout(15000),
    })
  } catch (error) {
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

export const getCurrentUser = () => request('/api/auth/me')
export const getMessages = () => request('/api/mensagens')

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
export const sendMessage = (texto) => post('/api/mensagens', { texto })
