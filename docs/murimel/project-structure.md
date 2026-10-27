# Estrutura observada

O Murimel e um aplicativo **desktop**, nao uma aplicacao MVC web. O recorte
inspecionado tem telas MiniGUI em PRG, callbacks estaticos, estado global/private,
SQL e impressao misturados no mesmo modulo.

| Area | Entrada / fonte | Papel |
|---|---|---|
| Menu e sessao | EasyControl.Prg:169,171,555 | Dispara telas, carrega vendedor/loja/permissoes |
| PDV | Easy200.prg:10,1343 | Atendimento, itens, precos, pagamentos e endereco |
| Caixa ativo | Easy201.prg:10,783,900 | Confirma, baixa estoque, cancela e imprime |
| Vendedores | Easy120.prg:463 | Cadastro comercial e permissoes de acesso |
| Grupos | Easy161.prg:318,474 | Comissao padrao e grade especifica |
| Subgrupos | Easy162.prg | Margem, MK, pauta/flexivel e recalculo de precos |
| Comissao pessoal | Comissao.Prg:5,55 | Relatorio do vendedor logado |
| Detalhado / resumido | Easy650.Prg:5 / Easy651.Prg:5 | Relatorios selecionando vendedor |

Ha outros dominios no menu (compras, fornecedores, despesas, contas e montagem).
Nao foram inventariados integralmente. Arquivos C gerados, objetos, executaveis,
backups e documentos nao foram tratados como fonte de verdade de comportamento.
Nao ha contagem de LOC ou inventario completo de dependencias nesta analise.

O frontend Nexo separado e uma SPA React/Vite com hooks TanStack Query.
As telas de catalogo/estoque/pedidos ja usam APIs por loja; o backend Spring
Boot possui modulos separados e persistencia relacional dessas operacoes.
O backend e o banco legado nao sao alterados pela repaginacao.
