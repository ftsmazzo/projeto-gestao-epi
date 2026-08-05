# Nilo — agente InSeg (n8n Cursor)

Atendente humanizado da InSeg para duvidas de uso do **Painel do Cliente** (ProntEPI).

- Workflow: [Nilo - Agente InSeg ProntEPI](https://infra-core-n8n-core.kxryyk.easypanel.host/workflow/1e6oTKgF1gnFlO7K)
- Chat (UI): `https://infra-core-n8n-core.kxryyk.easypanel.host/webhook/nilo`
- API: `POST https://infra-core-n8n-core.kxryyk.easypanel.host/webhook/nilo/chat`

```json
{
  "message": "Como faco uma entrega?",
  "session_id": "opcional-para-memoria",
  "user_name": "opcional",
  "company": "opcional",
  "channel": "whatsapp",
  "screen_context": "opcional: descricao do print"
}
```

Resposta:

```json
{
  "session_id": "...",
  "answer": "...",
  "agent": "nilo"
}
```

WhatsApp/Evolution pode apontar o mesmo `POST /webhook/nilo/chat`.

O Nilo consegue **resetar acesso** chamando `POST /auth/forgot-password` com o e-mail do gestor (audience `portal`). CPF do trabalhador nao e login.

## WhatsApp (Evolution)

Workflow ponte: [Nilo WhatsApp Evolution](https://infra-core-n8n-core.kxryyk.easypanel.host/workflow/WghCGqOSXM0QRQCf)

Na instancia **do numero do Nilo** (nao na instancia `Agente` do outro projeto):

- Enabled: sim
- URL: `https://infra-core-n8n-core.kxryyk.easypanel.host/webhook/nilo-whatsapp`
- Events: `MESSAGES_UPSERT`
- Webhook by events: nao precisa
- Se existir a opcao **webhook base64**, ligue para o print/audio chegarem mais estaveis

No n8n, selecione a credencial `Evolution` em:

- **Enviar Zap Evolution**
- **Baixar midia Evolution** (obrigatorio para ouvir audio e ler print)

Capacidades no Zap:

- texto
- audio / recado (transcricao Whisper)
- imagem / print da tela (visao)
- mapa do portal + envio de print de ajuda (`/ajuda/portal/`)
- tom humanizado, sem repetir a ultima frase
- reset de senha por e-mail cadastrado

No n8n, selecione `Evolution` tambem em **Enviar print Evolution**.

Ficha de EPI fica em **Trabalhadores** (nao em Relatorios). Menu do portal e no topo (PC) ou embaixo/Mais (celular).
