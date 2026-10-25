# Nexo Business - Frontend

Workspace corporativo em React + Vite: login responsivo, cadastro, visualizacao
de senha, restauracao de sessao, mural autenticado, seletor de lojas,
catalogo e estoque por loja e logout.

## Desenvolvimento

Inicie o backend na porta 8081 com o perfil `local`, MongoDB e PostgreSQL
disponiveis. Siga o README do backend para exportar a configuracao local.

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

TanStack Query gerencia a sessao, o mural, as lojas, os produtos e o estoque; formularios e senhas continuam
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

## Etapa 2 - lojas e catalogo

- O workspace lista as lojas da conta em paginas de 20, com **Carregar mais lojas**.
  A selecao e explicita e nao e persistida entre reloads ou sessoes.
- Cada loja tem catalogo paginado de 20 produtos. OWNER e MANAGER podem cadastrar;
  STAFF apenas consulta. A autorizacao definitiva sempre e feita pelo backend.
- O cadastro recebe nome, SKU, descricao opcional e preco em reais. Aceita virgula
  ou ponto decimal, ate duas casas e sem separadores de milhar. Envia o preco
  como texto decimal, sem calculos monetarios em ponto flutuante.
- SKU e normalizado para maiusculas e deve ser unico apenas na loja selecionada.
  Falhas de cadastro mantem os campos preenchidos, sem repetir POST automaticamente.
- Hooks em `src/features/catalog/queries.js` isolam o cache por usuario, loja e
  pagina. Criar produto invalida somente o catalogo da loja correspondente.
  Trocar de loja desmonta o formulario e cancela consultas antigas.
- Erros de consulta sao mostrados com tentativa manual, sem fingir uma lista vazia.
  O mural existente permanece global, nao e um canal privado da loja.

Criacao de lojas e inclusao de membros continuam pela API/Swagger. Ainda nao
existem telas para imagens, edicao/exclusao de produtos ou checkout.

## Etapa 3 - estoque

- **Estoque** em cada produto abre saldo e historico paginado (20 por pagina).
  Consultas sao feitas somente para o produto selecionado, sem uma requisicao
  por item da listagem. OWNER/MANAGER registram; STAFF apenas consulta.
- Quantidades inteiras, de 1 a 2147483647; saldo inicial zero. Entrada e saida
  exigem motivo. Nenhuma quantidade e presumida para os produtos existentes.
- Os hooks de `src/features/inventory/queries.js` isolam saldo e historico por
  usuario, loja e produto; pagina tambem integra a chave do historico.
  Confirmacao invalida somente o estoque desse produto.
- Cada operacao recebe requestId UUID. Falha de rede/timeout/5xx conserva
  identificador e dados em memoria, inclusive ao trocar de produto ou loja.
  **Confirmar mesmo envio** reenvia a mesma operacao, sem duplicar o saldo.
  Os campos ficam bloqueados enquanto o resultado for incerto.
- Nao ha retry automatico de POST. Rejeicoes definitivas (por exemplo, saldo
  insuficiente) preservam o rascunho e liberam correcao para uma nova tentativa.
  Logout e expiracao removem operacoes pendentes e dados privados do cache.
- Como o cache nao e persistido, reload/fechamento da aba perde o requestId
  pendente. Se houve erro de conexao, confira o historico antes de recarregar ou
  iniciar outra operacao; o servidor pode ter confirmado mesmo sem resposta.
- O historico mostra entrada/saida, saldo apos, motivo, data local e IDs do
  responsavel e da operacao. Nao e editavel. Novas movimentacoes podem deslocar
  paginas do historico. Ainda nao existem reservas, transferencias ou baixa por venda.

## Validacao

```bash
npm run lint
npm run build
npx playwright install chromium
npm test
```

Os testes E2E iniciam o Vite automaticamente, mas exigem backend real disponivel
em localhost:8081 e MongoDB/PostgreSQL de **testes**, sem dados reais. Eles criam contas
`nexo-e2e-...@example.com` e mensagens; descarte esse banco isolado ao terminar.
Cobrem cadastro, login invalido, sessao apos reload, cookies, CSRF, mural,
logout e viewport movel. Nao rode contra producao.

Os testes `query-*.spec.js`, `catalog.spec.js` e `inventory.spec.js` validam a integracao do React Query no navegador
com API interceptada: sessao, CSRF, invalidacao do mural, retries, erros e
isolamento/cancelamento entre sessoes e lojas, papeis, precos decimais, paginacao,
cadastro, estoque/historico, resposta perdida com reenvio idempotente e layout
movel. Nao exigem backend:

```bash
npm test -- e2e/inventory.spec.js e2e/catalog.spec.js e2e/query-session.spec.js e2e/query-messages.spec.js e2e/query-isolation.spec.js
```

Esses testes nao substituem os testes HTTP do backend com bancos reais nem
a validacao manual da integracao completa no Railway.

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

### Catalogo multiloja - etapa 2

Publique primeiro o backend com as rotas de produtos e a migracao V2. Confirme
healthcheck, preservacao das lojas e ausencia de erros de migracao antes de
publicar este frontend. Nao sao necessarias novas variaveis de ambiente.

Valide no Railway cadastro como OWNER/MANAGER, leitura como STAFF, repeticao de
SKU na mesma loja e isolamento ao trocar de loja. Confira preco e persistencia
apos reload, alem de logout/login e mural. Se precisar reverter, publique o
frontend anterior antes de reverter o backend, sem apagar tabelas do banco.

O nginx aplica CSP, bloqueio de frames e protecao contra MIME sniffing.
OAuth, recuperacao de senha e MFA nao sao simulados na interface.

### Estoque multiloja - etapa 3

Publique primeiro o backend com migracao V3, confirme healthcheck e preservacao
dos produtos antes deste frontend. Nao ha novas variaveis ou configuracao nginx.
Valide entrada de 10, saida de 3 (saldo 7), bloqueio de saida de 8, historico,
consulta como STAFF e isolamento entre lojas. Para rollback, frontend anterior
primeiro, depois backend, sem apagar tabelas nem historico.
