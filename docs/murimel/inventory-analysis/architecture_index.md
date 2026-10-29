# Murimel: estoque, clientes, acessos e adaptacao ao sistema atual

Analise de 28/10/2026, baseada em fontes e nas migrations/classes atuais.
**Somente leitura do legado; sem conexao ao banco, importacao ou alteracao
funcional do novo sistema.** Nao se certificam dados, volumes ou paridade.

Raiz `Murimel/` nos anchors:
`/media/araudata/829AE33A9AE328FD1/SISTEMAS_MINIGUI_XHARBOUR/Murimel/`.
Raiz `backend/`: `backend-olamundo/`, ao lado deste repositorio.
Os PRG foram decodificados como Windows-1252; isso nao prova o charset do banco.
As propostas estao separadas dos fatos em
[adaptation-proposal.yaml](adaptation-proposal.yaml) e
[access-migration-proposal.yaml](access-migration-proposal.yaml).

## Resposta objetiva

**E viavel aproveitar os dados e a experiencia operacional do Murimel. Nao e
seguro importar diretamente para as tabelas atuais sem ampliar o modelo.**
O legado possui um produto compartilhado e saldos por loja/local; o destino
possui produtos pertencentes a uma loja. Clientes, fornecedores, grupos,
subgrupos, custo, transferencias e venda comercial ainda nao cabem
integralmente nos contratos atuais.

Nao e necessario reescrever o backend inteiro. A base modular Spring Boot,
PostgreSQL, Flyway e as operacoes transacionais de estoque podem ser mantidas.
O reaproveitamento recomendado e de **dados, regras confirmadas e jornadas**,
nao dos controles MiniGUI, SQL concatenado, senhas ou limitacoes do desktop.

## Programas encontrados

Entradas ativas comprovadas no menu `EasyControl.Prg:146`:

| Area | Programa | Acesso SQL principal |
|---|---|---|
| Grupo | Easy161.prg | GravaGrupo:318; easy_grupo e comissao_loja |
| Subgrupo | Easy162.prg | GravaSubGrupo:220; easy_subgrupo e reajuste de produtos |
| Produtos e saldos editaveis | Easy163.prg | GravaProdutos:492; MostraSaldo:676 |
| Transferencias | Easy164.prg | GravaTrans:600; easy_transferencia e easy_lojasaldo |
| Alteracao de precos | Easy165.Prg | GravaAcresce:203; easy_produtos.venda |
| Pedido de compra | Easy300.Prg | GravaPedido:538; easy_pedidos |
| Entrada de mercadoria | Easy301.Prg | GravaEntrada:655; easy_pedidos, custo e saldo |
| Clientes | Easy100.prg | Set_Grava:766; easy_cliente; escrita secundaria condicional |

Superficies auxiliares inspecionadas:

- `Easy130.prg:456`: lojas, dados fiscais, endereco e campo deposito.
- `Apoio.prg:275,506,657`: F5 consulta estoque agregado, por local e previsoes
  de compra; pode orientar uma busca mais rapida no novo balcao.
- `Easy500.prg:141,305`: balanco geral, quantidade e valorizacao por custo/venda.
- `Easy501.Prg:221,384`: balanco por loja, grupo e subgrupo.
- `Easy502.Prg:178,235,318,395`: historico cruza vendas, compras, transferencias
  e saldo. Algumas partes buscam por descricao, nao por codigo.
- `Easy200.prg:2574`: consulta pendentes e saldo agregado; isso **nao prova**
  uma reserva transacional por local. `Easy201.prg:862,954` baixa/estorna.
- `assistencia.prg:253,308`: assistencia atual com cabecalho e produtos;
  inspecao de vinculos, nao analise completa de pos-venda.
- `Manutencao.Prg:48`: renumeracao de produtos e referencias. O menu desse
  utilitario esta comentado (`EasyControl.Prg:267`).
- `Easy166`/`Easy167` possuem writers de saldo, mas suas entradas de estoque
  estao comentadas (`EasyControl.Prg:162,163`). Nao assumir uso atual.
  Assistencia ativa e `assistencia()`, nao automaticamente `Easy166()`.

## Onde estao os dados

Os fontes usam **MySQL**, com `TMySQLServer():New(...)` em
`EasyControl.Prg:368` e selecao de banco em `My_SQL_Database_Connect:465`
(`oServer:SelectDB:490`; `iServer:SelectDB:519`).
Chamadas SQL comerciais passam por `oServer:Query`.

Isso identifica o mecanismo de acesso, **nao confirma qual servidor/base
contem os dados oficiais do cliente**. Ha selecao condicional de outra
conexao e escrita secundaria de clientes (`Easy100.prg:868`).
Argumentos de conexao, hosts, usuarios e senhas nao foram publicados.
Nao se deve executar o aplicativo para descobrir a base de producao.

Nenhum arquivo `.sql` ou com `schema` no nome foi encontrado na busca ate
dois niveis do diretorio. Isso nao prova ausencia de backup em outros locais.
Arquivos DBF/EXE nao foram tratados como prova da base comercial MySQL.

## Achados que mudam a estrategia

1. **Catalogo global versus produto por loja:** `easy_produtos.codigo` e
   referenciado por varios saldos (`codpro`,`codloja`).
   No destino `catalog_products.store_id` integra a identidade de estoque.
   Precisamos decidir a identidade compartilhada dentro da empresa/rede;
   nao compartilhar automaticamente produtos entre clientes independentes.
2. **Local apresentado versus local movimentado:** em transferencias,
   `Easy164.prg:600` grava origem/destino exibidos, mas, para usuario de
   loja 4/5, transforma local 05 em saldo de local 2.
   Essa regra precisa de um mapa de locais aprovado pelo cliente.
3. **Saldo nao e historico completo:** editar um produto apaga seus saldos e
   reinsere somente as primeiras dez linhas (`Easy163.prg:548,552`), embora a
   grade possa listar mais. Excluir transferencia apaga o documento sem
   estorno explicito (`Easy164.prg:856`).
   Nao reconstruir o saldo atual apenas somando documentos.
4. **Descricao e identidade historica:** descricao do produto tem quatro
   segmentos de 45 caracteres e pode chegar a 180 (`Easy163.prg:495`).
   O nome atual aceita 120. Alterar descricao no legado tambem altera
   itens vendidos/comprados/transferidos (`Easy163.prg:531`).
   Nao truncar silenciosamente nem supor snapshot historico imutavel.
5. **Preco tem multiplos writers:** subgrupo, produto, reajuste percentual
   e entrada de mercadoria alteram preco. Entradas tambem alteram custo medio.
   Importar deve preservar os valores fotografados, nao recalcula-los.
6. **Compras e entradas compartilham easy_pedidos:** numero do fornecedor,
   pedido, item, nota, data e local precisam ser considerados.
   Pedido de compra nao e `sales_orders`, apesar do nome parecido.
7. **Cliente nao e usuario autenticado:** clientes possuem documentos,
   contatos, enderecos e dados de credito. Nao importa-los como contas MongoDB
   nem copiar automaticamente todos os campos financeiros/pessoais.
8. **Historico nao deve movimentar estoque novamente:** carregar vendas
   antigas pela confirmacao atual geraria nova baixa. Arquivo historico e
   saldo de abertura precisam de caminhos distintos e rastreaveis.
9. **Pendencias continuam apos a troca:** compras sem recebimento, vendas
   pendentes, entregas e montagens em aberto precisam de destino operacional
   ou continuacao controlada no legado. Nao basta preservar apenas PDFs.
10. **Limites do destino:** saldo inteiro nao negativo, maximo 2147483647;
    valores monetarios decimais, produto obrigatorio na loja.
    Fracoes, negativos, referencias ausentes e datas zero do MySQL precisam
    aparecer como pendencias, nunca ser transformados silenciosamente.

## Melhorias com valor para o cliente

Propostas, nao funcionalidades entregues nesta analise:

- Encontrar produto pelo codigo antigo, SKU, descricao, grupo e subgrupo,
  com busca paginada no servidor (a busca atual do frontend e apenas local).
- Consultar fisico, comprometido e disponivel separadamente, por loja e
  deposito, com permissao para enxergar outros locais da mesma rede.
- Ajustar estoque por movimento auditado e inventario, nao apagando saldos.
- Transferir com origem/destino reais e operacao atomica/idempotente;
  incluir expedicao/recebimento se o cliente trabalhar com mercadoria em transito.
- Receber mercadoria ligada a fornecedor, pedido e nota; manter custo e
  reajuste de preco separados, com simulacao e aprovacao.
- Consultar historico do cliente sem perder vendas antigas, entrega/montagem
  e pos-venda; nao recalcular comissao historica com taxa atual.
- Preservar os codigos familiares no atendimento e adicionar pesquisa/filtros,
  em vez de obrigar o cliente a reaprender todo o cadastro.

## Antes de autorizar uma importacao

Necessarios: confirmar base(s) oficial(is), obter DDL sem dados e sem
credenciais, versao/engine/charset/collation, mapa de lojas/depositos e uma
copia consistente em ambiente restrito para diagnostico.
Depois, medir duplicidades/orfaos, comprimentos, quantidades, precisao e
pendencias, com resultado agregado e amostras anonimizadas quando possivel.

O codigo fonte nao permite declarar contagens, qualidade real dos cadastros,
saldo oficial ou esforco fechado de migracao. Nao iniciar um importador
usando nomes/ordem de colunas apenas inferidos de INSERT posicional.

## Acesso legado: usuario, vendedor, loja e master

Complemento solicitado antes de iniciar a carga de dados.
**Confirmado pelo fonte: o vendedor tambem e o usuario de login.** O cadastro
easy_vendedor contem codigo, loja, nome, credencial e permissoes individuais
(`Easy120.prg:463`). O login usa codigo do vendedor e senha
(`EasyControl.Prg:429,555`); carrega:

- `EasyCodVen`: codigo do vendedor autenticado (`:565`);
- `CodLoja`: loja vinculada ao cadastro (`:566`);
- `oUsuario`: nome do operador (`:567`);
- flags individuais para abrir cadastros, estoque, PDV, caixa, compras,
  entregas, relatorios e ferramentas (`:569`).

**A parte "o proprietario e o usuario master" nao pode ser assumida pelo
cadastro tecnico.** O que os fontes mostram e:

1. `iEasy120` abre Vendedores e a edicao de permissoes
   (`EasyControl.Prg:148`; `Easy120.prg:340`).
2. `iMaster` permite abrir **Usuarios Masters**
   (`EasyControl.Prg:263`), um cadastro separado em `easy_senha`
   (`EasySenha.Prg:181`).
3. Autorizacoes como `PedeSenha/LiberaSenha` consultam esse cadastro pela
   credencial e retornam booleano (`EasyControl.Prg:768`); o trecho nao
   registra a identidade nominal de quem autorizou. A venda tem uma
   verificacao semelhante (`Easy200.prg:2484`).
4. Nao foi encontrada uma prova de propriedade da loja nesses campos nem um
   override universal de permissoes por `iMaster`. Identificar o dono real
   exige confirmacao do cliente, nao inferencia automatica.

Loja vinculada tambem nao significa isolamento de todas as consultas:
cadastro de vendedores lista sem filtro de loja, enquanto o PDV carrega os
vendedores de `CodLoja` (`EasyControl.Prg:711`; `Easy200.prg:3086`).
O PDV grava o **vendedor selecionado** e o **operador logado** separadamente
(`Easy200.prg:1360,1582`). A comissao nao deve ser atribuida cegamente ao
usuario que digitou a venda.

### Inconsistencias a resolver antes de ativar usuarios

- Na tela de permissoes, `i120` tem rotulo **Lojas** e `i130` **Vendedores**
  (`Easy120.prg:357,358`); no menu real, `iEasy120` abre Vendedores e
  `iEasy130` abre Lojas (`EasyControl.Prg:147,148`).
  Migrar por campo/acao confirmada, nao pelo texto da checkbox.
- O INSERT posicional de vendedor coloca `ii503` antes de `ii301`
  (`Easy120.prg:534`); login e MontaCheck esperam `i301` no indice 39 e
  `i503` no 48 (`EasyControl.Prg:603,612`; `Easy120.prg:587,623`).
  Isso e uma incompatibilidade de ordem nos fontes. O impacto sobre registros
  reais so pode ser medido apos obter o DDL e consultar uma copia autorizada.
  Extracao precisa de colunas nomeadas e revisao das permissoes efetivas.

### O que podemos migrar

| Dado | Tratamento recomendado |
|---|---|
| Codigo e nome do vendedor | Preservar origem/empresa/base e codigo; nome sozinho nao identifica pessoa |
| Loja vinculada | Converter pelo mapa de lojas; permitir varios vinculos no novo sistema somente quando autorizado |
| Vendedor das vendas/comissoes | Preservar vinculo historico, mesmo para ex-funcionario sem login ativo |
| Flags de acesso | Importar como evidencia/proposta de concessao; dono revisa antes da ativacao |
| Login de pessoas que continuarao usando | Conta nominal verificada, com ativacao e nova credencial |
| Senhas antigas e credenciais masters | Nao carregar no novo sistema, Git ou relatorios |
| Flag master | Nao converter automaticamente em OWNER nem em administrador global |

O destino hoje usa conta MongoDB com email/hash BCrypt e membership
PostgreSQL por loja (`UserAccount`, `SecurityConfiguration`, `V1`).
OWNER administra membros; OWNER/MANAGER escrevem catalogo/estoque/pedidos;
STAFF consulta. Esses tres papeis **nao equivalem** a todas as flags do legado.
Promover todo vendedor a MANAGER ampliaria acessos; manter todo vendedor como
STAFF impediria operacoes de escrita necessarias. Mesmo consultas precisam
ser avaliadas quando o modulo era negado no legado.

**Primeira evolucao recomendada:** vendedor comercial vinculado a conta
quando aplicavel, gestao de acessos por loja e permissoes por funcao
concedidas pelo proprietario confirmado, antes de importar usuarios ativos.
Nao e necessario transferir autenticacao para PostgreSQL para fazer isso.
O acesso deve ser checado no backend e refletido no menu; nenhum privilegio
administrativo deve nascer da importacao automaticamente.

Conferencia documental executada: onze unidades com os tres contratos
individuais, YAML sem chaves duplicadas, referencias de compartilhamento,
links internos e anchors dentro de arquivos existentes. Nao foram executados
testes da aplicacao, pois nenhuma funcionalidade foi alterada.

## Implementation Guide

This index is not the full contract. Do not implement from this file alone;
follow the artifact paths below.

### Globais

- [unit_graph.yaml](unit_graph.yaml): onze entradas no recorte atual.
- [migration_boundary.yaml](migration_boundary.yaml): nesta entrega so analise,
  sem reescrita/importacao. Source anchors nao autorizam alterar os fontes.
- [wire_contracts.yaml](wire_contracts.yaml): SQL e limites do destino; filtrar
  `unit` pela unidade atribuida ou `global`.
- [shared_modules.yaml](shared_modules.yaml): filtrar `used_by_units`; helpers
  nao devem ser inventados ou copiados para APIs sem projeto aprovado.
- [cross_unit_state.yaml](cross_unit_state.yaml): filtrar writer/reader;
  relacionamentos estaticos ainda requerem verificacao na copia do banco.
- [seams.yaml](seams.yaml): preservar o legado; nenhuma ponte executavel criada.
- [project-structure.md](project-structure.md), [tech-stack.md](tech-stack.md),
  [data-model.md](data-model.md): fatos do recorte.
- [adaptation-proposal.yaml](adaptation-proposal.yaml): recomendacoes de
  adaptacao, ensaio, reconciliacao e corte; ainda nao aprovadas para execucao.
- [access-migration-proposal.yaml](access-migration-proposal.yaml):
  correspondencia de usuarios/vendedores/lojas, matriz de acesso observada
  e propostas de tratamento sem concessao automatica.
- [Analise anterior de vendas/comissoes](../architecture_index.md): complementar;
  nao certificar paridade comercial so com o recorte de estoque.

### Por unidade

| Unidade / entrada | Behavior | Bindings | Candidatos de separacao |
|---|---|---|---|
| groups / Easy161 | [behavior](units/groups/behavior.yaml) | [bindings](units/groups/bindings.yaml) | [decomposition](units/groups/unit_decomposition.yaml) |
| subgroups / Easy162 | [behavior](units/subgroups/behavior.yaml) | [bindings](units/subgroups/bindings.yaml) | [decomposition](units/subgroups/unit_decomposition.yaml) |
| products / Easy163 | [behavior](units/products/behavior.yaml) | [bindings](units/products/bindings.yaml) | [decomposition](units/products/unit_decomposition.yaml) |
| transfers / Easy164 | [behavior](units/transfers/behavior.yaml) | [bindings](units/transfers/bindings.yaml) | [decomposition](units/transfers/unit_decomposition.yaml) |
| price-adjustment / Easy165 | [behavior](units/price-adjustment/behavior.yaml) | [bindings](units/price-adjustment/bindings.yaml) | [decomposition](units/price-adjustment/unit_decomposition.yaml) |
| purchase-orders / Easy300 | [behavior](units/purchase-orders/behavior.yaml) | [bindings](units/purchase-orders/bindings.yaml) | [decomposition](units/purchase-orders/unit_decomposition.yaml) |
| receiving / Easy301 | [behavior](units/receiving/behavior.yaml) | [bindings](units/receiving/bindings.yaml) | [decomposition](units/receiving/unit_decomposition.yaml) |
| customers / Easy100 | [behavior](units/customers/behavior.yaml) | [bindings](units/customers/bindings.yaml) | [decomposition](units/customers/unit_decomposition.yaml) |
| legacy-login / Login -> VerLogin | [behavior](units/legacy-login/behavior.yaml) | [bindings](units/legacy-login/bindings.yaml) | [decomposition](units/legacy-login/unit_decomposition.yaml) |
| salespeople-access / Easy120 | [behavior](units/salespeople-access/behavior.yaml) | [bindings](units/salespeople-access/bindings.yaml) | [decomposition](units/salespeople-access/unit_decomposition.yaml) |
| master-credentials / EasySenha | [behavior](units/master-credentials/behavior.yaml) | [bindings](units/master-credentials/bindings.yaml) | [decomposition](units/master-credentials/unit_decomposition.yaml) |

Antes de implementar qualquer unidade: listar contratos lidos, requisitos
preservados, propostas aprovadas, divergencias ainda abertas e evidencias
de reconciliacao. Nenhum `must_preserve` autoriza copiar bugs, excluir
auditoria ou escrever na base oficial nesta etapa.
