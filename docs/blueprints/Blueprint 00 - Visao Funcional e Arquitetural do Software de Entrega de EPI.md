# Blueprint 00 - Visao Funcional e Arquitetural do Software de Entrega de EPI

## 1. Objetivo deste documento

Este Blueprint consolida, em formato de base tecnica de projeto, as funcoes observadas nos softwares e paginas de referencia sobre entrega digital de EPI, controle de ficha de EPI, biometria facial, estoque, conformidade com NR-06 e rastreabilidade.

Este documento nao e um prompt de implementacao. Ele serve como base para compreender o produto, organizar modulos e preparar futuros epicos no Cursor.

## 2. Fontes consideradas

### Nexus Saude

Referencia: https://www.nexussaude.com.br/entrega-de-epi-por-biometria-facial/

Papel da fonte: referencia conceitual de entrega automatizada de EPI por reconhecimento facial, com verificacao do colaborador, liberacao do equipamento adequado, registro em tempo real, controle de estoque, relatorios e auditoria.

Funcoes observadas:

- identificacao rapida do colaborador por biometria facial;
- verificacao automatica dos dados do colaborador;
- liberacao do EPI adequado conforme funcao e necessidade;
- registro em tempo real da retirada;
- relatorio de quem retirou, qual equipamento retirou e quando;
- apoio a controle de estoque e reposicao;
- foco em conformidade e auditoria.

### SGG

Referencia: https://sgg.net.br/controle-de-epi

Papel da fonte: referencia sintetica de controle de EPI digital aderente a NR-6.

Funcoes observadas:

- ficha eletronica;
- QR Code;
- biometria;
- alertas de validade;
- eliminacao de papel;
- reducao de extravios.

### OnSafety

Referencia: https://atendimento.onsafety.com.br/como-fazer-entrega-de-epi-pela-biometria-facial-no-aplicativo

Papel da fonte: referencia operacional de fluxo mobile para entrega de EPI com biometria facial.

Funcoes observadas:

- menu especifico de Controle de EPI no aplicativo;
- botao para nova entrega;
- selecao do trabalhador;
- selecao do EPI;
- exigencia de rosto previamente cadastrado para assinatura facial;
- salvamento da entrega;
- escolha de metodo de assinatura por biometria facial;
- abertura da camera/dispositivo para reconhecimento do rosto;
- conclusao da entrega a partir da validacao facial.

### EntregaEPI

Referencia: https://entregaepi.com.br/

Papel da fonte: referencia mais ampla de produto SaaS para gestao de EPI com app e web, online/offline, estoque, planejamento, assinatura, biometria, reconhecimento facial, senha, treinamentos, documentos, integracao e painel gerencial.

Funcoes observadas:

- acesso online e offline;
- entrega via aplicativo e site;
- entrega planejada por durabilidade, solicitacoes, grupos de entrega e validade de lote;
- assinatura digital, biometria, reconhecimento facial e senha;
- conformidade com NR-6;
- entrega offline;
- controle de estoque, inclusive estoque em transito;
- controle de entrada e saida por senha de liberacao;
- entrega com reserva ou aprovacao;
- devolucao obrigatoria no momento da troca;
- pendencia quando nao houver devolucao;
- bloqueio ou alerta para solicitacao antes do prazo permitido;
- transferencia ou descarte de EPI quando colaborador muda de area;
- termo de autorizacao para coleta/uso de assinatura, cracha, senha ou biometria;
- solicitacao de troca por funcionario ou lideranca;
- notificacao por uso indevido;
- caracteristicas tecnicas do EPI, como tamanho, cor e numeracao;
- book/catalogo de EPI;
- gestao de documentos;
- gestao de treinamentos;
- estoque por lote, caracteristicas, CA e quantidade;
- importacao via Excel;
- integracao por APIs;
- painel de gestao em tempo real;
- historico de fichas, entregas e pendencias de devolucao;
- seguranca de dados e backup.

### Prisma Informatica

Referencia: https://store.prismainformatica.com.br/produto/entrega-de-epi-

Papel da fonte: referencia comercial de produto de entrega de EPI. A pagina consultada apresentou pouca informacao textual estruturada no conteudo indexavel, portanto ela foi considerada como evidencia fraca para detalhamento funcional.

### NR-06 oficial

Referencia: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/arquivos/normas-regulamentadoras/nr-06-atualizada-2022-1.pdf

Papel da fonte: base regulatoria. A NR-06 admite o registro de fornecimento ao empregado por livros, fichas ou sistema eletronico, inclusive sistema biometrico. Esta documentacao deve ser validada juridicamente antes de producao, mas a premissa funcional e que o sistema deve preservar autenticidade, integridade, rastreabilidade e capacidade de auditoria.

## 3. Contexto consolidado

O software de entrega de EPI deve substituir processos manuais baseados em papel, fichas fisicas, planilhas e controles dispersos por uma plataforma digital com registro confiavel de fornecimento, devolucao, troca e estoque de equipamentos de protecao individual.

O produto deve atender tres necessidades centrais:

- garantir que o trabalhador receba o EPI correto, no momento correto e com comprovacao adequada;
- permitir que a empresa controle estoque, validade, lotes, CA, trocas, devolucoes e pendencias;
- produzir evidencias auditaveis de conformidade com NR-06, LGPD, politicas internas e fiscalizacoes.

## 4. Publicos principais

### Gestor de seguranca do trabalho

Responsavel por configurar EPIs, regras de entrega, validade, troca, obrigatoriedade por cargo/area, documentos, treinamentos e relatorios.

### Almoxarifado ou responsavel por entrega

Responsavel por separar, entregar, registrar, colher assinatura/biometria, controlar entrada/saida e lidar com devolucoes.

### Trabalhador ou colaborador

Recebe o EPI, assina ou valida biometricamente a entrega, solicita troca quando permitido e pode consultar pendencias ou historico, conforme politica da empresa.

### Lideranca operacional

Pode solicitar trocas, aprovar requisicoes, acompanhar pendencias da equipe e validar excecoes.

### Administrador da empresa

Gerencia usuarios, permissoes, unidades, integracoes, parametros globais, importacoes e auditoria.

### Auditor interno, fiscalizacao ou juridico

Consulta evidencias, fichas, historico, logs, assinaturas, relatorios e trilhas de conformidade.

## 5. Principios do produto

- Rastreabilidade completa: toda entrega deve responder quem entregou, quem recebeu, qual EPI, qual lote/CA, quando, onde, por qual metodo e sob qual regra.
- Conformidade operacional: a plataforma deve apoiar NR-06, sem prometer automaticamente validade juridica sem configuracao, evidencias e politica adequadas.
- Menos papel: fichas eletronicas devem substituir documentos fisicos sempre que juridicamente e operacionalmente permitido.
- Controle de estoque acoplado ao evento: entrega, devolucao, descarte, transferencia e reserva devem refletir no estoque.
- Identidade forte: assinatura, senha, QR Code, cracha e biometria devem ser meios configuraveis de confirmacao.
- Operacao mobile e offline: a entrega deve funcionar em campo, com sincronizacao posterior quando nao houver internet.
- Escopo incremental: cadastro, ficha, entrega e estoque devem vir antes de automacoes avancadas, IA ou integracoes complexas.

## 6. Modulos principais

### 6.1 Modulo de cadastro organizacional

Responsavel por empresas, unidades, areas, setores, cargos, funcoes, liderancas e permissoes.

Funcoes esperadas:

- cadastro de empresa;
- unidades/filiais;
- setores/areas;
- cargos ou funcoes;
- grupos de entrega;
- usuarios administrativos;
- perfis de acesso;
- regras por unidade ou area.

### 6.2 Modulo de trabalhadores

Responsavel por manter os dados dos colaboradores que recebem EPIs.

Funcoes esperadas:

- cadastro manual de trabalhador;
- importacao por planilha;
- integracao futura com RH/ERP;
- associacao a empresa, unidade, setor e cargo;
- status ativo, afastado, desligado ou terceiro;
- historico de mudanca de area;
- registro de caracteristicas de tamanho, numeracao e preferencias operacionais;
- cadastro de face, digital, senha, cracha ou outro identificador;
- aceite de termo de autorizacao quando houver biometria ou assinatura eletronica.

### 6.3 Modulo de catalogo de EPIs

Responsavel pelo book de EPIs utilizados pela empresa.

Funcoes esperadas:

- cadastro de EPI;
- descricao;
- categoria;
- fabricante;
- fornecedor;
- Certificado de Aprovacao, quando aplicavel;
- validade do CA;
- vida util prevista;
- periodicidade de troca;
- tamanho, cor, numeracao e variacoes;
- instrucoes de uso, higienizacao e conservacao;
- documentos anexos;
- regra de obrigatoriedade por cargo, area, risco ou atividade.

### 6.4 Modulo de estoque

Responsavel por entradas, saldos, lotes, baixas, reservas, transferencias e estoque em transito.

Funcoes esperadas:

- entrada de estoque;
- saida por entrega;
- devolucao;
- descarte;
- transferencia entre almoxarifados ou areas;
- estoque em transito;
- lote;
- validade de lote;
- saldo disponivel;
- saldo reservado;
- minimo de reposicao;
- alerta de vencimento;
- historico de movimentacoes.

### 6.5 Modulo de entrega de EPI

Responsavel pelo fluxo principal do produto.

Funcoes esperadas:

- nova entrega pelo app ou web;
- entrega com requisicao previa;
- entrega sem requisicao;
- entrega planejada por grupo;
- selecao do trabalhador;
- selecao de EPI;
- validacao de permissao de entrega;
- verificacao de estoque;
- verificacao de validade, CA, lote e vida util;
- bloqueio ou alerta para entrega antecipada;
- registro do responsavel pela entrega;
- confirmacao do trabalhador por assinatura, senha, QR Code, cracha, digital ou facial;
- emissao/atualizacao da ficha eletronica;
- baixa automatica no estoque;
- registro de evidencias.

### 6.6 Modulo de biometria e assinatura

Responsavel por metodos de autenticacao do recebimento.

Funcoes esperadas:

- cadastro previo de face;
- validacao facial no momento da entrega;
- assinatura digital/eletronica;
- assinatura por senha;
- assinatura por cracha ou QR Code;
- coleta de evidencias do contexto;
- termo de consentimento ou autorizacao;
- trilha de auditoria;
- bloqueio quando o trabalhador nao possuir biometria cadastrada e a regra exigir esse metodo.

### 6.7 Modulo de solicitacoes e aprovacoes

Responsavel por requisicoes de EPI antes da entrega.

Funcoes esperadas:

- solicitacao individual;
- solicitacao por lideranca;
- solicitacao global por grupo;
- solicitacao de troca nao prevista;
- aprovacao por responsavel;
- reserva de estoque;
- separacao fisica no almoxarifado;
- recusa com motivo obrigatorio;
- acompanhamento por status;
- filtros por periodo, grupo, status e unidade.

### 6.8 Modulo de devolucao, troca e pendencias

Responsavel pelo ciclo de vida apos a entrega.

Funcoes esperadas:

- devolucao obrigatoria no momento da troca;
- registro de nao devolucao;
- pendencia vinculada ao trabalhador;
- troca por vencimento da vida util;
- troca por dano;
- troca por extravio;
- troca por uso indevido;
- descarte;
- transferencia de EPI quando trabalhador muda de area;
- bloqueios configuraveis para novas entregas enquanto houver pendencia.

### 6.9 Modulo de documentos e treinamentos

Responsavel por evidencias complementares do uso correto de EPI.

Funcoes esperadas:

- documentos do trabalhador;
- documentos da empresa;
- validade documental;
- cadastro de treinamentos;
- turmas;
- lista de presenca;
- notas ou avaliacoes;
- feedback;
- vinculo entre treinamento e permissao de retirada de EPI, quando aplicavel.

### 6.10 Modulo de relatorios, indicadores e auditoria

Responsavel por visibilidade gerencial e fiscalizacao.

Funcoes esperadas:

- ficha eletronica por trabalhador;
- historico de entregas;
- relatorio de EPIs vencidos;
- relatorio de entregas por periodo;
- relatorio de pendencias de devolucao;
- relatorio de estoque;
- relatorio de movimentacoes;
- relatorio de uso indevido;
- exportacao para Excel/PDF;
- logs de auditoria;
- consulta de evidencias de assinatura/biometria;
- painel em tempo real.

### 6.11 Modulo de integracoes

Responsavel por sincronizar dados com sistemas externos.

Funcoes esperadas:

- importacao por Excel;
- API para cadastros;
- API para eventos de entrega;
- integracao futura com ERP;
- integracao futura com sistema de RH;
- integracao futura com controle de acesso;
- webhooks para eventos relevantes;
- mapeamento de codigos externos.

## 7. Fluxo operacional principal

1. Administrador cadastra empresa, unidades, setores, cargos e usuarios.
2. Gestor cadastra EPIs, variacoes, CA, vida util, validade, lotes e regras de entrega.
3. Trabalhadores sao cadastrados manualmente, por planilha ou integracao.
4. Trabalhador cadastra face, senha, cracha ou assinatura conforme politica definida.
5. Lideranca, trabalhador ou almoxarifado cria solicitacao, quando houver fluxo de requisicao.
6. Sistema valida se o EPI e permitido para o trabalhador, se ha estoque e se o prazo de troca permite entrega.
7. Almoxarifado separa e entrega o EPI.
8. Trabalhador confirma recebimento por metodo configurado.
9. Sistema registra evento, atualiza ficha eletronica, baixa estoque e guarda evidencias.
10. Sistema agenda proxima troca, monitora validade e gera alertas.
11. Relatorios e fichas ficam disponiveis para gestao, auditoria e fiscalizacao.

## 8. Lacunas materiais identificadas

Estas decisoes ainda mudam a arquitetura futura do produto:

- O produto sera SaaS multiempresa ou sistema interno para uma unica organizacao?
- A biometria facial sera implementada nativamente, por SDK terceiro ou por integracao com fornecedor especializado?
- O app offline sera obrigatorio no MVP ou entrara em fase posterior?
- O estoque sera modulo proprio completo ou apenas reflexo de um ERP externo?
- A assinatura tera objetivo apenas operacional ou exigira assinatura qualificada/ICP-Brasil em PDFs exportados?
- Havera tratamento de terceiros e visitantes desde o inicio?
- O produto precisara integrar com eSocial, RH, ERP ou apenas exportar relatorios?

## 9. Premissas assumidas para esta documentacao

- O produto alvo e uma plataforma digital propria para gestao de entrega de EPI.
- O primeiro escopo deve cobrir ficha eletronica, trabalhador, EPI, estoque basico, entrega e relatorios.
- Biometria facial e funcionalidade importante, mas pode ser modularizada para nao travar o MVP.
- Online/offline e diferencial forte, mas deve ser tratado como epico proprio devido ao risco tecnico.
- Conformidade juridica deve ser desenhada com cautela, preservando evidencias, logs, integridade e consentimento.
- Esta documentacao nao define stack nem arquitetura final de infraestrutura.

## 10. Fora de escopo nesta fase documental

- escolha de linguagem, framework ou banco;
- desenho visual detalhado de telas;
- implementacao de reconhecimento facial;
- contrato definitivo de API;
- parecer juridico sobre validade legal da assinatura;
- integracao real com ERP, RH ou eSocial;
- precificacao;
- plano comercial.

