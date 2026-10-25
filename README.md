# Nexo Business - Frontend

Workspace corporativo em React + Vite: login responsivo, cadastro, visualizacao
de senha, restauracao de sessao, mural autenticado e logout.

## Desenvolvimento

Inicie o backend na porta 8081 com o perfil `local` e MongoDB disponivel.

```bash
npm ci
npm run dev
```

Abra http://localhost:5173. O Vite encaminha `/api` para http://localhost:8081.
`VITE_API_BASE_URL` deve ficar vazio (padrao) para usar o proxy de mesma origem.
O arquivo local antigo que apontava para 8080 deve ser removido ou atualizado.

Nao existem credenciais padrao: clique em **Comecar agora** para criar sua conta.
O cadastro exige nome, e-mail e senha exclusiva de pelo menos 12 caracteres
e ate 72 bytes UTF-8.

## Seguranca e integracao

O frontend usa `credentials: include` e solicita token CSRF antes de cada
POST. Nao guarda senhas, identificadores de sessao ou JWT no localStorage.
O cookie HttpOnly e administrado pelo backend e inacessivel ao JavaScript.
Erros de rede e validacao sao exibidos; uma sessao expirada volta ao login.
O mural preserva as mensagens existentes e e compartilhado pelos usuarios.

## Dados remotos com React Query

TanStack Query gerencia a sessao e o mural; formularios e senhas continuam
no estado local dos componentes. Os hooks ficam em `src/queries.js`, sobre
a camada HTTP existente em `src/api.js`, preservando cookies e CSRF.

- Consultas ficam frescas por 30 segundos e podem atualizar ao recuperar
  foco/conexao. Isso nao substitui polling, SSE ou WebSocket para tempo real.
- Apenas falhas de rede e HTTP 5xx de consultas recebem uma nova tentativa.
  Mutacoes nunca sao repetidas automaticamente.
- Publicar uma mensagem invalida a consulta do mural daquele usuario.
- Logout, expiracao de sessao (401) e novo login cancelam consultas e removem
  dados privados anteriores. Consultas HTTP respeitam o sinal de cancelamento.
- O cache existe apenas em memoria, sem persistencia no navegador. Mutacoes
  de autenticacao sao resetadas apos a tentativa e descartadas quando inativas.

## Validacao

```bash
npm run lint
npm run build
npx playwright install chromium
npm test
```

Os testes E2E iniciam o Vite automaticamente, mas exigem backend real disponivel
em localhost:8081 e MongoDB de **testes**, sem dados reais. Eles criam contas
`nexo-e2e-...@example.com` e mensagens; descarte esse banco isolado ao terminar.
Cobrem cadastro, login invalido, sessao apos reload, cookies, CSRF, mural,
logout e viewport movel. Nao rode contra producao.

Os testes `query-*.spec.js` validam a integracao do React Query no navegador
com API interceptada: sessao, CSRF, invalidacao do mural, retries, erros e
isolamento/cancelamento de consultas entre sessoes. Nao exigem backend:

```bash
npm test -- e2e/query-session.spec.js e2e/query-messages.spec.js e2e/query-isolation.spec.js
```

Esses testes nao substituem os E2E com Spring Boot e MongoDB reais.

## Producao / Railway

O Dockerfile compila o React e usa nginx para servir a SPA e encaminhar `/api/`
ao backend. Configure:

| Variavel em runtime | Exemplo | Finalidade |
| --- | --- | --- |
| `PORT` | `80` | Porta nginx, normalmente definida pela hospedagem |
| `BACKEND_URL` | `https://olamundo-production-f50d.up.railway.app` | URL padrao do backend, **sem barra final e sem /api** |

`VITE_API_BASE_URL` permanece vazio no build. A imagem usa por padrao
`https://olamundo-production-f50d.up.railway.app`. No Railway, remova qualquer
override `BACKEND_URL=http://backend:8081` ou substitua-o pela URL real do
servico Java, pois variaveis do servico prevalecem sobre o padrao da imagem.
Se usar a rede privada, informe um hostname que resolva nesse ambiente.
O navegador conversa somente com o dominio do frontend; o proxy repassa os
cookies sem Domain e os mantem na mesma origem. Use HTTPS publico e mantenha
`SESSION_COOKIE_SECURE=true` no backend. Para HTTPS upstream, nginx envia SNI.
Configure tambem `CORS_ALLOWED_ORIGINS` no backend com a origem exata do
frontend (incluindo protocolo); isso permite POSTs pelo proxy com Origin.

### Fundacao multiloja - etapa 1

O Swagger usa `/api/docs` e recursos em `/api/swagger-ui/`, encaminhados pelo
proxy `/api/` existente, sem mudar a infraestrutura do frontend. Quando o backend habilitar
`API_DOCS_ENABLED=true`, entre pelo frontend e abra `/api/docs` no mesmo dominio.
A documentacao usa a sessao existente; `/api/openapi` retorna a especificacao.
Swagger fica desativado por padrao no backend e nunca dispensa CSRF ou permissoes.

Esta etapa entrega lojas e vinculos na API, ainda sem telas comerciais. O
workspace e o mural atuais nao mudam, e o mural continua compartilhado.
Na proxima etapa, o seletor de lojas e as consultas de catalogo devem incluir
`storeId` nas chaves de React Query, sem tratar a selecao visual como autorizacao.

O nginx aplica CSP, bloqueio de frames e protecao contra MIME sniffing.
OAuth, recuperacao de senha e MFA nao sao simulados na interface.
