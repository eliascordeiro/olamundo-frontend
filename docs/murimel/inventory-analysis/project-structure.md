# Estrutura do recorte observado

## Legado

Aplicativo desktop xHarbour/MiniGUI. Menu e sessao em EasyControl.Prg;
callbacks de janela, estado private/public, SQL e impressao coexistem
nos PRG. Nao ha separacao controller/service/repository equivalente ao destino.

Entradas de estoque: Easy161, Easy162, Easy163, Easy164, Easy165.
Entradas relacionadas: Easy300 (compra), Easy301 (recebimento), Easy100 (cliente).
Consultas auxiliares: Apoio, Easy500/501/502; lojas em Easy130;
vendas/caixa em Easy200/201, analisados anteriormente.

Tamanho dos oito arquivos primarios, calculado por leitura e separacao de
linhas em Node nesta analise: Easy161 506; Easy162 366; Easy163 842;
Easy164 1085; Easy165 235; Easy300 798; Easy301 1162; Easy100 2074.
Contagem inclui linha final vazia se presente; nao e contagem de LOC.
Nao houve varredura funcional completa de todos os arquivos, backups ou
subdiretorios. Referencias em comentarios foram verificadas contra menu
e corpos relevantes antes de classificar atividade.

## Destino observado

Backend separado em Java/Spring:

- stores: loja, vinculo de usuario, papeis e autorizacao;
- catalog: cadastro/consulta de produto por loja;
- inventory: saldo e movimentos IN/OUT;
- orders: pedido interno, confirmacao com baixa e cancelamento com estorno;
- auth: usuarios/sessoes MongoDB, nao clientes comerciais.

Os quatro modulos relacionais possuem api/application/domain/infrastructure.
Persistencia via JdbcClient e Flyway V1 a V5. Frontend separado React/Vite.

Nao foram encontrados no conjunto src/main inspecionado modulos comerciais
de cliente, fornecedor, grupo/subgrupo, compra/recebimento ou transferencia.
Esta observacao e sobre a arvore local atual, nao sobre recursos externos.

## Complemento de acesso

Tres superficies adicionais: login (`EasyControl.Prg:383,546`), cadastro
de vendedor/loja/permissoes (`Easy120.prg:6,340,463`) e cadastro separado de
masters (`EasySenha.Prg:6,181`). EasyControl permanece modulo compartilhado,
nao source_anchor repetido entre unidades.

O contexto global da sessao alimenta menus e consultas. O cadastro de
vendedores e suas permissoes ficam juntos; master e outro cadastro, nao
um modelo de propriedade da empresa observado.

No destino, AuthService/UserAccount/SecurityConfiguration tratam conta e
autenticacao; StoreService/StoreAuthorization tratam membership por loja.
Nao ha equivalencia direta entre uma checkbox do legado e os tres papeis.
