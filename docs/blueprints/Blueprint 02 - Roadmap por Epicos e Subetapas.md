# Blueprint 02 - Roadmap por Epicos e Subetapas

## 1. Objetivo deste documento

Este Blueprint organiza a futura construcao de um software de entrega e controle de EPI em epicos e subetapas pequenas, revisaveis e seguras para execucao no Cursor.

Nesta fase, o documento e apenas planejamento documental. Nenhuma subetapa deve ser enviada ao Cursor como implementacao sem antes definir stack, repositorio, ambiente e padrao operacional do projeto.

## 2. Regra de avancar

Cada subetapa futura deve:

- ter objetivo unico;
- preservar o que ja estiver validado;
- gerar commit separado;
- incluir testes proporcionais;
- nao misturar cadastro, entrega, estoque, biometria, offline e integracoes no mesmo passo;
- terminar com resposta padronizada do Cursor.

## 3. Ordem recomendada dos epicos

1. Fundacao do produto.
2. Cadastros mestres.
3. Ficha eletronica e entrega simples.
4. Estoque e lotes.
5. Assinatura, termo e biometria.
6. Devolucao, troca e pendencias.
7. Planejamento, alertas e aprovacoes.
8. Relatorios e auditoria.
9. App mobile e operacao offline.
10. Importacoes e integracoes.
11. Segurança, LGPD e hardening operacional.

## 4. Epico 01 - Fundacao do produto

### Objetivo

Criar a base minima para um sistema multiusuario, auditavel e preparado para modulos de entrega de EPI.

### Subetapa 01.1 - Definicao de stack e arquitetura inicial

Entregas:

- decisao de stack;
- padrao de monorepo ou repositorio unico;
- definicao de web, API, banco e possivel app;
- padrao de autenticacao;
- estrategia de deploy.

Criterio de conclusao:

- projeto tem base tecnica clara antes do primeiro codigo.

### Subetapa 01.2 - Bootstrap do projeto

Entregas:

- estrutura inicial;
- configuracao de ambiente;
- healthcheck;
- scripts de build/teste;
- README inicial.

Criterio de conclusao:

- projeto sobe localmente e possui validacao minima automatizada.

### Subetapa 01.3 - Autenticacao e perfis

Entregas:

- login;
- usuarios;
- perfis basicos;
- sessao;
- protecao de rotas.

Criterio de conclusao:

- usuario autenticado acessa area interna e perfil limita acoes.

## 5. Epico 02 - Cadastros mestres

### Objetivo

Criar a base de dados operacional: empresas/unidades, trabalhadores, EPIs e estrutura de cargos/areas.

### Subetapa 02.1 - Empresas, unidades e areas

Entregas:

- cadastro de empresa;
- unidades;
- setores/areas;
- perfis por unidade, se aplicavel.

Criterio de conclusao:

- sistema permite organizar dados por unidade e area.

### Subetapa 02.2 - Trabalhadores

Entregas:

- cadastro de trabalhador;
- status;
- unidade/area/cargo;
- busca e listagem;
- historico basico.

Criterio de conclusao:

- trabalhador pode ser cadastrado e encontrado para entrega futura.

### Subetapa 02.3 - Catalogo de EPIs

Entregas:

- cadastro de EPI;
- categoria;
- CA;
- validade;
- vida util;
- caracteristicas;
- status.

Criterio de conclusao:

- gestor consegue cadastrar EPIs ativos para entrega.

### Subetapa 02.4 - Regras de EPI por cargo, area ou grupo

Entregas:

- vinculo EPI x cargo;
- vinculo EPI x area;
- grupo de entrega;
- regra de aplicabilidade.

Criterio de conclusao:

- sistema consegue sugerir ou validar EPIs adequados ao trabalhador.

## 6. Epico 03 - Ficha eletronica e entrega simples

### Objetivo

Criar o fluxo central do produto: registrar entrega de EPI e montar ficha eletronica auditavel.

### Subetapa 03.1 - Modelo de ficha eletronica

Entregas:

- entidade de ficha ou eventos de entrega;
- historico por trabalhador;
- dados imutaveis do evento;
- consulta da ficha.

Criterio de conclusao:

- cada trabalhador possui historico de eventos de EPI.

### Subetapa 03.2 - Entrega simples sem estoque

Entregas:

- selecionar trabalhador;
- selecionar EPI;
- registrar entrega;
- escolher metodo de confirmacao simples;
- atualizar ficha.

Criterio de conclusao:

- entrega basica gera registro auditavel.

### Subetapa 03.3 - Cancelamento ou correcao auditada

Entregas:

- cancelamento com motivo;
- evento de ajuste;
- preservacao de historico;
- permissao restrita.

Criterio de conclusao:

- erro operacional pode ser corrigido sem apagar trilha.

## 7. Epico 04 - Estoque, lotes e movimentacoes

### Objetivo

Vincular entregas ao controle real de saldo, lote, validade e local de armazenamento.

### Subetapa 04.1 - Estoque basico

Entregas:

- cadastro de local de estoque;
- entrada manual;
- saldo por EPI;
- movimentacoes.

Criterio de conclusao:

- gestor enxerga saldo disponivel por EPI.

### Subetapa 04.2 - Lotes, validade e CA no estoque

Entregas:

- lote;
- validade;
- CA por item/lote quando aplicavel;
- alerta de vencimento.

Criterio de conclusao:

- entrega pode considerar lote e validade.

### Subetapa 04.3 - Baixa automatica na entrega

Entregas:

- validacao de saldo;
- baixa apos entrega;
- reversao em cancelamento;
- relatorio de movimentacoes.

Criterio de conclusao:

- entrega confirmada altera estoque corretamente.

### Subetapa 04.4 - Transferencia e estoque em transito

Entregas:

- transferencia entre locais;
- recebimento de transferencia;
- status em transito;
- historico.

Criterio de conclusao:

- saldo em transito nao aparece como disponivel para entrega local.

## 8. Epico 05 - Assinatura, termo e biometria

### Objetivo

Fortalecer a comprovacao da entrega com meios de autenticacao e consentimento/autorizacao.

### Subetapa 05.1 - Termo de autorizacao

Entregas:

- modelo de termo;
- versionamento;
- aceite do trabalhador;
- consulta de aceite.

Criterio de conclusao:

- sistema sabe qual termo foi aceito e quando.

### Subetapa 05.2 - Assinatura por senha ou codigo

Entregas:

- metodo de confirmacao simples;
- registro de evidencia;
- validacao na entrega.

Criterio de conclusao:

- trabalhador confirma entrega sem papel.

### Subetapa 05.3 - Cadastro facial

Entregas:

- fluxo de cadastro facial;
- status do cadastro;
- auditoria;
- bloqueio se nao houver termo, quando configurado.

Criterio de conclusao:

- trabalhador fica apto ou inapto para entrega por face.

### Subetapa 05.4 - Entrega por biometria facial

Entregas:

- selecao do metodo facial;
- verificacao de rosto cadastrado;
- validacao facial via tecnologia definida;
- conclusao ou rejeicao;
- evidencia segura.

Criterio de conclusao:

- entrega so conclui com validacao facial aprovada ou excecao autorizada.

## 9. Epico 06 - Devolucao, troca e pendencias

### Objetivo

Controlar ciclo de vida do EPI apos entrega.

### Subetapa 06.1 - Devolucao simples

Entregas:

- registrar devolucao;
- classificar estado;
- definir destino;
- atualizar ficha.

Criterio de conclusao:

- ficha mostra EPI devolvido e destino.

### Subetapa 06.2 - Troca com devolucao obrigatoria

Entregas:

- identificar EPI anterior;
- exigir devolucao;
- permitir justificativa de nao devolucao;
- gerar pendencia.

Criterio de conclusao:

- troca nao perde controle do item anterior.

### Subetapa 06.3 - Pendencias e bloqueios

Entregas:

- lista de pendencias;
- bloqueio configuravel;
- baixa de pendencia;
- relatorio.

Criterio de conclusao:

- gestor consegue cobrar e resolver pendencias.

## 10. Epico 07 - Planejamento, alertas e aprovacoes

### Objetivo

Antecipar entregas e controlar excecoes.

### Subetapa 07.1 - Proxima troca por vida util

Entregas:

- calculo de proxima troca;
- painel de proximas entregas;
- alerta.

Criterio de conclusao:

- gestor sabe quem precisa trocar EPI em breve.

### Subetapa 07.2 - Bloqueio ou alerta de maxima antecipacao

Entregas:

- regra de antecipacao;
- alerta;
- bloqueio;
- excecao autorizada.

Criterio de conclusao:

- sistema evita troca cedo demais quando configurado.

### Subetapa 07.3 - Requisicoes e aprovacoes

Entregas:

- solicitacao individual;
- solicitacao por lideranca;
- aprovacao;
- recusa com motivo;
- reserva de estoque.

Criterio de conclusao:

- entrega pode nascer de uma requisicao aprovada.

### Subetapa 07.4 - Entrega planejada por grupos

Entregas:

- grupos de entrega;
- lista de trabalhadores;
- planejamento de entrega coletiva;
- controle de status individual.

Criterio de conclusao:

- gestor consegue preparar entregas em massa sem perder rastreabilidade individual.

## 11. Epico 08 - Relatorios e auditoria

### Objetivo

Dar visibilidade gerencial e evidencias de conformidade.

### Subetapa 08.1 - Relatorio de entregas

Entregas:

- filtros;
- exportacao;
- dados de trabalhador, EPI, data, metodo e responsavel.

Criterio de conclusao:

- gestor responde quem recebeu o que e quando.

### Subetapa 08.2 - Relatorio de estoque

Entregas:

- saldo;
- lote;
- vencimento;
- movimentacoes;
- estoque baixo.

Criterio de conclusao:

- gestor identifica necessidade de reposicao.

### Subetapa 08.3 - Relatorio de pendencias e devolucoes

Entregas:

- pendencias por trabalhador;
- devolucoes atrasadas;
- perdas/extravios;
- exportacao.

Criterio de conclusao:

- gestor acompanha itens nao devolvidos.

### Subetapa 08.4 - Trilha de auditoria

Entregas:

- log de eventos sensiveis;
- filtros;
- consulta por usuario e entidade;
- protecao contra alteracao.

Criterio de conclusao:

- alteracoes relevantes sao rastreaveis.

## 12. Epico 09 - App mobile e offline

### Objetivo

Permitir entrega em campo via aplicativo, inclusive sem conexao.

### Subetapa 09.1 - App para entrega online

Entregas:

- login;
- busca de trabalhador;
- selecao de EPI;
- confirmacao;
- sincronizacao online.

Criterio de conclusao:

- entrega pode ser feita pelo celular com internet.

### Subetapa 09.2 - Pacote offline

Entregas:

- selecao de dados para offline;
- armazenamento local seguro;
- controle de validade do pacote.

Criterio de conclusao:

- app possui dados minimos antes de sair a campo.

### Subetapa 09.3 - Entrega offline

Entregas:

- registro local;
- fila de sincronizacao;
- status pendente;
- tratamento de erro.

Criterio de conclusao:

- entrega sem internet e sincronizada depois.

### Subetapa 09.4 - Resolucao de conflitos

Entregas:

- deteccao de duplicidade;
- conflito de saldo;
- revisao manual;
- auditoria.

Criterio de conclusao:

- sincronizacao offline nao corrompe estoque nem ficha.

## 13. Epico 10 - Importacoes e integracoes

### Objetivo

Reduzir trabalho manual e conectar o software a sistemas corporativos.

### Subetapa 10.1 - Importacao por Excel

Entregas:

- layout de planilha;
- validacao;
- pre-visualizacao;
- relatorio de erros.

Criterio de conclusao:

- cadastros podem ser carregados em massa.

### Subetapa 10.2 - API de trabalhadores e EPIs

Entregas:

- endpoints autenticados;
- chaves externas;
- idempotencia;
- documentacao.

Criterio de conclusao:

- outro sistema pode sincronizar cadastros.

### Subetapa 10.3 - API de eventos de entrega

Entregas:

- consulta de entregas;
- envio de eventos para ERP/RH;
- webhooks;
- reprocessamento.

Criterio de conclusao:

- entrega pode alimentar sistemas externos.

## 14. Epico 11 - Segurança, LGPD e operacao

### Objetivo

Endurecer o produto para uso real com dados sensiveis e evidencias legais.

### Subetapa 11.1 - Controle de acesso granular

Entregas:

- perfis;
- permissoes por unidade;
- restricao de dados sensiveis.

Criterio de conclusao:

- usuario ve apenas o que deve ver.

### Subetapa 11.2 - Politica de dados biometricos

Entregas:

- regras de armazenamento;
- mascaramento;
- exclusao ou inativacao;
- logs seguros.

Criterio de conclusao:

- biometria e tratada como dado sensivel.

### Subetapa 11.3 - Backups, exportacao e retencao

Entregas:

- politica de backup;
- retencao;
- exportacao de evidencias;
- restauracao testada.

Criterio de conclusao:

- dados criticos podem ser recuperados e auditados.

## 15. Marcos de produto

### Marco 01 - MVP de ficha e entrega digital

Inclui:

- usuarios;
- trabalhadores;
- catalogo de EPI;
- entrega simples;
- ficha eletronica;
- relatorio basico.

Valor:

- substitui papel em fluxo controlado.

### Marco 02 - Controle operacional com estoque

Inclui:

- estoque;
- lotes;
- baixa automatica;
- relatorios de estoque;
- pendencias simples.

Valor:

- conecta entrega ao saldo real.

### Marco 03 - Conformidade reforcada

Inclui:

- termo;
- assinatura;
- biometria facial;
- auditoria;
- exportacoes.

Valor:

- fortalece evidencia e rastreabilidade.

### Marco 04 - Operacao avancada

Inclui:

- aprovacoes;
- planejamento;
- offline;
- integracoes.

Valor:

- atende campo, escala e processos corporativos.

