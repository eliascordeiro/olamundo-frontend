# Inventario fonte-ancorado de entidades

Colunas abaixo sao observadas em SQL/controles, **nao DDL certificado**.
INSERT sem lista de colunas nao prova tipo ou ordem real. Nao usar o
inventario como script de carga.

| Tabela | Chave/relacao observada | Conteudo relevante | Fonte |
|---|---|---|---|
| easy_grupo | codigo | grupo, comissao, descmontagem, mk, desconto_pauta/flexivel, comissao_montagem, ncm | Easy161.prg:318 |
| easy_subgrupo | codgrupo + codsubgrupo | subgrupo, mk, margem, descontos pauta/flexivel | Easy162.prg:220 |
| easy_produtos | codigo; grupo/subgrupo separados | descricao em 4x45 caracteres, custo, venda, mk, codfab, montagem, link, obs, cfop, descontos | Easy163.prg:492,595 |
| easy_lojasaldo | codpro + codloja | saldo atual; cadastro global de produto com varias linhas por local | Easy163.prg:676 |
| easy_loja | codigo | loja, razao, CNPJ/IE, contatos, endereco, deposito, nota/serie | Easy130.prg:456 |
| easy_transferencia | numero + codigo/origem/destino, unicidade a verificar | produto, qtde, data, nota, preco/total e indicador de baixa | Easy164.prg:600 |
| easy_pedidos | codigo (fornecedor) + pedido, linhas; alternativa por nota | codpro, descricao, qtde, nrseq inferido do insert, custo, total, customedio, data/previsao, nota/datanota, local, grupo | Easy300.Prg:538; Easy301.Prg:655 |
| easy_fornecedor | codigo | nome do fornecedor; demais campos fora deste recorte | Easy301.Prg:337 |
| easy_cliente | codigo | nome, nascimento/cadastro, CPF/CNPJ/RG/IE, contatos, endereco, IBGE, DDD, complemento e dados de credito | Easy100.prg:766,856 |
| easy_vendas | codigo (cliente) + venda | cabecalho, loja, vendedor, valores, condicoes, situacao/cancela | Easy200.prg:1582 |
| easy_itens | codigo + venda + nrseq | produto, qtde/preco, descricao, emissao, loja, lojasaida, retirada, logistica, situacao/cancela | Easy200.prg:1558; Easy201.prg:853 |
| pagamentos | codigo_cliente + codigo_venda | modalidade, valor, parcelas, emissao | Easy201.prg:868,886 |
| endereco | cliente e CEP nas consultas | endereco de entrega vinculado aos itens | Easy200.prg:4027 |
| comissao_loja | grupo + loja (cadastro junta vendedor.codigo) | percentual especifico, nao assumir loja fisica | Easy161.prg:486 |
| assistencia / assistencia_produtos | codigo + numero na tela atual | descricao/situacao/valor e produtos, quantidades | assistencia.prg:253,308 |
| easy_endereco / easy_bairro / easy_cidade | lookup de endereco/CEP | dados auxiliares de localizacao, nao equivalentes automaticamente a endereco de entrega | Easy100.prg (consultas auxiliares) |

## Semanticas que impedem uma copia direta

- Codigo do produto e formatado como grupo/subgrupo/sequencia; zeros e
  representacao original precisam ser preservados. Os campos grupo/subgrupo
  tambem precisam ser conciliados com os digitos, nao presumidos iguais.
- Descricao pode ter padding e conversao RevTexto; preservar original bruto
  em area restrita, e validar normalizacao. Nao inferir foto pela presenca de
  link; a consulta a campo foto em Imagem.Prg:43 esta comentada.
- Saldo pode ser alterado diretamente no cadastro. Recebimento, transferencia
  e caixa tambem escrevem. Nao ha um livro de movimentos unico observado.
- Transferencia pode ter documento sem baixa; origem/destino documental
  podem divergir do local real do saldo por regra especial 05 -> 2.
- easy_pedidos mistura compra pendente e entrada. Consulta auxiliar usa nota
  vazia como sinal de compra prevista (Apoio.prg:657); classificacao precisa
  considerar outros campos e casos reais.
- Custo medio de entrada considera saldos positivos globais do produto
  (Easy301.Prg:773), nao apenas a loja que recebe.
- Alteracao de descricao propaga para historico; utilitario de manutencao
  tambem renumera referencias. Historico legado pode nao ser imutavel.
- Datas vazias podem ser gravadas como 0000-00-00 (Easy301.Prg:720),
  formato que nao deve ser convertido em data valida inventada no PostgreSQL.
- Campos de credito do cliente incluem salario e referencias: finalidade,
  acesso e retencao precisam de aprovacao; nao sao obrigatorios para estoque.

## Modelo atual comparado, sem redesenho

| Estrutura atual | O que comporta | O que nao esta representado |
|---|---|---|
| stores/store_memberships (V1) | nome da loja, UUID, usuario/papel | empresa/rede formal, deposito e metadados comerciais/fiscais |
| catalog_products (V2) | produto por loja, nome 120, SKU 64 unico na loja, descricao 2000, preco BRL numeric(12,2) | grupo/subgrupo, custo, codigo de origem dedicado, identidade comum entre lojas, politicas e montagem |
| inventory_balances (V3) | quantidade integer >=0, versao, loja+produto | local dentro da loja, reservado/em transito, quantidade fracionada |
| inventory_movements (V3) | IN/OUT, requestId, sequencia, motivo/autor/data e saldo apos | documento de transferencia/recebimento e lote de migracao como campos estruturados |
| sales_orders/lines (V4/V5) | pedido interno, precos congelados, rascunho/confirmado/cancelado, estorno | cliente, vendedor comercial, pagamentos, descontos, frete, entrega/montagem, sequencias comerciais por local |

InventoryService.move e transacional; JdbcInventoryRepository.lockBalance usa
FOR UPDATE; requestId repetido com dados divergentes recebe conflito.
OrderService.confirm/cancel compoe movimentos na mesma transacao.
Essas garantias existentes devem ser preservadas.

## Complemento: identidades e acessos

- `easy_vendedor`: `codigo`, `loja`, `vendedor`, `senha` e flags de acesso
  no mesmo registro (`Easy120.prg:463,536`). Login e cadastro usam essa
  entidade. `loja` aponta para `easy_loja.codigo` nas consultas; FK real
  nao comprovada.
- Flags incluem cadastros, estoque, PDV/caixa, compras, entregas, relatorios e
  `iMaster`. A coluna nao equivale a um papel OWNER/MANAGER/STAFF.
- `easy_senha`: usuario e credencial de autorizacao em cadastro separado
  (`EasySenha.Prg:181`). Nao existe vinculo de propriedade de loja
  comprovado nesse fluxo. Senhas nao fazem parte da carga proposta.
- Sessao: `EasyCodVen` (codigo), `CodLoja` e `oUsuario` (nome) sao carregados
  de easy_vendedor (`EasyControl.Prg:565`). O operador e vendedor selecionado
  no PDV sao campos distintos (`Easy200.prg:1360,1582`).
- O INSERT posicional de vendedor diverge dos indices de login/MontaCheck
  para o bloco de i301/i503; estrutura real e dados ainda nao verificados.
- Destino atual: `UserAccount` na colecao MongoDB `users` contem id, name,
  email, passwordHash e createdAt. `store_memberships` relacional vincula
  usuario e loja com papel, sem FK entre bancos. A conta nao possui cadastro
  comercial de vendedor independente nesses contratos.
- Identidade historica de vendedor nao prova pessoa ativa: exclusao fisica
  existe em `Easy120.prg:236`; orfaos precisam ser medidos na copia.
