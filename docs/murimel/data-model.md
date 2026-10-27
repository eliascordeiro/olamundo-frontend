# Modelo de dados observado no recorte

Inventario inferido dos SELECT/INSERT/UPDATE. **Nao e DDL validado**; nao
presume constraints, tipos, ordem de colunas ou integridade referencial.

| Tabela / entidade | Campos ou relacoes observadas | Fonte |
|---|---|---|
| easy_vendas | codigo (cliente), venda, data, loja, codven, modalidade, totprodutos, acrescimo, desconto, frete, entrada, totvenda, custo, campos financeiros, situacao, cancela, parcelas, tipo_juro | Easy200.prg:1583; Easy201.prg:840 |
| easy_itens | codigo/venda/sequencia, codpro, descricao snapshot, qtde, preco, emissao, loja, lojasaida, codven, situacao/cancela, retirada/entrega/montagem, endereco/datas, custo, MK e valores de desconto/originais | Easy200.prg:1558; Easy650.Prg:149 |
| pagamentos | codigo_cliente, codigo_venda, modalidade, valor, parcelas e emissao; insert posicional | Easy201.prg:867,886 |
| easy_lojasaldo | codpro + codloja, saldo; baixa pelo local de saida do item | Easy201.prg:853,862,954 |
| easy_grupo | codigo, grupo, comissao, descmontagem, mk, desconto_pauta, desconto_flexivel, comissao_montagem, ncm | Easy161.prg:340,344 |
| comissao_loja | loja, grupo, comissao; cadastro junta loja ao codigo do vendedor, nao ao cadastro de loja | Easy161.prg:361,372,486 |
| easy_vendedor | codigo, loja, vendedor, senha e permissoes de modulo; separar conceito comercial do usuario autenticado na migracao | Easy120.prg:463; EasyControl.Prg:555 |
| endereco | endereco associado a cliente e CEP; CEP vinculado aos itens | Easy200.prg:4007; Easy201.prg:1713 |

Complementos: easy_subgrupo tem grupo/subgrupo, descricao, margem, MK e regras
de desconto (`Easy162.prg`). Produtos carregam grupo/subgrupo e indicadores de
montagem; o identificador tambem codifica grupo/subgrupo.

Relacoes inferidas: cliente -> vendas -> itens/pagamentos; item -> produto;
produto+local de saida -> saldo; grupo -> comissao padrao; grupo+vendedor ->
excecao. Unicidade e cardinalidade reais ainda exigem validacao.

Chaves nao podem ser simplificadas: numero de venda e obtido por cliente
(`Easy200.prg:1820`); codigos exibem zeros a esquerda. Preservar representacao
original e manter correspondencia de origem durante futura migracao.

As funcoes de gravacao analisadas escrevem varias tabelas por consultas
sequenciais. Nao foi observada transacao explicita abrangente nelas; nao se
afirma comportamento de rollback da conexao ou engine sem runtime.
