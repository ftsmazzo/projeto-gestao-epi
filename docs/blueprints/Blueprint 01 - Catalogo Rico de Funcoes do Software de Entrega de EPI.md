# Blueprint 01 - Catalogo Rico de Funcoes do Software de Entrega de EPI

## 1. Objetivo deste documento

Este Blueprint detalha as funcoes que um software moderno de entrega e controle de EPI pode oferecer, a partir da consolidacao das referencias analisadas.

Cada funcao e descrita com objetivo, usuarios envolvidos, comportamento esperado, dados principais, regras, evidencias e criterios de aceite funcionais.

## 2. Classificacao de prioridade

- Essencial: necessario para um MVP util e auditavel.
- Importante: aumenta controle operacional e reduz risco, mas pode vir apos o fluxo principal.
- Avancado: diferencial competitivo, integracao ou automacao de maior complexidade.

## 3. F01 - Cadastro de empresa, unidades e areas

Prioridade: Essencial.

Objetivo:
Permitir que o sistema represente a estrutura operacional onde os EPIs serao entregues, armazenados e auditados.

Usuarios:

- administrador;
- gestor de seguranca;
- responsavel de unidade.

Comportamento esperado:

- cadastrar empresa;
- cadastrar unidades ou filiais;
- cadastrar setores, areas ou centros de custo;
- associar trabalhadores e estoques a unidades;
- permitir regras diferentes por unidade ou area.

Dados principais:

- empresa;
- unidade;
- area;
- setor;
- centro de custo;
- responsavel;
- status.

Regras:

- uma entrega sempre deve estar associada a uma empresa e, preferencialmente, a uma unidade;
- relatorios devem permitir filtro por empresa, unidade e area;
- usuarios devem enxergar apenas dados permitidos pelo perfil.

Criterios de aceite:

- gestor consegue filtrar trabalhadores, EPIs, estoque e entregas por unidade;
- alteracoes estruturais ficam registradas em auditoria;
- area antiga do trabalhador permanece preservada no historico de entregas passadas.

## 4. F02 - Cadastro e gestao de trabalhadores

Prioridade: Essencial.

Objetivo:
Manter a base de pessoas que podem receber EPIs.

Usuarios:

- gestor de seguranca;
- RH;
- administrador;
- almoxarifado.

Comportamento esperado:

- cadastrar trabalhador manualmente;
- importar trabalhadores por planilha;
- associar trabalhador a unidade, area, cargo e grupo;
- indicar status;
- registrar identificadores usados na entrega;
- consultar historico de entregas.

Dados principais:

- nome;
- documento ou matricula;
- cargo;
- unidade;
- area;
- status;
- data de admissao;
- tamanho de EPI;
- numeracao;
- contato;
- identificadores de assinatura.

Regras:

- trabalhador inativo nao deve receber nova entrega sem permissao especial;
- trabalhador sem termo ou biometria cadastrada nao deve assinar por metodo que exija esse cadastro;
- mudanca de area pode disparar revisao dos EPIs em posse.

Criterios de aceite:

- trabalhador pode ser localizado rapidamente na entrega;
- ficha eletronica consolida historico completo;
- sistema diferencia trabalhador ativo, desligado, afastado e terceiro.

## 5. F03 - Cadastro biometrico facial

Prioridade: Importante para produtos com biometria; Essencial se a proposta central for entrega facial.

Objetivo:
Permitir que o trabalhador seja identificado ou confirme recebimento por reconhecimento facial.

Usuarios:

- trabalhador;
- almoxarifado;
- administrador;
- gestor de seguranca.

Comportamento esperado:

- abrir fluxo de cadastro facial;
- capturar imagem ou template biometrico conforme tecnologia escolhida;
- vincular cadastro ao trabalhador;
- registrar aceite do termo de autorizacao;
- bloquear assinatura facial quando o rosto nao estiver cadastrado;
- permitir recadastro com auditoria.

Dados principais:

- trabalhador;
- status do cadastro facial;
- data de cadastro;
- responsavel;
- versao do termo;
- evidencias permitidas;
- status de consentimento/autorizacao.

Regras:

- dado biometrico deve ser tratado como dado sensivel;
- nao exibir nem logar payload biometrico bruto;
- recadastro deve invalidar ou versionar cadastro anterior;
- a entrega por biometria facial so deve estar disponivel quando o trabalhador tiver cadastro valido.

Criterios de aceite:

- sistema informa claramente quando a biometria facial esta indisponivel;
- validacao facial gera evidencia da entrega sem expor dado sensivel;
- auditoria mostra quando e por quem o cadastro foi criado ou atualizado.

## 6. F04 - Catalogo ou Book de EPIs

Prioridade: Essencial.

Objetivo:
Centralizar os equipamentos utilizados pela empresa, suas caracteristicas, variacoes, documentos e regras de entrega.

Usuarios:

- gestor de seguranca;
- almoxarifado;
- administrador.

Comportamento esperado:

- cadastrar EPI;
- definir categoria;
- informar CA, fabricante, fornecedor e validade;
- cadastrar variacoes por tamanho, cor ou numeracao;
- definir vida util e periodicidade de troca;
- anexar orientacoes, documentos ou imagens;
- vincular EPI a cargo, funcao, area ou risco.

Dados principais:

- codigo interno;
- descricao;
- categoria;
- CA;
- validade do CA;
- fabricante;
- fornecedor;
- vida util;
- caracteristicas;
- documentos;
- status.

Regras:

- EPI vencido, bloqueado ou com CA invalido nao deve ser entregue sem excecao autorizada;
- alteracoes no cadastro nao devem reescrever historico de entregas antigas;
- caracteristicas do EPI devem ajudar a entregar tamanho e numeracao corretos.

Criterios de aceite:

- gestor consegue consultar todos os EPIs ativos;
- entrega registra a versao/dados relevantes do EPI no momento do fornecimento;
- sistema alerta sobre validade do CA ou lote, quando configurado.

## 7. F05 - Estoque por lote, quantidade, CA e local

Prioridade: Essencial.

Objetivo:
Controlar disponibilidade de EPIs para evitar entrega sem saldo, desperdicio e falta de reposicao.

Usuarios:

- almoxarifado;
- gestor de seguranca;
- compras;
- administrador.

Comportamento esperado:

- registrar entrada de estoque;
- associar estoque a unidade/local;
- controlar lote;
- controlar validade;
- controlar quantidade disponivel;
- reservar itens;
- baixar itens na entrega;
- devolver ou descartar itens;
- transferir itens;
- consultar historico de movimentacoes.

Dados principais:

- EPI;
- unidade;
- almoxarifado;
- lote;
- validade;
- quantidade;
- quantidade reservada;
- quantidade disponivel;
- motivo da movimentacao.

Regras:

- entrega confirmada deve baixar estoque;
- devolucao pode retornar ao estoque, ir para quarentena ou descarte conforme regra;
- item reservado nao deve ser contado como disponivel para outra entrega;
- estoque em transito deve ser separado de estoque disponivel.

Criterios de aceite:

- saldo muda corretamente apos entrada, reserva, entrega, devolucao e descarte;
- relatorio mostra estoque baixo e itens proximos do vencimento;
- movimentacao possui responsavel, data e motivo.

## 8. F06 - Nova entrega de EPI

Prioridade: Essencial.

Objetivo:
Registrar o fornecimento de EPI ao trabalhador com evidencias suficientes para gestao, auditoria e conformidade.

Usuarios:

- almoxarifado;
- gestor de seguranca;
- trabalhador.

Comportamento esperado:

- iniciar nova entrega pelo app ou web;
- localizar trabalhador;
- selecionar EPI;
- validar se o EPI e aplicavel ao trabalhador;
- validar saldo;
- validar prazo de troca;
- capturar assinatura ou biometria;
- concluir entrega;
- gerar evento na ficha eletronica;
- baixar estoque.

Dados principais:

- trabalhador;
- EPI;
- lote;
- CA;
- quantidade;
- data/hora;
- local;
- responsavel;
- metodo de assinatura;
- evidencias;
- observacoes.

Regras:

- entrega sem confirmacao do trabalhador deve ficar pendente ou recusada, nao concluida;
- entrega antecipada pode gerar alerta, exigir aprovacao ou ser bloqueada;
- entrega deve preservar dados do EPI e trabalhador no momento do evento;
- falha de biometria deve permitir fluxo alternativo apenas se configurado.

Criterios de aceite:

- ficha do trabalhador e atualizada imediatamente apos conclusao;
- estoque e baixado corretamente;
- relatorio mostra quem recebeu, o que recebeu, quando e por qual metodo.

## 9. F07 - Entrega com biometria facial

Prioridade: Importante/Avancado.

Objetivo:
Confirmar a entrega por reconhecimento facial, reduzindo risco de assinatura indevida, papel e contestacao.

Usuarios:

- trabalhador;
- almoxarifado;
- gestor.

Comportamento esperado:

- operador cria entrega;
- sistema verifica se trabalhador possui face cadastrada;
- operador escolhe metodo biometria facial;
- dispositivo abre validacao facial;
- trabalhador posiciona o rosto;
- sistema confirma ou rejeita reconhecimento;
- entrega e assinada/concluida se validacao passar.

Dados principais:

- trabalhador;
- entrega;
- status da validacao;
- data/hora;
- dispositivo;
- versao do mecanismo;
- evidencia segura;
- motivo de falha.

Regras:

- rosto precisa estar cadastrado previamente;
- tentativas falhas devem ser limitadas e auditadas;
- excecao manual deve exigir permissao e justificativa;
- dados biometricos devem seguir politica de seguranca e LGPD.

Criterios de aceite:

- entrega facial indisponivel para trabalhador sem cadastro;
- validacao aprovada conclui a entrega;
- validacao recusada nao conclui entrega sem excecao formal.

## 10. F08 - Entrega online e offline

Prioridade: Importante.

Objetivo:
Permitir entregas em campo, areas remotas ou ambientes sem conectividade constante.

Usuarios:

- almoxarifado;
- tecnico de seguranca;
- equipes de campo.

Comportamento esperado:

- app permite carregar cadastros essenciais antes de sair a campo;
- entregas sao registradas localmente sem internet;
- evidencias ficam pendentes de sincronizacao;
- ao voltar a conexao, eventos sao sincronizados;
- conflitos sao tratados por regra clara.

Dados principais:

- pacote offline;
- trabalhador;
- EPI;
- estoque local;
- entrega;
- evidencias;
- status de sincronizacao;
- conflitos.

Regras:

- sistema deve impedir duplicidade quando sincronizar;
- saldo local precisa ser reservado ou separado para evitar venda/entrega dupla;
- falhas de sincronizacao devem ser visiveis;
- evento offline nao deve ser apagado sem trilha.

Criterios de aceite:

- usuario consegue entregar sem internet;
- sincronizacao posterior preserva data/hora original;
- conflitos geram fila de resolucao.

## 11. F09 - Ficha eletronica de EPI

Prioridade: Essencial.

Objetivo:
Substituir a ficha em papel por historico digital auditavel das entregas, trocas e devolucoes.

Usuarios:

- gestor;
- trabalhador;
- auditor;
- juridico;
- almoxarifado.

Comportamento esperado:

- listar todas as entregas do trabalhador;
- mostrar EPIs atualmente em posse;
- mostrar EPIs devolvidos;
- mostrar pendencias;
- permitir exportacao;
- mostrar evidencias de assinatura;
- permitir filtros por periodo.

Dados principais:

- trabalhador;
- entregas;
- devolucoes;
- assinaturas;
- biometria;
- responsaveis;
- documentos;
- pendencias;
- historico.

Regras:

- ficha nao deve permitir alteracao silenciosa de eventos concluidos;
- correcao deve ocorrer por evento de ajuste ou cancelamento auditado;
- exportacao deve preservar integridade das informacoes.

Criterios de aceite:

- auditor consegue reconstruir o historico do trabalhador;
- exportacao contem dados suficientes para verificacao;
- eventos cancelados continuam rastreaveis.

## 12. F10 - Solicitacao de troca

Prioridade: Importante.

Objetivo:
Permitir que trabalhador ou lideranca solicite troca fora do planejamento automatico.

Usuarios:

- trabalhador;
- lideranca;
- gestor;
- almoxarifado.

Comportamento esperado:

- abrir solicitacao;
- escolher EPI;
- indicar motivo;
- anexar observacao ou foto, se permitido;
- encaminhar para aprovacao quando necessario;
- reservar estoque apos aprovacao;
- concluir troca com devolucao ou pendencia.

Dados principais:

- trabalhador;
- EPI;
- motivo;
- status;
- aprovador;
- entrega original;
- evidencia;
- data.

Regras:

- troca antecipada pode exigir aprovacao;
- falta de devolucao pode gerar pendencia;
- motivo deve ser obrigatorio.

Criterios de aceite:

- solicitacao passa por status claros;
- aprovacao/recusa fica registrada;
- troca concluida atualiza ficha e estoque.

## 13. F11 - Devolucao obrigatoria e pendencia

Prioridade: Importante.

Objetivo:
Controlar quando o trabalhador precisa devolver um EPI no momento da troca e registrar pendencias quando isso nao acontece.

Usuarios:

- almoxarifado;
- trabalhador;
- gestor.

Comportamento esperado:

- identificar EPI anterior em posse;
- exigir devolucao na troca, conforme regra;
- registrar devolucao fisica;
- classificar destino: retorno ao estoque, descarte ou quarentena;
- criar pendencia se nao houver devolucao.

Dados principais:

- EPI devolvido;
- entrega original;
- estado do item;
- destino;
- motivo da nao devolucao;
- pendencia;
- responsavel.

Regras:

- pendencia deve ficar vinculada ao trabalhador;
- novas entregas podem ser bloqueadas quando houver pendencia critica;
- descarte deve gerar movimentacao de estoque.

Criterios de aceite:

- sistema nao perde o vinculo entre entrega original e devolucao;
- pendencia aparece em relatorio;
- ficha mostra o status do EPI entregue anteriormente.

## 14. F12 - Planejamento de entrega e troca

Prioridade: Importante.

Objetivo:
Antecipar necessidades de entrega e troca com base em vida util, validade de lote, grupos e regras de reposicao.

Usuarios:

- gestor;
- almoxarifado;
- compras;
- lideranca.

Comportamento esperado:

- calcular proxima troca;
- gerar alertas de vencimento;
- gerar lista de EPIs a entregar;
- planejar por grupo;
- indicar estoque necessario;
- bloquear solicitacao antes do prazo, se configurado.

Dados principais:

- vida util;
- data da entrega;
- proxima troca;
- grupo;
- estoque;
- validade;
- regra de antecipacao.

Regras:

- prazo permitido pode variar por EPI, area ou funcao;
- antecipacao pode alertar, bloquear ou exigir aprovacao;
- planejamento deve considerar saldo e reserva.

Criterios de aceite:

- gestor visualiza proximas trocas;
- sistema diferencia vencimento de vida util e validade de lote;
- entregas antecipadas seguem regra configurada.

## 15. F13 - Termo de autorizacao e LGPD

Prioridade: Essencial quando houver biometria ou assinatura digital.

Objetivo:
Registrar ciencia/autorizacao do trabalhador para uso de mecanismos de assinatura, cracha, senha ou biometria no processo de entrega.

Usuarios:

- trabalhador;
- juridico;
- gestor;
- administrador.

Comportamento esperado:

- cadastrar modelo de termo;
- versionar termo;
- coletar aceite;
- vincular aceite ao trabalhador;
- impedir metodo sensivel sem termo quando configurado;
- disponibilizar historico.

Dados principais:

- versao do termo;
- trabalhador;
- data de aceite;
- metodo de aceite;
- finalidade;
- status;
- revogacao, quando aplicavel.

Regras:

- termo deve ser versionado;
- aceite antigo nao deve ser sobrescrito;
- dado biometrico deve ter finalidade explicita e controle de acesso.

Criterios de aceite:

- trabalhador possui historico de termos;
- metodo biometrico respeita configuracao de autorizacao;
- auditor consegue verificar qual termo estava vigente.

## 16. F14 - Notificacao por uso indevido

Prioridade: Avancado.

Objetivo:
Registrar ocorrencias de uso indevido de EPI e notificar responsaveis.

Usuarios:

- lideranca;
- gestor de seguranca;
- trabalhador.

Comportamento esperado:

- registrar ocorrencia;
- classificar tipo de uso indevido;
- notificar gestor ou lideranca;
- associar a trabalhador e EPI;
- gerar historico.

Dados principais:

- trabalhador;
- EPI;
- ocorrencia;
- data;
- responsavel;
- acao tomada.

Regras:

- ocorrencias sensiveis devem ter controle de permissao;
- notificacoes devem evitar exposicao desnecessaria.

Criterios de aceite:

- gestor consulta ocorrencias por trabalhador e periodo;
- notificacao possui status de ciencia ou resolucao.

## 17. F15 - Gestao de treinamentos vinculados a EPI

Prioridade: Importante/Avancado.

Objetivo:
Controlar treinamentos necessarios para uso correto de EPIs.

Usuarios:

- gestor;
- instrutor;
- trabalhador;
- lideranca.

Comportamento esperado:

- cadastrar treinamento;
- formar turma;
- registrar presenca;
- registrar nota ou avaliacao;
- vincular treinamento a EPI ou funcao;
- alertar treinamento vencido.

Dados principais:

- treinamento;
- turma;
- trabalhador;
- presenca;
- nota;
- validade;
- EPI vinculado.

Regras:

- EPI critico pode exigir treinamento valido antes da entrega;
- vencimento de treinamento pode gerar alerta ou bloqueio.

Criterios de aceite:

- gestor identifica trabalhadores sem treinamento;
- entrega pode consultar status de capacitacao quando configurado.

## 18. F16 - Relatorios e painel de gestao

Prioridade: Essencial.

Objetivo:
Dar visibilidade em tempo real sobre entregas, estoque, pendencias, vencimentos e conformidade.

Usuarios:

- gestor;
- administrador;
- auditor;
- compras;
- lideranca.

Comportamento esperado:

- painel com indicadores;
- filtros por unidade, area, periodo, EPI e trabalhador;
- exportacao;
- relatorios de entregas;
- relatorios de estoque;
- relatorios de vencimento;
- relatorios de pendencias;
- relatorios de fichas.

Indicadores sugeridos:

- entregas no periodo;
- EPIs mais entregues;
- trabalhadores com pendencia;
- EPIs proximos da troca;
- estoque abaixo do minimo;
- lotes proximos do vencimento;
- entregas por metodo de assinatura;
- tentativas biometricas falhas.

Criterios de aceite:

- gestor consegue responder perguntas operacionais sem acessar banco de dados;
- exportacoes respeitam filtros;
- dados sensiveis aparecem somente para perfis autorizados.

## 19. F17 - Importacao por planilha

Prioridade: Essencial para implantacao.

Objetivo:
Permitir carga inicial e atualizacoes em massa sem depender de integracao tecnica imediata.

Usuarios:

- administrador;
- RH;
- gestor.

Comportamento esperado:

- importar trabalhadores;
- importar EPIs;
- importar estoque;
- validar colunas obrigatorias;
- indicar erros;
- permitir pre-visualizacao;
- evitar duplicidade.

Dados principais:

- arquivo;
- mapeamento;
- registros validos;
- registros rejeitados;
- erros;
- usuario responsavel.

Regras:

- importacao deve ser auditada;
- erros devem ser explicitos por linha;
- duplicidades devem ser tratadas por chave definida.

Criterios de aceite:

- usuario sabe o que foi importado e o que falhou;
- sistema nao cria registros duplicados silenciosamente;
- importacao pode ser revisada posteriormente.

## 20. F18 - APIs e integracoes

Prioridade: Avancado.

Objetivo:
Integrar o software com ERP, RH, estoque corporativo, controle de acesso ou outros sistemas.

Usuarios:

- administrador tecnico;
- integrador;
- time de TI;
- parceiro.

Comportamento esperado:

- expor APIs para consulta e envio de cadastros;
- receber eventos de trabalhadores;
- enviar eventos de entrega;
- sincronizar estoque, quando aplicavel;
- registrar falhas;
- permitir reprocessamento.

Dados principais:

- chave externa;
- sistema origem;
- evento;
- payload controlado;
- status;
- erro;
- tentativas.

Regras:

- integracoes devem ser idempotentes;
- segredos devem ficar fora de logs;
- falhas nao devem corromper eventos ja confirmados.

Criterios de aceite:

- evento duplicado nao duplica entrega;
- erro de integracao fica visivel para reprocessamento;
- APIs respeitam autenticacao, autorizacao e rate limit.

## 21. Funcoes que nao devem entrar cedo demais

Estas funcoes podem ser desejaveis, mas aumentam risco se entrarem antes do nucleo:

- IA para recomendacao de EPI;
- integracao completa com eSocial;
- reconhecimento facial proprio desenvolvido do zero;
- assinatura qualificada ICP-Brasil em todos os eventos;
- marketplace de fornecedores;
- compras automaticas;
- automacao de punicoes por uso indevido;
- aplicativo offline completo antes do modelo de sincronizacao estar desenhado.

