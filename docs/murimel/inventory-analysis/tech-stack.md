# Stack e acesso a dados observados

Murimel: fontes PRG Windows-1252, xHarbour/Harbour e MiniGUI Windows.
Acesso MySQL via TMySQLServer em EasyControl.Prg:368 e SelectDB:490/519;
Query/GetRow/FieldGet nos modulos. Versoes do banco/driver, engine,
collation, tipos e constraints reais ainda nao verificados.

Ha conexao primaria e caminho secundario condicional; Easy100.prg:868
tambem pode escrever clientes por iServer. Isso nao comprova sincronismo,
completude ou qual base e oficial. Nenhum argumento de conexao e reproduzido.

Relatorios dependem de impressao/COM Windows (fly2pdf); nao e necessario
executa-los para ler seus SELECT. Binarios, DLLs e arquivos DBF existentes
nao foram usados como prova de dados comerciais atuais.

Destino: build.gradle declara Java 21, Spring Boot 4.1.2, plugin dependency
management 1.1.7, starters webmvc/JDBC/Flyway/security/validation/data-mongodb,
driver PostgreSQL e springdoc 3.2.0. Gradle wrapper existente.
Flyway V1-V5 define a parte relacional; usuarios permanecem no MongoDB.
Sem instalacao, upgrade ou mudanca de stack nesta entrega.

Complemento de acesso: login desktop e por codigo de vendedor/credencial
(`EasyControl.Prg:546`). Cadastro de masters separado (`EasySenha.Prg:181`).
Destino atual autentica por email com BCryptPasswordEncoder(12), configurado
em SecurityConfiguration; AuthService normaliza email e UserAccount guarda
passwordHash no MongoDB. O arquivo de analise nao reproduz literais de
credenciais. Nenhuma conexao, conta ou sessao foi transferida.
