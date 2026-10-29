import { test, expect } from '@playwright/test'
import { marina, mockQueryApi } from './query-api'

const murimel = { id: 'owner-murimel', name: 'Móveis Murimel', email: null, status: 'PENDING', userId: null }

async function setupPlatform(page, { user = { ...marina, platformAdmin: true } } = {}) {
  const api = await mockQueryApi(page, { user })
  api.owners = [structuredClone(murimel)]
  api.platformCalls = []
  api.ownersStatus = 200
  api.inviteStatus = 200
  api.acceptStatus = 200
  api.existingAccounts = new Set()
  await page.route('**/api/platform/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const body = method === 'POST' ? request.postDataJSON() : undefined
    api.platformCalls.push({ path: url.pathname, method, body, headers: request.headers() })
    const respond = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (!api.user?.platformAdmin && url.pathname !== '/api/platform/invites/accept') {
      return respond(403, { message: 'Acesso restrito ao administrador da plataforma.' })
    }
    if (method === 'GET' && url.pathname === '/api/platform/owners') {
      if (api.ownersStatus !== 200) return respond(api.ownersStatus, { message: 'Falha ao carregar proprietários.' })
      const pageNumber = Number(url.searchParams.get('page') || 0)
      const size = Number(url.searchParams.get('size') || 20)
      return respond(200, { content: api.owners.slice(pageNumber * size, (pageNumber + 1) * size),
        page: pageNumber, size, hasNext: api.owners.length > (pageNumber + 1) * size })
    }
    if (request.headers()['x-csrf-token'] !== 'test-csrf') return respond(403, { message: 'CSRF ausente.' })
    const issue = (owner, email) => {
      if (api.existingAccounts.has(email)) {
        Object.assign(owner, { email, status: 'ACTIVE', userId: 'account-existing' })
        return { owner, inviteToken: null, expiresAt: null }
      }
      Object.assign(owner, { email, status: 'INVITED' })
      return { owner, inviteToken: `token-${email}`, expiresAt: '2030-01-01T12:00:00Z' }
    }
    if (url.pathname === '/api/platform/owners') {
      const owner = { id: body.requestId, name: body.name, email: null, status: 'PENDING', userId: null }
      api.owners.push(owner)
      return respond(200, body.email ? issue(owner, body.email) : { owner, inviteToken: null, expiresAt: null })
    }
    const invite = url.pathname.match(/^\/api\/platform\/owners\/([^/]+)\/invite$/)
    if (invite) {
      if (api.inviteStatus !== 200) return respond(api.inviteStatus, { message: 'Este e-mail ou conta já está associado a outro proprietário.' })
      return respond(200, issue(api.owners.find(owner => owner.id === invite[1]), body.email))
    }
    if (url.pathname === '/api/platform/invites/accept') {
      if (api.acceptStatus !== 200) return respond(api.acceptStatus, { message: 'Convite inválido ou expirado. Peça um novo convite.' })
      return respond(200, { name: 'Móveis Murimel', email: 'dono@murimel.example.com' })
    }
    return respond(404, { message: 'Rota inexistente.' })
  })
  return api
}

test('Super vê Móveis Murimel pendente e não recebe o workspace de lojas', async ({ page }) => {
  const api = await setupPlatform(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Proprietários', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Móveis Murimel', exact: true })).toBeVisible()
  await expect(page.getByText('Aguardando convite', { exact: true })).toBeVisible()
  await expect(page.getByText('Sem e-mail cadastrado', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Loja ativa')).toHaveCount(0)
  expect(api.calls.some(call => call.path.startsWith('/api/stores'))).toBe(false)
})

test('Super emite convite para Móveis Murimel e o link aparece uma única vez', async ({ page }) => {
  const api = await setupPlatform(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Convidar Móveis Murimel', exact: true }).click()
  await page.getByLabel('E-mail do proprietário', { exact: true }).fill(' Dono@Murimel.example.com ')
  await page.getByRole('button', { name: 'Emitir convite', exact: true }).click()
  const link = page.getByLabel('Convite emitido')
  await expect(link).toContainText('/?convite=token-Dono%40Murimel.example.com')
  await expect(link).toContainText('exibido uma única vez')
  await expect(page.getByText('Convite emitido', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Convidar Móveis Murimel', exact: true })).toBeVisible()
  const post = api.platformCalls.find(call => call.method === 'POST')
  expect(post.body).toEqual({ email: 'Dono@Murimel.example.com' })
  expect(post.headers['x-csrf-token']).toBe('test-csrf')
  await page.getByRole('button', { name: 'Fechar convite', exact: true }).click()
  await expect(page.getByLabel('Convite emitido')).toHaveCount(0)
  await page.reload()
  await expect(page.getByLabel('Convite emitido')).toHaveCount(0)
})

test('Super cadastra proprietário novo e conta existente é ativada sem convite', async ({ page }) => {
  const api = await setupPlatform(page)
  api.existingAccounts.add('ja@existe.example.com')
  await page.goto('/')
  await page.getByLabel('Nome do novo proprietário', { exact: true }).fill('  Loja Sul  ')
  await page.getByRole('button', { name: 'Cadastrar proprietário', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Loja Sul', exact: true })).toBeVisible()
  await expect(page.getByText('Loja Sul foi cadastrado.', { exact: false })).toBeVisible()
  await page.getByLabel('Nome do novo proprietário', { exact: true }).fill('Dona Existente')
  await page.getByLabel('E-mail do proprietário (opcional)', { exact: true }).fill('ja@existe.example.com')
  await page.getByRole('button', { name: 'Cadastrar proprietário', exact: true }).click()
  await expect(page.getByText('foi ativado com a conta existente', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Convite emitido')).toHaveCount(0)
  await expect(page.getByText('Ativo', { exact: true })).toBeVisible()
  const creations = api.platformCalls.filter(call => call.method === 'POST')
  expect(creations[0].body).toMatchObject({ name: 'Loja Sul' })
  expect(creations[0].body.email).toBeUndefined()
  expect(typeof creations[0].body.requestId).toBe('string')
})

test('falha ao listar proprietários não vira lista vazia e conflito de convite é exibido', async ({ page }) => {
  const api = await setupPlatform(page)
  api.ownersStatus = 503
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Falha ao carregar proprietários')
  await expect(page.getByText('Nenhum proprietário nesta página.')).toHaveCount(0)
  api.ownersStatus = 200
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  api.inviteStatus = 409
  await page.getByRole('button', { name: 'Convidar Móveis Murimel', exact: true }).click()
  await page.getByLabel('E-mail do proprietário', { exact: true }).fill('dono@murimel.example.com')
  await page.getByRole('button', { name: 'Emitir convite', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('já está associado a outro proprietário')
  await expect(page.getByLabel('Convite emitido')).toHaveCount(0)
})

test('usuário comum não vê o console nem consulta a plataforma', async ({ page }) => {
  const api = await setupPlatform(page, { user: marina })
  api.stores = [{ id: 'north', name: 'Móveis Norte', role: 'OWNER' }]
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Proprietários', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Loja ativa')).toBeVisible()
  expect(api.platformCalls).toHaveLength(0)
})

test('proprietário convidado define a senha pelo link e o token sai da URL', async ({ page }) => {
  const api = await setupPlatform(page, { user: null })
  await page.goto('/?convite=token-abc_123')
  await expect(page.getByRole('form', { name: 'Aceitar convite' })).toBeVisible()
  expect(new URL(page.url()).search).toBe('')
  await page.getByLabel('Seu nome', { exact: true }).fill('Dono Murimel')
  await page.getByLabel('Nova senha', { exact: true }).fill('uma-senha-bem-longa-123')
  await page.getByRole('button', { name: 'Criar meu acesso', exact: true }).click()
  await expect(page.getByText('dono@murimel.example.com', { exact: false })).toBeVisible()
  const accept = api.platformCalls.find(call => call.path === '/api/platform/invites/accept')
  expect(accept.body).toEqual({ token: 'token-abc_123', name: 'Dono Murimel', password: 'uma-senha-bem-longa-123' })
  expect(accept.headers['x-csrf-token']).toBe('test-csrf')
  await page.getByRole('button', { name: 'Ir para o login', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.', exact: true })).toBeVisible()
})

test('convite inválido mostra erro e permite voltar ao login', async ({ page }) => {
  const api = await setupPlatform(page, { user: null })
  api.acceptStatus = 404
  await page.goto('/?convite=expirado')
  await page.getByLabel('Seu nome', { exact: true }).fill('Dono')
  await page.getByLabel('Nova senha', { exact: true }).fill('uma-senha-bem-longa-123')
  await page.getByRole('button', { name: 'Criar meu acesso', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Convite inválido ou expirado')
  await page.getByRole('button', { name: 'Já tenho conta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.', exact: true })).toBeVisible()
})
