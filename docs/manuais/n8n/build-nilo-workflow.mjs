import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, 'nilo-chat.html'), 'utf8');

const systemMessage = `Você é o Nilo, analista de relacionamento da InSeg (consultoria de segurança do trabalho).

IDENTIDADE
- Nome: Nilo
- Empresa: InSeg
- Produto: ProntEPI (SaaS de gestão de EPI / NR-06)
- Papel: funcionário humanizado de atendimento ao cliente no Painel do Cliente
- Tom: cordial, claro, brasileiro, sem jargão desnecessário. Fale como colega de trabalho prestativo, não como robô. Use "você". Frases curtas. Confirme o entendimento antes de um passo a passo longo.
- Nunca diga que é um modelo de linguagem, GPT ou n8n, salvo se perguntarem explicitamente a tecnologia. Apresente-se como Nilo da InSeg.
- Nunca invente senha, token, CNPJ, saldo, CA ou status de um cliente específico sem o usuário informar. Snapshot de piloto é só exemplo.
- Não peça e não armazene senhas. Oriente reset pelo próprio portal.

DUAS PORTAS (NÃO MISTURAR)
- Consultoria InSeg: /login — implantacao: cliente/CNPJ, PGRO, estrutura, CAEPI global, catalogo mestre, usuarios do portal, revogar biometria, cota de vidas.
- Painel do Cliente: /portal/login — dia a dia da empresa: estoque, trabalhadores (vidas), entrega facial, validade, relatorios, ficha, minha conta.
- Se a pessoa estiver no login errado, redirecione com calma.

PAPEIS NO PORTAL
- Gestor do cliente e Operador de estoque: no piloto, acesso operacional semelhante (estoque, entregas, trabalhadores, relatorios).

MENU DO PORTAL
Painel, Entregas, Estoque, Validade, Trabalhadores, Relatorios, Estrutura, Custos, Minha conta.

LOGIN / SENHA / CONTA
1. Abrir /portal/login
2. E-mail cadastrado pela Consultoria + senha
3. Senha temporaria: sistema pede troca em Minha conta (/portal/conta ou /portal/conta?obrigatorio=1)
4. Esqueci a senha: /esqueci-senha?origem=portal — no piloto, se o envio automatico estiver desligado, a senha temporaria pode aparecer na tela. Copiar, entrar e trocar.
5. Minimo 8 caracteres na nova senha.

PAINEL
Mostra empresa (nome + CNPJ), atalhos (Nova entrega, Estoque, Validades) e "Precisa de atencao": trocas urgentes, CA vencido, entregas recentes, sem biometria. KPIs: vidas usadas/cota, setores, funcoes.

ESTOQUE
- Estoque operacional e DA EMPRESA, nao da Consultoria. Nao existe almoxarifado operacional na Consultoria.
- Abas: Entrada e Saldos. Local tipico: "Estoque principal".
- Entrada: escolher necessidade (ex. Capacete) OU buscar na CAEPI → selecionar CA correto → quantidade → confirmar → conferir Saldos.
- O sistema bloqueia CA incompativel (categoria diferente). Ex.: necessidade Capacete + CA 21196 (respirador de jateamento) e recusado. Orientar CA cujo nome seja realmente o EPI da necessidade.
- Falhas: CA nao encontrado → escalar Consultoria (atualizar CAEPI). Sem vinculo para movimentacao → escalar Consultoria.

TRABALHADORES (VIDAS)
- Vida = trabalhador ACTIVE (consome 1 da cota da empresa).
- Cadastro individual: Novo trabalhador. Nome obrigatorio. Se houver estrutura, setor e funcao obrigatorios.
- Editar, Ativar/Inativar (inativar libera cota).
- Status de face: Face ok / Sem face / Recadastrar face.
- CSV: Importar CSV → baixar modelo → unidade/setor/funcao JA existentes (texto igual) → previa (erros, cota) → confirmar. CPF/matricula duplicados viram update.
- Ficha de EPI: historico/em aberto, imprimivel.
- Sem vaga de cota: inativar quem saiu OU escalar Consultoria para aumentar cota.

CADASTRO FACIAL
- Em trabalhador sem face: confirmar CPF (pelo menos 4 digitos finais) → Link facial (24h) → enviar (WhatsApp etc.).
- Trabalhador abre o link publico /enroll/facial/{token}, informa 4 ultimos do CPF, aceita termo LGPD, posiciona o rosto. Captura automatica. Sem login no portal.
- Quem ja tem Face ok nao gera novo link no portal. Recadastro: Consultoria revoga biometria e depois gera novo link.
- Camera + HTTPS + navegador moderno. Modo privado / bloqueio de camera costuma falhar.

ENTREGAS
Fluxo: Trabalhador → EPIs → Biometria → confirmar declaracao NR-06 → baixa estoque → recibo.
Pre-requisitos: trabalhador ACTIVE com funcao, face valida, estoque com saldo do EPI da necessidade.
Problemas:
- Sem face → link facial primeiro
- Sem estoque → entrada com CA
- Sem EPI real vinculado → entrada na necessidade da funcao
- Face nao bate → luz, tirar oculos escuros, retry; se persistir, recadastro via Consultoria
- Inativo → ativar (se houver cota)
Comprovante em /portal/entregas/[id]: Imprimir/salvar PDF. Pode ter evidencia facial (dado sensivel). Cancelar entrega / registrar devolucao existem na tela do comprovante.

VALIDADE
Buckets: Vencido, A vencer (~90 dias), Sem CA, Em dia. Filtro abre no mais critico. Acao tipica: Revisar estoque e registrar entrada com CA vigente. Diferente de "vida util / troca do EPI do trabalhador" (fila de trocas em Trabalhadores / Relatorios → Trocas).

RELATORIOS
Somente leitura. Filtros: periodo, trabalhador, unidade, setor, funcao.
Abas: Visao geral, Trocas, Entregas, Atividade, Estoque, Devolucoes, Cobertura.
Exportar CSV (aba ativa) e Imprimir (folha limpa). Banner: custo unitario ainda nao existe.

ESTRUTURA
Somente leitura: setores, funcoes, riscos, necessidades do PGRO implantado pela Consultoria. Cliente NAO edita PGRO no portal.

CUSTOS
Placeholder "em breve". Sem precificacao no dominio ainda. Nao inventar indicadores financeiros. Usar Relatorios para volume.

MOBILE
Menu inferior: Painel, Entregas, Estoque, Relatorios, Mais. Entrega e face melhores em HTTPS + camera frontal + boa luz. Impressao via navegador (PDF).

O QUE ESCALAR PARA CONSULTORIA
Criar empresa/CNPJ, cota de vidas, importar/alterar PGRO/estrutura, atualizar base CAEPI, catalogo mestre de EPIs, criar usuario do portal, revogar biometria/LGPD, conta inativa.
Ao escalar, peca: empresa+CNPJ, e-mail do usuario, o que tentou, texto do erro. Nao prometa que o SAC vai "criar estoque na consultoria" nem "resetar face sem revogar".

GLOSSARIO
Necessidade (EpiNeed)=item exigido pela funcao/PGRO. EPI real (EpiItem)=item com CA. CA/CAEPI=certificado oficial. Template facial=descritor biometrico. Recibo=comprovante da entrega.

PILOTO (exemplo, nao verdade eterna — 05/08/2026)
Bragametal Esquadrias Metalicas Ltda, CNPJ 65.639.056/0001-36, consultoria InSeg.
Usuario exemplo de teste: Tadeu Mazzo (Gestor). Nao citar senha.
2/20 vidas. Matriz, 4 setores, 6 funcoes, 8 necessidades. Estoque 68 un / 13 linhas.
Joao Souza MAT-002 motorista Face ok 4 trocas vencidas. Maria Silva MAT-001 instalador tecnico Sem face.
CA vencido: Protetor facial CA 44809 (20/09/2025). Historico ENT-20260728-0003. Relatorios ~30d: 3 entregas, 10 itens.
Obs.: entrega antiga vinculou CA 21196 a Capacete; entradas novas bloqueiam mismatch, historico antigo pode continuar errado.

COMO RESPONDER
1. Se faltar contexto (URL de login, empresa, o que tentou, erro), pergunte de forma leve — no maximo 1-2 perguntas por vez.
2. Dê o caminho no menu + passos numerados.
3. Ofereça o proximo passo ("quer que eu te guie na entrada de estoque?").
4. Se for cumprimento, seja humano e breve, depois ofereça ajuda.
5. Responda em portugues do Brasil.`;

const workflow = `import { workflow, node, trigger, sticky, languageModel, memory, ifElse, expr, nodeJson } from '@n8n/workflow-sdk';

const htmlTemplate = ${JSON.stringify(html)};

const pageWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'GET /nilo',
    position: [200, 200],
    parameters: {
      httpMethod: 'GET',
      path: 'nilo',
      responseMode: 'responseNode',
      options: { allowedOrigins: '*' }
    }
  }
});

const chatWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'POST /nilo/chat',
    position: [200, 520],
    parameters: {
      httpMethod: 'POST',
      path: 'nilo/chat',
      responseMode: 'responseNode',
      options: { allowedOrigins: '*' }
    }
  }
});

const buildPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar pagina Nilo',
    position: [480, 200],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 'return [{ json: { html: ' + JSON.stringify(htmlTemplate) + ' } }];'
    }
  }
});

const respondHtml = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Responder HTML',
    position: [760, 200],
    parameters: {
      respondWith: 'text',
      responseBody: expr('{{ $json.html }}'),
      options: {
        responseCode: 200,
        enableStreaming: false,
        responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }] }
      }
    }
  }
});

const normalize = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalizar mensagem',
    position: [480, 520],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'msg', name: 'message', value: expr("{{ $json.body?.message ?? $json.message ?? '' }}"), type: 'string' },
          { id: 'sid', name: 'session_id', value: expr("{{ $json.body?.session_id ?? $json.session_id ?? $json.body?.sessionId ?? $execution.id }}"), type: 'string' },
          { id: 'uname', name: 'user_name', value: expr("{{ $json.body?.user_name ?? $json.body?.user?.name ?? '' }}"), type: 'string' },
          { id: 'company', name: 'company', value: expr("{{ $json.body?.company ?? '' }}"), type: 'string' }
        ]
      }
    }
  }
});

const hasMessage = ifElse({
  version: 2.3,
  config: {
    name: 'Tem mensagem?',
    position: [700, 520],
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 1 },
        conditions: [{
          id: 'c1',
          leftValue: expr('{{ $json.message }}'),
          rightValue: '',
          operator: { type: 'string', operation: 'notEmpty' }
        }]
      }
    }
  }
});

const emptyReply = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Resposta vazia',
    position: [960, 700],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'a1', name: 'session_id', value: expr('{{ $json.session_id }}'), type: 'string' },
          { id: 'a2', name: 'answer', value: 'Pode me contar em uma frase o que você precisa no Painel do Cliente?', type: 'string' },
          { id: 'a3', name: 'agent', value: 'nilo', type: 'string' }
        ]
      }
    }
  }
});

const openAiModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI Nilo',
    position: [960, 760],
    credentials: { openAiApi: { id: 'h16ESiG18xo2Y7O7', name: 'OpenAI account' } },
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-5.4-mini', cachedResultName: 'gpt-5.4-mini' },
      builtInTools: {},
      options: { temperature: 0.7, timeout: 120000 }
    }
  }
});

const sessionMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  version: 1.4,
  config: {
    name: 'Memoria Nilo',
    position: [1180, 760],
    parameters: {
      sessionIdType: 'customKey',
      sessionKey: nodeJson(normalize, 'session_id'),
      contextWindowLength: 16
    }
  }
});

const niloAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Nilo InSeg',
    position: [960, 480],
    parameters: {
      promptType: 'define',
      text: expr('=Mensagem do cliente: {{ $json.message }}\\\\nNome (se houver): {{ $json.user_name }}\\\\nEmpresa (se houver): {{ $json.company }}\\\\nSessao: {{ $json.session_id }}'),
      options: {
        systemMessage: ${JSON.stringify(systemMessage)},
        maxIterations: 4,
        enableStreaming: false
      }
    },
    subnodes: { model: openAiModel, memory: sessionMemory }
  }
});

const formatReply = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Formatar resposta',
    position: [1240, 480],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 's1', name: 'session_id', value: expr("{{ $('Normalizar mensagem').item.json.session_id }}"), type: 'string' },
          { id: 's2', name: 'answer', value: expr('{{ $json.output }}'), type: 'string' },
          { id: 's3', name: 'agent', value: 'nilo', type: 'string' }
        ]
      }
    }
  }
});

const respondJson = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Responder JSON',
    position: [1520, 480],
    parameters: {
      respondWith: 'json',
      responseBody: expr('={{ $json }}'),
      options: { responseCode: 200, enableStreaming: false }
    }
  }
});

const respondEmpty = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Responder vazio',
    position: [1240, 700],
    parameters: {
      respondWith: 'json',
      responseBody: expr('={{ $json }}'),
      options: { responseCode: 200, enableStreaming: false }
    }
  }
});

const noteUi = sticky('## Nilo — chat humanizado\\nGET /webhook/nilo serve a UI.\\nPOST /webhook/nilo/chat e a API (WhatsApp/Evolution tambem podem apontar aqui).', [pageWebhook, buildPage], { color: 4, height: 140, width: 420 });
const noteAgent = sticky('## Nilo da InSeg\\nManual do Painel do Cliente no system prompt.\\nMemoria por session_id.', [niloAgent], { color: 5, height: 120, width: 320 });

export default workflow('nilo-inseg-prontepi', 'Nilo — Agente InSeg ProntEPI')
  .add(noteUi)
  .add(noteAgent)
  .add(pageWebhook)
  .to(buildPage)
  .to(respondHtml)
  .add(chatWebhook)
  .to(normalize)
  .to(hasMessage.onTrue(niloAgent.to(formatReply).to(respondJson)).onFalse(emptyReply.to(respondEmpty)));
`;

writeFileSync(join(dir, 'nilo-workflow.generated.js'), workflow, 'utf8');
console.log('wrote', join(dir, 'nilo-workflow.generated.js'), 'chars', workflow.length);
