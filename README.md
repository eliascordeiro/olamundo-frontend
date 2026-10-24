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

O nginx aplica CSP, bloqueio de frames e protecao contra MIME sniffing.
OAuth, recuperacao de senha e MFA nao sao simulados na interface.
