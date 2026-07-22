# Blueprint 04 - Modelo de Dados e Fronteiras de Dominio

## 1. Objetivo

Definir o modelo de dominio inicial para uma plataforma de gestao digital de entrega de EPI, separando entidades persistentes, responsabilidades e fronteiras entre modulos.

Este documento ainda nao e schema definitivo. Ele orienta a primeira modelagem e evita acoplamento prematuro.

## 2. Dominios principais

### Organizacao e tenancy

Responsavel por separar dados da empresa usuaria do software (tenant) e sua estrutura comercial/operacional.

Entidades:

- `Organization` (tenant / empresa usuaria que assina o software);
- `ServedClient` (cliente atendido pela empresa usuaria, normalmente com CNPJ);
- `LifeFranchise` ou campos de franquia na `Organization` (vidas contratadas);
- `ClientLifeQuota` (cota de vidas alocada a um cliente atendido);
- `Unit` (unidade operacional: filial, obra, almoxarifado);
- `Area`;
- `CostCenter`;
- `Role`;
- `User`;
- `Membership`.

Regras:

- `Organization`, `ServedClient` e `Unit` sao entidades distintas e nao devem ser colapsadas;
- toda entidade operacional deve pertencer a uma organizacao (tenant);
- cliente atendido pertence ao tenant e recebe cota de vidas da franquia total;
- unidade e area sao estrutura operacional e devem ser preservadas nos eventos historicos;
- usuario nao pode acessar dados de outra organizacao sem permissao explicita;
- o sistema deve controlar vidas contratadas, alocadas, usadas e disponiveis.

### Trabalhadores

Responsavel pela base de pessoas que recebem EPI.

Entidades:

- `Worker`;
- `WorkerProfile`;
- `WorkerAreaHistory`;
- `WorkerIdentifier`;
- `ConsentTerm`;
- `WorkerConsent`.

Regras:

- trabalhador deve estar vinculado a um cliente atendido (`ServedClient`);
- vida = trabalhador ativo vinculado a um cliente atendido;
- trabalhador ativo consome cota do cliente e franquia do tenant;
- trabalhador pode estar ativo, afastado, inativo, desligado ou terceiro;
- dados de tamanho/numeracao devem apoiar entrega correta;
- alteracao de area nao deve alterar entregas antigas;
- consentimentos devem ser versionados.

### Catalogo de EPI

Responsavel pela definicao dos equipamentos.

Entidades:

- `Epi`;
- `EpiVariant`;
- `EpiCategory`;
- `CertificateCA`;
- `EpiRequirementRule`;
- `EpiDocument`.

Regras:

- EPI inativo nao deve ser entregue em fluxo comum;
- validade de CA deve gerar alerta ou bloqueio conforme configuracao;
- historico de entrega deve preservar dados essenciais do EPI no momento da entrega.

### Estoque

Responsavel por saldo, lote, movimentacao e disponibilidade.

Entidades:

- `StockLocation`;
- `StockLot`;
- `StockBalance`;
- `StockMovement`;
- `StockReservation`;

Regras:

- estoque disponivel deve excluir saldo reservado e em transito;
- entrega confirmada gera movimento de saida;
- cancelamento gera movimento compensatorio, nao apagamento;
- devolucao pode ir para disponivel, quarentena ou descarte.

### Entrega e ficha eletronica

Responsavel pelo evento central de fornecimento ao trabalhador.

Entidades:

- `Delivery`;
- `DeliveryItem`;
- `DeliveryEvidence`;
- `EpiSheetEvent`;
- `DeliveryCancellation`;

Regras:

- entrega concluida deve gerar evento de ficha;
- evento de ficha deve ser imutavel na pratica;
- erro deve ser tratado por cancelamento ou ajuste auditado;
- entrega deve registrar responsavel, trabalhador, EPI, data, metodo e local.

### Assinatura e biometria

Responsavel por evidencias de confirmacao.

Entidades:

- `AuthEvidence`;
- `BiometricEnrollment`;
- `BiometricVerificationAttempt`;
- `SignatureMethod`;
- `Device`;

Regras:

- biometria e dado sensivel;
- evitar armazenar imagem facial bruta como evidencia principal;
- preferir referencia segura, template ou hash, conforme fornecedor;
- validacao facial deve ser adapter externo;
- falhas e excecoes devem ser auditadas.

### Solicitacoes e aprovacoes

Responsavel pelo fluxo corporativo anterior a entrega.

Entidades:

- `EpiRequest`;
- `EpiRequestItem`;
- `Approval`;
- `RejectionReason`;
- `ReservationLink`;
- `ExternalRequisitionRef`.

Regras:

- solicitacao aprovada pode reservar estoque;
- recusa deve exigir motivo;
- integracao ERP/HCM deve usar referencia externa, sem comandar o dominio interno diretamente.

### Treinamentos e documentos

Responsavel por pre-requisitos de uso e validade documental.

Entidades:

- `Training`;
- `TrainingClass`;
- `TrainingAttendance`;
- `TrainingRequirement`;
- `WorkerDocument`;
- `CompanyDocument`.

Regras:

- treinamento vencido pode alertar ou bloquear entrega;
- regra de bloqueio deve ser configuravel.

### Integracoes

Responsavel pela comunicacao com ERP, HCM, eSocial e sistemas externos.

Entidades:

- `IntegrationProvider`;
- `ExternalMapping`;
- `IntegrationEvent`;
- `WebhookDelivery`;
- `ImportJob`;
- `ImportJobRow`;

Regras:

- eventos devem ser idempotentes;
- falhas precisam ser reprocessaveis;
- segredos nao devem entrar em logs;
- integracao nao deve quebrar entrega ja confirmada.

## 3. Eventos de dominio importantes

- `WorkerCreated`;
- `WorkerAreaChanged`;
- `WorkerActivated`;
- `WorkerDeactivated`;
- `ServedClientCreated`;
- `LifeQuotaAllocated`;
- `LifeQuotaExceeded`;
- `EpiCreated`;
- `StockReceived`;
- `StockReserved`;
- `DeliveryCreated`;
- `DeliveryConfirmed`;
- `DeliveryCancelled`;
- `DeliveryReturned`;
- `BiometricEnrollmentCreated`;
- `BiometricVerificationFailed`;
- `ConsentAccepted`;
- `RequestApproved`;
- `RequestRejected`;
- `IntegrationEventFailed`.

## 4. Fronteiras que nao devem ser misturadas

- Cadastro de EPI nao deve alterar estoque automaticamente, exceto em importacao explicitamente desenhada.
- Entrega nao deve depender diretamente de ERP; deve depender do dominio interno e registrar evento para integracao posterior.
- Biometria nao deve ficar espalhada no dominio de entrega; deve ser modulo/adaptador.
- Relatorio nao deve virar fonte de verdade; fonte de verdade sao eventos, estoque e ficha.
- App offline nao deve escrever direto no banco sem camada de sincronizacao idempotente.
- Tenant (`Organization`), cliente atendido (`ServedClient`) e unidade operacional (`Unit`) nao sao a mesma entidade.
- Franquia total de vidas pertence ao tenant; cotas sao distribuicao dessa franquia entre clientes atendidos.
- Vida nao e sinônimo de usuario autenticado; vida e trabalhador ativo do cliente atendido.

## 5. Modelo minimo para MVP

Para a primeira versao funcional, priorizar:

- `Organization`;
- `ServedClient`;
- controle de franquia/cotas de vidas (contratadas, alocadas, usadas, disponiveis);
- `User`;
- `Membership`;
- `Unit`;
- `Area`;
- `Worker`;
- `Epi`;
- `EpiVariant`;
- `CertificateCA`;
- `StockLocation`;
- `StockLot`;
- `StockBalance`;
- `StockMovement`;
- `Delivery`;
- `DeliveryItem`;
- `AuthEvidence`;
- `EpiSheetEvent`;
- `AuditLog`.

## 6. Decisoes pendentes

- Se trabalhador sera usuario autenticado no MVP ou apenas entidade operacional.
- Se biometria facial entra no MVP real ou via adapter mockado primeiro.
- Se estoque sera obrigatorio para toda entrega no MVP.
- Se ficha sera materializada em tabela propria ou derivada de eventos.
- Se assinatura PDF tera qualificacao ICP-Brasil ou apenas evidencia eletronica operacional na fase inicial.
- Em que subetapa entra o bloqueio automatico ao exceder cota/franquia versus alerta apenas.
- Se unidade operacional pode atender mais de um cliente atendido ou fica sempre 1:1 operacionalmente.

