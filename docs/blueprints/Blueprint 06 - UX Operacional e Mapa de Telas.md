# Blueprint 06 - UX Operacional e Mapa de Telas

## 1. Objetivo

Definir as telas e fluxos operacionais esperados para a plataforma de gestao digital de entrega de EPI.

Este documento orienta produto e frontend, mas ainda nao e um design final.

## 2. Principio de UX

O produto e uma ferramenta operacional. A interface deve ser clara, rapida e confiavel, com foco em:

- localizar trabalhador rapidamente;
- concluir entrega com poucos passos;
- evitar erro de EPI, tamanho, lote ou trabalhador;
- mostrar alertas e bloqueios sem confundir o operador;
- permitir auditoria sem depender de suporte tecnico.

## 3. Navegacao inicial

Menu recomendado:

- Dashboard;
- Entregas;
- Trabalhadores;
- EPIs;
- Estoque;
- Solicitacoes;
- Devolucoes e Pendencias;
- Treinamentos;
- Relatorios;
- Configuracoes;
- Auditoria.

No MVP, usar apenas:

- Dashboard;
- Trabalhadores;
- EPIs;
- Estoque;
- Entregas;
- Relatorios;
- Configuracoes.

## 4. Tela de Dashboard

Objetivo:
Dar visao rapida da operacao.

Componentes:

- entregas hoje;
- EPIs proximos de vencimento;
- trabalhadores com pendencias;
- estoque abaixo do minimo;
- proximas trocas;
- falhas de sincronizacao, quando houver offline;
- atalhos para nova entrega e novo trabalhador.

## 5. Tela de Trabalhadores

Objetivo:
Gerenciar pessoas aptas a receber EPI.

Estados:

- lista vazia;
- busca sem resultado;
- carregando;
- erro;
- trabalhador inativo;
- trabalhador com pendencia.

Campos visiveis:

- nome;
- matricula/documento;
- unidade;
- area;
- cargo;
- status;
- pendencias;
- status biometrico.

Acoes:

- cadastrar;
- editar;
- ver ficha;
- registrar consentimento;
- cadastrar biometria futura.

## 6. Tela de EPIs

Objetivo:
Gerenciar catalogo/book de EPI.

Campos:

- nome;
- categoria;
- CA;
- validade do CA;
- vida util;
- variacoes;
- status.

Acoes:

- cadastrar;
- editar;
- inativar;
- ver estoque;
- ver regras por cargo/area.

## 7. Tela de Estoque

Objetivo:
Controlar saldo e movimentacoes.

Visoes:

- saldo por EPI;
- saldo por unidade/local;
- lotes;
- vencimentos;
- movimentacoes;
- estoque baixo.

Acoes:

- entrada;
- ajuste auditado;
- transferencia futura;
- descarte;
- exportar.

## 8. Tela de Nova Entrega

Objetivo:
Permitir entrega rapida e segura.

Fluxo ideal:

1. selecionar trabalhador;
2. sistema mostra EPIs sugeridos/pendentes;
3. operador seleciona EPI, tamanho e lote;
4. sistema valida estoque, CA, prazo e regra;
5. operador escolhe metodo de confirmacao;
6. trabalhador confirma;
7. sistema conclui entrega, baixa estoque e atualiza ficha.

Estados importantes:

- trabalhador nao encontrado;
- trabalhador inativo;
- EPI nao permitido para cargo/area;
- sem estoque;
- CA vencido;
- troca antecipada;
- biometria nao cadastrada;
- confirmacao recusada;
- entrega concluida.

## 9. Tela de Ficha Eletronica

Objetivo:
Mostrar historico completo do trabalhador.

Conteudo:

- dados do trabalhador;
- EPIs em posse;
- entregas anteriores;
- devolucoes;
- pendencias;
- evidencias;
- responsaveis;
- exportar PDF.

Regras:

- nao permitir edicao direta de evento historico;
- cancelamento/ajuste deve ser acao separada com motivo.

## 10. Tela de Solicitacoes

Objetivo:
Atender fluxo gestor -> aprovacao -> reserva -> entrega.

Estados:

- rascunho;
- enviada;
- aprovada;
- recusada;
- reservada;
- parcialmente atendida;
- concluida;
- cancelada.

Pode ficar fora do MVP inicial.

## 11. Tela de Relatorios

Relatorios esperados:

- entregas por periodo;
- ficha por trabalhador;
- EPIs vencidos/proximos de vencimento;
- estoque;
- pendencias;
- movimentacoes;
- uso por area/cargo;
- auditoria.

## 12. Tela de Configuracoes

Configuracoes:

- empresa;
- unidades;
- areas;
- cargos;
- perfis de acesso;
- metodos de assinatura;
- regras de bloqueio;
- termos e consentimentos;
- integracoes futuras.

## 13. App mobile futuro

O app deve priorizar:

- nova entrega;
- busca de trabalhador;
- leitura/camera;
- assinatura/biometria;
- modo offline;
- fila de sincronizacao;
- consulta rapida de pendencias.

Nao deve carregar toda a administracao no app inicialmente.

