# NF-e — prontidão e go-live

Objetivo: receber o A1 do cliente e o material do Daniel, e ligar a emissão operacional no momento certo — sem autorizar SEFAZ antes da checklist verde.

## Já existe no produto

- Cadastro fiscal: CNPJ, UF, IE, regime (Presumido / Simples / Real).
- Upload e guarda do certificado A1 (`.pfx` + senha), cifrado com `FISCAL_CERT_SECRET`.
- Nota de saída a partir do orçamento aprovado (rascunho).
- CFOP interno/interestadual por produto (`saleCfopIn` / `saleCfopOut`).
- Confirmação da saída no estoque + conta a receber.
- Bloqueio explícito da autorização SEFAZ até o flag de emissão.

## O que o cliente envia

1. Certificado **A1** da empresa (arquivo `.pfx` ou `.p12`).
2. Senha do certificado.
3. Confirmação de que o A1 é do **mesmo CNPJ** que vai emitir.
4. Validade do certificado (data de expiração).

Um A1 cobre vendas para clientes de qualquer UF (interestadual). Não precisa de um certificado por estado.

## O que o Daniel envia (mínimo para ligar)

| Item | Para quê |
| --- | --- |
| CNPJ + UF + IE da distribuidora | Identidade do emitente |
| Regime tributário | Simples / Presumido / Real |
| Ambiente inicial | Homologação primeiro; produção depois |
| Webservice / SVRS da UF | Endpoint correto da SEFAZ do emitente |
| CSC + idToken (só se for NFC-e) | Cupom; NF-e modelo 55 normalmente não usa |
| CFOP padrão interno e interestadual | Ex.: 5102 / 6102 (validar com o contador) |
| Regra de ICMS / ST nos EPIs que vendem | Produto com `icmsSt` e CEST quando couber |
| Série e numeração inicial da NF-e | Evitar colisão com outro emissor |
| Contato do contador para rejeições | Ajuste fino de tributação |

Áudio ou texto serve. Sem isso, o A1 só fica guardado — a autorização continua bloqueada.

## Checklist interna (ProntEPI) antes de ligar

### Infra

- [ ] `FISCAL_CERT_SECRET` no EasyPanel (api) — sem isso o upload do A1 falha.
- [ ] `OUTBOUND_EMISSION_ENABLED=false` até homologação ok.
- [ ] Backup/procedimento se trocarem o A1.

### Cadastro no tenant da distribuidora

- [ ] Fiscal: CNPJ, UF, IE, regime salvos.
- [ ] A1 enviado e status “Guardado”.
- [ ] Produtos de teste com NCM 8 dígitos e CFOP in/out.
- [ ] Orçamento aprovado → nota de saída em rascunho sem bloqueios.

### Homologação

- [ ] Emitir 1 NF-e de teste no ambiente de homologação.
- [ ] XML autorizado + DANFE legível.
- [ ] Rejeição tratada (mensagem clara na tela).
- [ ] Confirmação do estoque e do a receber alinhados à nota.

### Produção

- [ ] Contador / Daniel valida a primeira nota real.
- [ ] Ligar `OUTBOUND_EMISSION_ENABLED=true` na api e redeploy/restart.
- [ ] Emitir 1 nota real controlada e acompanhar retorno SEFAZ.

## Como ligar no momento certo

1. Materiais do cliente + Daniel recebidos e cadastro preenchido.
2. Homologação ok.
3. No EasyPanel (serviço `api`):
   - Confirmar `FISCAL_CERT_SECRET`.
   - Definir `OUTBOUND_EMISSION_ENABLED=true`.
4. Redeploy/restart da api.
5. Autorizar a primeira NF-e pela tela de Notas.
6. Se algo falhar: voltar o flag para `false` e investigar — estoque confirmado não “desautoriza” sozinho.

## Fora deste go-live (não bloquear a 1ª emissão)

- Reforma tributária completa.
- NFC-e (PDV).
- Busca DF-e / manifesto automático de todas as compras.
- Multiempresa / multi-IE na mesma conta.

## Mensagem pronta para o Daniel

> Precisamos, para ligar a NF-e do ERP: CNPJ, UF, IE, regime, se começamos em homologação ou produção, endpoint/SVRS da UF, CFOP padrão interno e interestadual, se algum EPI usa ST/CEST, série e numeração inicial da NF-e, e um contato para rejeições. O cliente manda o A1 (.pfx + senha). Com isso homologamos e só depois ligamos a autorização na SEFAZ.
