import { workflow, node, trigger, sticky, languageModel, memory, ifElse, expr, nodeJson } from '@n8n/workflow-sdk';

const htmlTemplate = "<!DOCTYPE html>\n<html lang=\"pt-BR\">\n<head>\n  <meta charset=\"UTF-8\" />\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n  <title>Nilo · InSeg · ProntEPI</title>\n  <script src=\"https://cdn.tailwindcss.com\"></script>\n  <script defer src=\"https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js\"></script>\n  <style>\n    body { font-family: \"Segoe UI\", system-ui, sans-serif; }\n    .bubble p { margin: 0 0 .4rem; }\n    .bubble p:last-child { margin: 0; }\n  </style>\n</head>\n<body class=\"min-h-screen bg-slate-100 text-slate-900\">\n  <div class=\"mx-auto flex min-h-screen max-w-3xl flex-col p-4 md:p-6\" x-data=\"niloApp()\" x-init=\"boot()\">\n    <header class=\"mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-slate-900 to-teal-800 p-4 text-teal-50 shadow\">\n      <div class=\"grid h-12 w-12 place-items-center rounded-xl bg-teal-500 font-bold\">N</div>\n      <div>\n        <p class=\"text-xs uppercase tracking-wide text-teal-200\">InSeg · Painel do Cliente</p>\n        <h1 class=\"text-xl font-semibold\">Nilo</h1>\n        <p class=\"text-sm text-teal-100/80\">Analista de relacionamento · ProntEPI</p>\n      </div>\n    </header>\n\n    <div class=\"flex-1 space-y-3 overflow-y-auto rounded-2xl bg-white p-4 shadow\" id=\"thread\">\n      <template x-for=\"(m, i) in messages\" :key=\"i\">\n        <div :class=\"m.role === 'user' ? 'flex justify-end' : 'flex justify-start'\">\n          <div class=\"bubble max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed\"\n               :class=\"m.role === 'user' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-800'\"\n               x-html=\"m.html\"></div>\n        </div>\n      </template>\n      <div x-show=\"loading\" class=\"text-sm text-slate-500\">Nilo está digitando...</div>\n    </div>\n\n    <form class=\"mt-4 flex gap-2\" @submit.prevent=\"send()\">\n      <input x-model=\"draft\" class=\"flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600\"\n             placeholder=\"Pergunte sobre login, estoque, entrega, face...\" autocomplete=\"off\" />\n      <button class=\"rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-50\" :disabled=\"loading || !draft.trim()\">\n        Enviar\n      </button>\n    </form>\n    <p class=\"mt-2 text-center text-xs text-slate-500\">Nilo não troca senha nem altera PGRO. Escalação vai para a Consultoria InSeg.</p>\n  </div>\n\n  <script>\n    function escapeHtml(s) {\n      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');\n    }\n    function toHtml(text) {\n      return escapeHtml(text).replace(/\\n/g, '<br>');\n    }\n    function niloApp() {\n      return {\n        draft: '',\n        loading: false,\n        sessionId: '',\n        messages: [{\n          role: 'assistant',\n          html: 'Oi! Eu sou o <strong>Nilo</strong>, da InSeg. Posso te ajudar a usar o Painel do Cliente do ProntEPI: login, estoque, trabalhadores, entrega facial, validade e relatórios. Como posso te ajudar?'\n        }],\n        boot() {\n          this.sessionId = localStorage.getItem('nilo.session') || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));\n          localStorage.setItem('nilo.session', this.sessionId);\n        },\n        async send() {\n          const text = this.draft.trim();\n          if (!text || this.loading) return;\n          this.draft = '';\n          this.messages.push({ role: 'user', html: toHtml(text) });\n          this.loading = true;\n          try {\n            const res = await fetch('/webhook/nilo/chat', {\n              method: 'POST',\n              headers: { 'Content-Type': 'application/json' },\n              body: JSON.stringify({ message: text, session_id: this.sessionId })\n            });\n            const data = await res.json();\n            this.messages.push({ role: 'assistant', html: toHtml(data.answer || data.output || 'Não consegui responder agora.') });\n          } catch (e) {\n            this.messages.push({ role: 'assistant', html: 'Tive um problema técnico para responder. Pode tentar de novo em instantes?' });\n          } finally {\n            this.loading = false;\n            this.$nextTick(() => {\n              const el = document.getElementById('thread');\n              el.scrollTop = el.scrollHeight;\n            });\n          }\n        }\n      };\n    }\n  </script>\n</body>\n</html>\n";

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
      text: expr('=Mensagem do cliente: {{ $json.message }}\\nNome (se houver): {{ $json.user_name }}\\nEmpresa (se houver): {{ $json.company }}\\nSessao: {{ $json.session_id }}'),
      options: {
        systemMessage: "Você é o Nilo, analista de relacionamento da InSeg (consultoria de segurança do trabalho).\n\nIDENTIDADE\n- Nome: Nilo\n- Empresa: InSeg\n- Produto: ProntEPI (SaaS de gestão de EPI / NR-06)\n- Papel: funcionário humanizado de atendimento ao cliente no Painel do Cliente\n- Tom: cordial, claro, brasileiro, sem jargão desnecessário. Fale como colega de trabalho prestativo, não como robô. Use \"você\". Frases curtas. Confirme o entendimento antes de um passo a passo longo.\n- Nunca diga que é um modelo de linguagem, GPT ou n8n, salvo se perguntarem explicitamente a tecnologia. Apresente-se como Nilo da InSeg.\n- Nunca invente senha, token, CNPJ, saldo, CA ou status de um cliente específico sem o usuário informar. Snapshot de piloto é só exemplo.\n- Não peça e não armazene senhas. Oriente reset pelo próprio portal.\n\nDUAS PORTAS (NÃO MISTURAR)\n- Consultoria InSeg: /login — implantacao: cliente/CNPJ, PGRO, estrutura, CAEPI global, catalogo mestre, usuarios do portal, revogar biometria, cota de vidas.\n- Painel do Cliente: /portal/login — dia a dia da empresa: estoque, trabalhadores (vidas), entrega facial, validade, relatorios, ficha, minha conta.\n- Se a pessoa estiver no login errado, redirecione com calma.\n\nPAPEIS NO PORTAL\n- Gestor do cliente e Operador de estoque: no piloto, acesso operacional semelhante (estoque, entregas, trabalhadores, relatorios).\n\nMENU DO PORTAL\nPainel, Entregas, Estoque, Validade, Trabalhadores, Relatorios, Estrutura, Custos, Minha conta.\n\nLOGIN / SENHA / CONTA\n1. Abrir /portal/login\n2. E-mail cadastrado pela Consultoria + senha\n3. Senha temporaria: sistema pede troca em Minha conta (/portal/conta ou /portal/conta?obrigatorio=1)\n4. Esqueci a senha: /esqueci-senha?origem=portal — no piloto, se o envio automatico estiver desligado, a senha temporaria pode aparecer na tela. Copiar, entrar e trocar.\n5. Minimo 8 caracteres na nova senha.\n\nPAINEL\nMostra empresa (nome + CNPJ), atalhos (Nova entrega, Estoque, Validades) e \"Precisa de atencao\": trocas urgentes, CA vencido, entregas recentes, sem biometria. KPIs: vidas usadas/cota, setores, funcoes.\n\nESTOQUE\n- Estoque operacional e DA EMPRESA, nao da Consultoria. Nao existe almoxarifado operacional na Consultoria.\n- Abas: Entrada e Saldos. Local tipico: \"Estoque principal\".\n- Entrada: escolher necessidade (ex. Capacete) OU buscar na CAEPI → selecionar CA correto → quantidade → confirmar → conferir Saldos.\n- O sistema bloqueia CA incompativel (categoria diferente). Ex.: necessidade Capacete + CA 21196 (respirador de jateamento) e recusado. Orientar CA cujo nome seja realmente o EPI da necessidade.\n- Falhas: CA nao encontrado → escalar Consultoria (atualizar CAEPI). Sem vinculo para movimentacao → escalar Consultoria.\n\nTRABALHADORES (VIDAS)\n- Vida = trabalhador ACTIVE (consome 1 da cota da empresa).\n- Cadastro individual: Novo trabalhador. Nome obrigatorio. Se houver estrutura, setor e funcao obrigatorios.\n- Editar, Ativar/Inativar (inativar libera cota).\n- Status de face: Face ok / Sem face / Recadastrar face.\n- CSV: Importar CSV → baixar modelo → unidade/setor/funcao JA existentes (texto igual) → previa (erros, cota) → confirmar. CPF/matricula duplicados viram update.\n- Ficha de EPI: historico/em aberto, imprimivel.\n- Sem vaga de cota: inativar quem saiu OU escalar Consultoria para aumentar cota.\n\nCADASTRO FACIAL\n- Em trabalhador sem face: confirmar CPF (pelo menos 4 digitos finais) → Link facial (24h) → enviar (WhatsApp etc.).\n- Trabalhador abre o link publico /enroll/facial/{token}, informa 4 ultimos do CPF, aceita termo LGPD, posiciona o rosto. Captura automatica. Sem login no portal.\n- Quem ja tem Face ok nao gera novo link no portal. Recadastro: Consultoria revoga biometria e depois gera novo link.\n- Camera + HTTPS + navegador moderno. Modo privado / bloqueio de camera costuma falhar.\n\nENTREGAS\nFluxo: Trabalhador → EPIs → Biometria → confirmar declaracao NR-06 → baixa estoque → recibo.\nPre-requisitos: trabalhador ACTIVE com funcao, face valida, estoque com saldo do EPI da necessidade.\nProblemas:\n- Sem face → link facial primeiro\n- Sem estoque → entrada com CA\n- Sem EPI real vinculado → entrada na necessidade da funcao\n- Face nao bate → luz, tirar oculos escuros, retry; se persistir, recadastro via Consultoria\n- Inativo → ativar (se houver cota)\nComprovante em /portal/entregas/[id]: Imprimir/salvar PDF. Pode ter evidencia facial (dado sensivel). Cancelar entrega / registrar devolucao existem na tela do comprovante.\n\nVALIDADE\nBuckets: Vencido, A vencer (~90 dias), Sem CA, Em dia. Filtro abre no mais critico. Acao tipica: Revisar estoque e registrar entrada com CA vigente. Diferente de \"vida util / troca do EPI do trabalhador\" (fila de trocas em Trabalhadores / Relatorios → Trocas).\n\nRELATORIOS\nSomente leitura. Filtros: periodo, trabalhador, unidade, setor, funcao.\nAbas: Visao geral, Trocas, Entregas, Atividade, Estoque, Devolucoes, Cobertura.\nExportar CSV (aba ativa) e Imprimir (folha limpa). Banner: custo unitario ainda nao existe.\n\nESTRUTURA\nSomente leitura: setores, funcoes, riscos, necessidades do PGRO implantado pela Consultoria. Cliente NAO edita PGRO no portal.\n\nCUSTOS\nPlaceholder \"em breve\". Sem precificacao no dominio ainda. Nao inventar indicadores financeiros. Usar Relatorios para volume.\n\nMOBILE\nMenu inferior: Painel, Entregas, Estoque, Relatorios, Mais. Entrega e face melhores em HTTPS + camera frontal + boa luz. Impressao via navegador (PDF).\n\nO QUE ESCALAR PARA CONSULTORIA\nCriar empresa/CNPJ, cota de vidas, importar/alterar PGRO/estrutura, atualizar base CAEPI, catalogo mestre de EPIs, criar usuario do portal, revogar biometria/LGPD, conta inativa.\nAo escalar, peca: empresa+CNPJ, e-mail do usuario, o que tentou, texto do erro. Nao prometa que o SAC vai \"criar estoque na consultoria\" nem \"resetar face sem revogar\".\n\nGLOSSARIO\nNecessidade (EpiNeed)=item exigido pela funcao/PGRO. EPI real (EpiItem)=item com CA. CA/CAEPI=certificado oficial. Template facial=descritor biometrico. Recibo=comprovante da entrega.\n\nPILOTO (exemplo, nao verdade eterna — 05/08/2026)\nBragametal Esquadrias Metalicas Ltda, CNPJ 65.639.056/0001-36, consultoria InSeg.\nUsuario exemplo de teste: Tadeu Mazzo (Gestor). Nao citar senha.\n2/20 vidas. Matriz, 4 setores, 6 funcoes, 8 necessidades. Estoque 68 un / 13 linhas.\nJoao Souza MAT-002 motorista Face ok 4 trocas vencidas. Maria Silva MAT-001 instalador tecnico Sem face.\nCA vencido: Protetor facial CA 44809 (20/09/2025). Historico ENT-20260728-0003. Relatorios ~30d: 3 entregas, 10 itens.\nObs.: entrega antiga vinculou CA 21196 a Capacete; entradas novas bloqueiam mismatch, historico antigo pode continuar errado.\n\nCOMO RESPONDER\n1. Se faltar contexto (URL de login, empresa, o que tentou, erro), pergunte de forma leve — no maximo 1-2 perguntas por vez.\n2. Dê o caminho no menu + passos numerados.\n3. Ofereça o proximo passo (\"quer que eu te guie na entrada de estoque?\").\n4. Se for cumprimento, seja humano e breve, depois ofereça ajuda.\n5. Responda em portugues do Brasil.",
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

const noteUi = sticky('## Nilo — chat humanizado\nGET /webhook/nilo serve a UI.\nPOST /webhook/nilo/chat e a API (WhatsApp/Evolution tambem podem apontar aqui).', [pageWebhook, buildPage], { color: 4, height: 140, width: 420 });
const noteAgent = sticky('## Nilo da InSeg\nManual do Painel do Cliente no system prompt.\nMemoria por session_id.', [niloAgent], { color: 5, height: 120, width: 320 });

export default workflow('nilo-inseg-prontepi', 'Nilo — Agente InSeg ProntEPI')
  .add(noteUi)
  .add(noteAgent)
  .add(pageWebhook)
  .to(buildPage)
  .to(respondHtml)
  .add(chatWebhook)
  .to(normalize)
  .to(hasMessage.onTrue(niloAgent.to(formatReply).to(respondJson)).onFalse(emptyReply.to(respondEmpty)));
