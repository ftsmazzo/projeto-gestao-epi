# Blueprint 03 - Criterios de Aceite e Revisao por Entrega

## 1. Objetivo deste documento

Este Blueprint define criterios para revisar futuras entregas do Cursor em um projeto de software de entrega e controle de EPI.

Ele existe para impedir que uma subetapa seja considerada concluida apenas porque telas foram criadas ou o build passou. Neste dominio, uma entrega precisa preservar rastreabilidade, estoque, evidencias, permissoes e dados sensiveis.

## 2. Estados possiveis da entrega

- Aprovada para deploy.
- Aprovada com observacao.
- Requer ajuste antes de deploy.
- Reprovada por quebra de escopo.
- Reprovada por risco de dados ou seguranca.
- Reprovada por falha de build, teste ou migration.
- Reprovada por risco operacional de estoque/ficha.

## 3. Regra principal de revisao

Toda entrega deve responder:

- O escopo autorizado foi cumprido sem antecipar modulos futuros?
- Fluxos ja validados continuam funcionando?
- A entrega preserva historico e rastreabilidade?
- A entrega respeita permissoes por empresa, unidade e perfil?
- Dados sensiveis, especialmente biometricos, foram protegidos?
- Estoque, ficha e eventos estao consistentes?
- Migrations, se houver, sao coerentes com o schema e com producao?
- O usuario consegue testar manualmente de forma objetiva?

Se qualquer resposta critica for negativa, a entrega nao deve ir para deploy.

## 4. Checklist de escopo

Verificar:

- Cursor executou apenas a subetapa solicitada;
- nao implementou biometria antes do modulo de termo/cadastro, se isso estava fora do escopo;
- nao implementou app offline junto com entrega simples;
- nao criou integracao externa sem autorizacao;
- nao alterou regras de estoque em subetapa que nao envolvia estoque;
- nao mudou estrutura geral do projeto sem necessidade;
- nao removeu validacoes existentes.

Reprovar por quebra de escopo quando:

- o Cursor adiciona modulo grande nao solicitado;
- mistura cadastro, entrega, estoque, relatorio e biometria em um unico commit;
- muda stack ou arquitetura sem aprovacao;
- cria automacoes que afetam dados reais sem criterio.

## 5. Checklist de ficha eletronica

Verificar:

- toda entrega gera evento historico;
- evento registra trabalhador, EPI, quantidade, data, responsavel e metodo de confirmacao;
- dados relevantes do EPI no momento da entrega ficam preservados;
- cancelamento nao apaga o evento original sem trilha;
- ficha por trabalhador consolida entregas, devolucoes e pendencias;
- exportacao nao omite dados essenciais;
- filtros nao retornam dados de outra empresa ou unidade sem permissao.

Requer ajuste antes de deploy quando:

- ficha funciona, mas faltam dados essenciais no historico;
- cancelamento apaga evento sem registrar motivo;
- exportacao existe, mas nao respeita filtro ou permissao.

## 6. Checklist de estoque

Verificar:

- entrega confirmada baixa estoque;
- entrega cancelada reverte estoque de forma auditada;
- devolucao movimenta estoque corretamente;
- descarte nao volta para saldo disponivel;
- lote e validade sao preservados;
- saldo reservado nao e tratado como disponivel;
- transferencia nao duplica saldo;
- estoque em transito aparece separado;
- operacoes concorrentes nao permitem saldo negativo indevido.

Reprovar por risco operacional quando:

- uma entrega pode ser concluida sem saldo em contexto que exige estoque;
- baixa de estoque ocorre antes da conclusao sem rollback;
- cancelamento duplica saldo;
- sincronizacao offline pode duplicar entrega ou corromper saldo.

## 7. Checklist de biometria e assinatura

Verificar:

- trabalhador sem cadastro facial nao consegue assinar por biometria facial;
- fluxo exige termo/autorizacao quando configurado;
- dado biometrico nao aparece em logs, respostas de API ou exports indevidos;
- tentativas falhas sao auditadas;
- excecao manual exige permissao e justificativa;
- metodo de assinatura fica registrado na entrega;
- assinatura nao pode ser alterada depois da conclusao sem evento de ajuste.

Reprovar por risco de dados ou seguranca quando:

- payload biometrico bruto e salvo ou logado sem protecao;
- qualquer usuario consegue consultar evidencias sensiveis;
- entrega facial conclui mesmo apos falha sem justificativa;
- termo e ignorado apesar de regra exigir autorizacao.

## 8. Checklist de LGPD e dados sensiveis

Verificar:

- dados pessoais sao minimizados;
- dados biometricos sao tratados como sensiveis;
- termos sao versionados;
- revogacao/inativacao possui regra clara;
- exports respeitam permissao;
- logs nao contem documentos, imagens, templates biometricos ou segredos;
- ambientes de teste nao usam dados reais sem cuidado.

Requer ajuste antes de deploy quando:

- falta mascara em campo sensivel;
- endpoint retorna mais dados do que a tela precisa;
- relatorio exporta dado sensivel sem perfil adequado.

Reprovar quando:

- segredo real foi exposto;
- dado biometrico bruto aparece em log ou resposta publica;
- usuario de uma empresa acessa dados de outra.

## 9. Checklist de cadastros mestres

Verificar:

- trabalhador possui unidade, area e status;
- EPI possui status e dados minimos;
- CA e validade sao opcionais ou obrigatorios conforme regra definida;
- alteracao de EPI nao reescreve historico antigo;
- trabalhador inativo nao recebe entrega comum;
- importacao evita duplicidade;
- erro de importacao mostra linha e motivo.

Requer ajuste quando:

- cadastro permite salvar dados incompletos que quebram entrega;
- importacao falha sem indicar registros rejeitados;
- busca/listagem nao filtra por unidade quando necessario.

## 10. Checklist de relatorios

Verificar:

- relatorio de entrega responde quem recebeu, o que recebeu, quando, onde e por qual metodo;
- relatorio de estoque mostra saldo, lote, validade e movimentacoes;
- relatorio de pendencia mostra trabalhador, EPI, motivo e status;
- exportacao respeita filtros;
- dados batem com ficha e estoque;
- usuario sem permissao nao acessa relatorios sensiveis.

Requer ajuste quando:

- relatorio existe, mas diverge da ficha;
- exportacao ignora filtros;
- indicador conta evento cancelado como entrega ativa.

## 11. Checklist de offline

Aplicar apenas quando houver app offline.

Verificar:

- pacote offline tem validade;
- dados locais sao protegidos;
- entrega offline preserva data/hora original;
- sincronizacao e idempotente;
- conflitos sao detectados;
- saldo offline foi reservado ou possui regra de conciliacao;
- falha de sincronizacao fica visivel;
- usuario nao perde eventos pendentes.

Reprovar quando:

- sincronizacao pode duplicar entrega;
- app apaga evento local antes da confirmacao do servidor;
- estoque fica negativo sem fila de resolucao;
- evidencias ficam sem vinculo com entrega.

## 12. Checklist de integracoes

Aplicar quando houver API, ERP, RH, webhooks ou importacoes.

Verificar:

- integracao tem autenticacao;
- eventos sao idempotentes;
- chaves externas sao persistidas;
- falhas ficam registradas;
- existe reprocessamento;
- payload sensivel nao e logado integralmente;
- webhooks validam origem, quando aplicavel.

Requer ajuste quando:

- erro de integracao fica invisivel;
- duplicidade cria trabalhador ou entrega repetida;
- falha parcial nao permite reprocessar.

## 13. Checklist de banco e migrations

Verificar:

- migration existe quando schema mudou;
- migration e reversivel ou possui plano de rollback quando necessario;
- campos obrigatorios possuem estrategia para dados existentes;
- indices existem para buscas importantes;
- constraints protegem integridade;
- enums e status nao quebram dados antigos;
- seed ou dados iniciais nao expostos em producao.

Reprovar por falha de build/migration quando:

- migration nao aplica;
- schema e codigo ficam divergentes;
- alteracao destrutiva apaga dados sem plano;
- build depende de variavel inexistente sem documentacao.

## 14. Checklist de testes obrigatorios

Adaptar comandos ao projeto real. Em geral, exigir:

- typecheck;
- lint, se existir;
- testes unitarios de regras de dominio;
- testes de integracao para entrega/estoque/ficha;
- build;
- teste manual documentado.

Casos minimos por modulo:

- entrega simples cria ficha;
- entrega sem trabalhador valido falha;
- entrega com EPI inativo falha;
- entrega com estoque insuficiente falha, quando estoque estiver ativo;
- cancelamento preserva auditoria;
- devolucao atualiza ficha;
- usuario sem permissao nao acessa dados de outra unidade;
- biometria indisponivel sem cadastro facial;
- importacao rejeita linha invalida.

## 15. Criterios para deploy

Deploy pode ser recomendado quando:

- escopo esta correto;
- build e testes obrigatorios passaram;
- migrations foram revisadas;
- variaveis de ambiente estao documentadas;
- nao ha segredo exposto;
- dados sensiveis estao protegidos;
- fluxo principal foi testado manualmente;
- rollback ou contingencia existe para mudanca critica;
- resposta final do Cursor informa arquivos, testes, pendencias e commit.

Deploy nao deve ser recomendado quando:

- ha risco em schema/migration;
- estoque pode ficar inconsistente;
- ficha eletronica pode perder historico;
- biometria ou assinatura expõe dado sensivel;
- fluxo principal nao foi testado;
- variavel obrigatoria nao foi configurada;
- build ou typecheck falhou.

## 16. Modelo de parecer

Use este formato ao revisar retorno do Cursor:

```markdown
## Parecer
<Aprovada para deploy | Aprovada com observacao | Requer ajuste antes de deploy | Reprovada>

## Motivo
<explicacao objetiva>

## Riscos verificados
- Escopo:
- Ficha eletronica:
- Estoque:
- Biometria/assinatura:
- LGPD/dados sensiveis:
- Banco/migrations:
- Testes:
- Deploy:

## Ajuste necessario
<se houver>

## Proximo passo
<deploy recomendado, prompt corretivo ou proxima subetapa>
```

## 17. Prompt corretivo padrao

Quando uma entrega exigir ajuste, usar estrutura parecida:

```markdown
Leia primeiro:
- README.md
- docs/blueprints/Blueprint 00 - Visao Funcional e Arquitetural do Software de Entrega de EPI.md
- docs/blueprints/Blueprint 01 - Catalogo Rico de Funcoes do Software de Entrega de EPI.md
- docs/blueprints/Blueprint 03 - Criterios de Aceite e Revisao por Entrega.md
- arquivos alterados no ultimo commit

Corrija apenas o problema identificado na revisao:
<descrever problema>

Objetivo:
<resultado esperado>

Regras:
- Nao implementar novo modulo.
- Nao alterar fluxos ja validados.
- Preservar ficha eletronica, estoque, permissoes e auditoria.
- Criar migration apenas se for indispensavel.
- Fazer commit e push.

Testes obrigatorios:
- identificar scripts existentes;
- executar typecheck/build/testes equivalentes;
- testar manualmente o fluxo afetado.

Ao final, responda exatamente:
## Resultado
## Arquivos alterados
## Como testar
## Testes executados
## Pendencias
## Commit
```

