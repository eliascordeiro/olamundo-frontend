# Stack existente e limites da evidencia

## Murimel

- Fontes xHarbour/Harbour PRG e interface Windows MiniGUI, com callbacks
  `DEFINE WINDOW`/`ACTION` e funcoes `Static Function`.
- Codificacao observada: Windows-1252. Importacao futura deve verificar tambem
  encoding das tabelas; encoding do fonte nao prova encoding do banco.
- SQL via `oServer:Query`, `GetRow` e `FieldGet`; consultas e biblioteca
  `libmySQL.dll` indicam MySQL. Versao, schema real e engine nao verificados.
- Relatorios usam objetos COM `fly2pdf` e impressao Windows
  (`Easy650.Prg:162` e trechos de impressao do PDV/caixa).
- Nao foram executados compilador, binarios, registro COM ou consultas ao banco.
  Versoes exatas, compatibilidade e suporte das dependencias nao certificados.

## Frontend atual

Declaracoes no package.json consultado: React/React DOM `^19.3.1`,
TanStack Query `^5.104.5`, Vite `^8.3.4`, plugin React `^6.1.2`,
Playwright `^1.64.1`, oxlint `^1.88.0`. JavaScript JSX, ES modules.
Nenhuma dependencia foi adicionada para a repaginacao.

Scripts existentes: `npm run lint`, `npm run build`, `npm test` (Playwright).
Testes de UI com API interceptada nao certificam o banco legado nem integracao
real Spring/PostgreSQL/MongoDB. Esses limites devem acompanhar a entrega.
