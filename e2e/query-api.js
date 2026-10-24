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
  }
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    state.calls.push({ path, method, headers: request.headers() })
    const respond = (status, body) => route.fulfill({
      status,
      ...(body === undefined ? {} : { contentType: 'application/json', body: JSON.stringify(body) }),
    })
    if (method === 'GET' && path === '/api/auth/me') {
      if (state.sessionStatus !== 200) return respond(state.sessionStatus, { message: 'API temporariamente indisponivel.' })
      return state.user ? respond(200, state.user) : respond(401, { message: 'Entre na sua conta.' })
    }
    if (method === 'GET' && path === '/api/auth/csrf') return respond(200, { token: 'test-csrf' })
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
