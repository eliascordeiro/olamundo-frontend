# Murimel: vendas e comissoes

Analise **estatica e somente leitura**, realizada para orientar a UX de varejo
e as proximas entregas. Nao houve execucao do legado, consulta ao banco,
importacao de dados, leitura de credenciais ou certificacao de paridade.
Escopo: PDV, caixa ativo, grupos e os tres caminhos de relatorio de comissao.
Nao e um inventario completo do ERP.

Analise complementar:
[estoque, clientes e adaptacao de dados](inventory-analysis/architecture_index.md).
Esse recorte posterior nao altera a fronteira da repaginacao descrita aqui
nem autoriza importacao ou mudancas no legado.

Raiz dos fontes citados como `Murimel/`:
`/media/araudata/829AE33A9AE328FD1/SISTEMAS_MINIGUI_XHARBOUR/Murimel/`.
Os arquivos PRG foram lidos como Windows-1252; numeros de linha referem-se
aos originais. Nao ha copia de dados comerciais ou fontes legados neste repo.

## Conclusoes que orientam esta entrega

- O menu ativo chama `Easy200(.F.)` para PDV e `Easy201()` para caixa
  (`EasyControl.Prg:169,171`). A chamada `Easy200(.T.)` esta comentada.
- O PDV grava venda pendente; o caixa confirma e baixa estoque. Pedido interno
  da Nexo **nao equivale** a venda, orcamento comercial, recebimento ou reserva.
- A venda exige contexto de cliente, vendedor e loja; itens possuem locais de
  saida e retirada, entrega/montagem, precos e descontos.
- Ha pagamento composto, parcelas, entrada, frete/servico, condicoes financeiras
  e autorizacao de desconto. A tela nova nao pode apenas renomear o pedido.
- O cadastro de grupos relaciona `comissao_loja.loja` ao **codigo do vendedor**
  (`Easy161.prg:486`). O nome da coluna nao prova comissao por loja.
- Os relatorios nao sao uma especificacao univoca. As divergencias abaixo
  precisam de decisao do negocio antes de implementar valores.

## Divergencias e validacoes obrigatorias antes da migracao

1. **Base da comissao:** `Comissao.Prg:88,119` usa preco x quantidade e
   percentual padrao do grupo. `Easy650.Prg:149,232` e
   `Easy651.Prg:141,206` selecionam `easy_itens.desconto` como campo 12:
   quando zero, usam preco x quantidade; quando diferente de zero, usam
   **o proprio campo desconto como base**. Nao chamar esse campo de totalreal.
   O significado real exige DDL, amostras anonimizadas e exemplos de fechamento.
2. **Escolha do vendedor:** em `Easy650.Prg:390` e `Easy651.Prg:299`,
   digitacao do codigo atribui `_loja` a primeira coluna do vendedor;
   ja o duplo clique da busca atribui a **coluna Loja**
   (`Easy650.Prg:413`, `Easy651.Prg:322`). O lookup de excecao usa `_loja`.
   O resultado pode depender do caminho de selecao. Nao replicar essa
   inconsistencia como regra de negocio.
3. **Percentual:** detalhado/resumido consultam configuracao atual e fazem
   fallback para percentual padrao quando o especifico e zero
   (`Easy650.Prg:453`, `Easy651.Prg:344`). Nao foi encontrado snapshot da taxa
   nesses calculos. Definir competencia, congelamento, arredondamento,
   cancelamento e se zero pode significar isencao.
4. **Identificadores:** `Easy200.prg:1820` calcula venda por cliente. Nao usar
   somente numero da venda como chave global. Preservar origem, cliente,
   venda, sequencia e loja, validando unicidade contra DDL/dados.
5. **Produto:** codigo combina grupo/subgrupo/produto e aparece com zeros
   a esquerda. Preservar representacao original e vinculo historico; nao
   substituir identidade por SKU sem tabela de correspondencia.
6. **Datas e situacao:** PDV cria `situacao="X"`; caixa usa `situacao=""`
   e altera data do cabecalho e emissao dos itens (`Easy201.prg:840,849`).
   Relatorios filtram emissao. Validar competencia e historico de alteracoes.
7. **Cancelamento:** pendente e excluido fisicamente; confirmado pode retornar
   estoque e ser marcado cancelado (`Easy201.prg:900`). Ha guardas por texto
   de tela inconsistentes. Nao remover auditoria nem enfraquecer a atomicidade
   e idempotencia ja existentes nos pedidos da Nexo.
8. **Persistencia:** inserts posicionais e consultas por `FieldGet` nao provam
   tipos, constraints ou ordem real das colunas. As funcoes analisadas nao
   mostram transacao abrangendo cabecalho, itens, pagamentos e estoque.
   Nao transportar essas limitacoes para o novo modulo.
9. **Entrega/montagem:** datas, endereco, loja de saida e retirada sao distintos;
   montagem depende do produto. Confirmar operacao real e responsabilidades.
10. **Autenticacao:** vendedor legado tambem possui senha/permissoes de modulo.
    Nao copiar senhas nem tratar automaticamente STAFF como vendedor comercial.

## Incrementos de negocio a validar

Acordado nesta entrega: repaginar somente o frontend; manter operacoes atuais;
deixar as funcoes ainda indisponiveis explicitas. Nenhuma migracao e iniciada.

Proximas etapas sugeridas, ainda sujeitas a validacao:

1. Cadastros de grupos/subgrupos e vendedor comercial por loja; politica de
   comissao padrao/excecao, com decisoes sobre as divergencias acima.
2. Clientes e lancamento comercial com itens, precos, descontos e autorizacoes.
3. Condicoes/pagamentos compostos, parcelas e confirmacao atomica no caixa.
4. Retirada, entrega, montagem, impressao e cancelamento auditavel.
5. Comissoes e conciliacao de exemplos reais com os relatorios do legado.
6. Migracao ensaiada: extracao somente leitura, correspondencias de IDs,
   conciliacao de contagens/saldos/valores, cutover e retorno controlados.

## Implementation Guide

This index is not the full contract. Do not implement from this file alone;
follow the artifact paths below.

### Contratos globais

- [unit_graph.yaml](unit_graph.yaml): unidades do recorte, entradas e fontes.
- [migration_boundary.yaml](migration_boundary.yaml): somente UX nesta entrega;
  os source anchors legados **nao sao alvos de reescrita**.
- [wire_contracts.yaml](wire_contracts.yaml): ler linhas cuja `unit` seja a
  unidade atribuida ou `global`; interfaces SQL sao evidencias, nao um ETL pronto.
- [shared_modules.yaml](shared_modules.yaml): filtrar `used_by_units`.
- [cross_unit_state.yaml](cross_unit_state.yaml): filtrar `writer.unit` ou
  `reader.unit`; `must_confirm: runtime` significa verificacao pendente.
- [seams.yaml](seams.yaml): fronteira declarada, nenhum adaptador ou dual-write.
- [project-structure.md](project-structure.md), [tech-stack.md](tech-stack.md)
  e [data-model.md](data-model.md): contexto e limites da evidencia.

### Leituras por unidade

| Unidade / entrada | Comportamento | Wiring | Candidatos de separacao |
|---|---|---|---|
| sales-pdv / Easy200(.F.) | [behavior](units/sales-pdv/behavior.yaml) | [bindings](units/sales-pdv/bindings.yaml) | [decomposition](units/sales-pdv/unit_decomposition.yaml) |
| cashier / Easy201() | [behavior](units/cashier/behavior.yaml) | [bindings](units/cashier/bindings.yaml) | [decomposition](units/cashier/unit_decomposition.yaml) |
| product-groups / Easy161() | [behavior](units/product-groups/behavior.yaml) | [bindings](units/product-groups/bindings.yaml) | [decomposition](units/product-groups/unit_decomposition.yaml) |
| commission-personal / Comissao() | [behavior](units/commission-personal/behavior.yaml) | [bindings](units/commission-personal/bindings.yaml) | [decomposition](units/commission-personal/unit_decomposition.yaml) |
| commission-detail / Easy650() | [behavior](units/commission-detail/behavior.yaml) | [bindings](units/commission-detail/bindings.yaml) | [decomposition](units/commission-detail/unit_decomposition.yaml) |
| commission-summary / Easy651() | [behavior](units/commission-summary/behavior.yaml) | [bindings](units/commission-summary/bindings.yaml) | [decomposition](units/commission-summary/unit_decomposition.yaml) |
| retail-workspace / SPA Nexo | [behavior](units/retail-workspace/behavior.yaml) | [bindings](units/retail-workspace/bindings.yaml) | [decomposition](units/retail-workspace/unit_decomposition.yaml) |

Para cada unidade, consultar tambem suas linhas dos contratos globais. Antes de
implementar uma etapa futura, registrar artefatos lidos, comportamentos
preservados, divergencias decididas/pendentes e evidencias de testes/build/runtime.
`must_preserve` indica intencao funcional para futura paridade, nao autorizacao
para implementar backend ou reproduzir bugs nesta entrega.
