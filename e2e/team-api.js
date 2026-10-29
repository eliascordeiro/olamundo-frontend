import { marina, mockQueryApi } from './query-api'

export async function setupTeam(page) {
  const api = await mockQueryApi(page, { user: marina })
  api.stores = [
    { id: 'north', name: 'Móveis Norte', role: 'OWNER' },
    { id: 'south', name: 'Eletro Sul', role: 'OWNER' },
    { id: 'staff', name: 'Loja colaborador', role: 'STAFF' },
    { id: 'manager', name: 'Loja gerente', role: 'MANAGER' },
  ]
  api.salespeople = { north: [], south: [] }
  api.teamStatus = 200
  api.teamWriteStatus = 200
  api.dropTeamCreation = false
  api.holdTeam = null
  api.memberEmail = 'vendedor@example.com'
  api.teamCalls = []
  await page.route('**/api/stores/*/salespeople**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const [, storeId, id, action] = url.pathname.match(/^\/api\/stores\/([^/]+)\/salespeople(?:\/([^/]+)(?:\/(account))?)?$/)
    const method = request.method()
    const body = method === 'POST' ? request.postDataJSON() : undefined
    api.teamCalls.push({ storeId, id, action, method, body, headers: request.headers() })
    const respond = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (!api.user) return respond(401, { message: 'Entre na sua conta.' })
    if (api.stores.find(store => store.id === storeId)?.role !== 'OWNER') return respond(403, { message: 'Apenas proprietário.' })
    if (method === 'GET') {
      if (api.teamStatus !== 200) return respond(api.teamStatus, { message: 'Falha ao carregar vendedores.' })
      const sellers = structuredClone(api.salespeople[storeId])
      if (api.holdTeam) await api.holdTeam
      if (id) return respond(200, sellers.find(seller => seller.id === id))
      const page = Number(url.searchParams.get('page') || 0)
      const size = Number(url.searchParams.get('size') || 20)
      return respond(200, { content: sellers.slice(page * size, (page + 1) * size), page, size,
        hasNext: sellers.length > (page + 1) * size })
    }
    if (request.headers()['x-csrf-token'] !== 'test-csrf') return respond(403, { message: 'CSRF ausente.' })
    if (api.teamWriteStatus !== 200) return respond(api.teamWriteStatus, { message: 'Cadastro alterado. Atualize os dados.' })
    if (!id) {
      let seller = api.salespeople[storeId].find(seller => seller.id === body.requestId)
      if (!seller) {
        seller = { id: body.requestId, storeId, name: body.name, active: true, userId: null, version: 0 }
        api.salespeople[storeId].push(seller)
      }
      if (api.dropTeamCreation) {
        api.dropTeamCreation = false
        return route.abort('failed')
      }
      return respond(200, seller)
    }
    const seller = api.salespeople[storeId].find(seller => seller.id === id)
    if (body.version !== seller.version) return respond(409, { message: 'Cadastro alterado. Atualize os dados.' })
    if (action) {
      if (body.email && body.email !== api.memberEmail) return respond(404, { message: 'Conta não participa desta loja.' })
      seller.userId = body.email ? 'account-vendedor' : null
    } else {
      seller.name = body.name
      seller.active = body.active
    }
    seller.version += 1
    return respond(200, seller)
  })
  return api
}

export async function openTeam(page, storeId = 'north') {
  await page.goto('/')
  await page.getByLabel('Loja ativa').selectOption(storeId)
  await page.getByRole('button', { name: 'Equipe e vendedores', exact: true }).click()
}
