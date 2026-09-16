'use client';

import type { SupportMessageView, SupportScope, SupportThreadView } from '@gestao-epi/shared';
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import {
  escalateSupport,
  fetchSupportThread,
  returnSupportToAi,
  sendSupportMessage,
} from '../lib/auth';
import {
  escalatePortalSupport,
  fetchPortalSupportThread,
  returnPortalSupportToAi,
  sendPortalSupportMessage,
} from '../lib/client-auth';

type Props = {
  mode: 'consultoria' | 'portal';
  clientContextId?: string | null;
};

const SUGGESTIONS_CONSULTORIA = [
  'Como cadastrar um cliente novo?',
  'Como importar o PGR corretamente?',
  'Onde configuro os acessos da equipe?',
];

const SUGGESTIONS_CLIENTE = [
  'Como fazer entrega com assinatura por link?',
  'Como dar entrada de EPI sem CA?',
  'Onde vejo alertas de reposicao?',
];

function suggestionsByPath(
  path: string | null,
  scope: SupportScope,
): string[] {
  if (!path) return scope === 'CLIENTE' ? SUGGESTIONS_CLIENTE : SUGGESTIONS_CONSULTORIA;
  if (path.startsWith('/portal/entregas')) {
    return [
      'Por que este trabalhador esta bloqueado para entrega?',
      'Como enviar link de assinatura remota?',
      'Como registrar entrega extra fora da indicacao?',
    ];
  }
  if (path.startsWith('/portal/estoque')) {
    return [
      'Como dar entrada de EPI sem CA?',
      'Como corrigir saldo insuficiente?',
      'Como vincular item real a necessidade?',
    ];
  }
  if (path.startsWith('/clientes')) {
    return [
      'Qual o proximo passo do roteiro deste cliente?',
      'Como atualizar PGR sem perder consistencia?',
      'Como liberar acesso de gestor e operador?',
    ];
  }
  return scope === 'CLIENTE' ? SUGGESTIONS_CLIENTE : SUGGESTIONS_CONSULTORIA;
}

function roleLabel(role: SupportMessageView['role']) {
  if (role === 'user') return 'Voce';
  if (role === 'assistant') return 'Agente';
  if (role === 'human_support') return 'Humano';
  return 'Sistema';
}

function renderBodyWithDeepLinks(body: string): ReactNode {
  const normalized = body.replace(/\]\(rota\s+([^)]+)\)/gi, ']($1)');
  const lines = normalized.split('\n');
  return lines.map((line, idx) => {
    const parts: ReactNode[] = [];
    const regex = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null = null;
    while ((match = regex.exec(line)) !== null) {
      const [raw, label, href] = match;
      const start = match.index;
      if (start > lastIndex) {
        parts.push(line.slice(lastIndex, start));
      }
      parts.push(
        <a key={`${idx}-${start}-${href}`} href={href} className="support-widget__link">
          {label}
        </a>,
      );
      lastIndex = start + raw.length;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }
    return (
      <span key={`line-${idx}`}>
        {parts}
        {idx < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}

export function SupportChatWidget({ mode, clientContextId }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<SupportThreadView | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement | null>(null);

  const effectiveScope: SupportScope =
    mode === 'portal' || Boolean(clientContextId) ? 'CLIENTE' : 'CONSULTORIA';
  const suggestions = suggestionsByPath(pathname, effectiveScope);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const data =
          mode === 'portal'
            ? await fetchPortalSupportThread(pathname || undefined)
            : await fetchSupportThread({
                scope: effectiveScope,
                servedClientId: effectiveScope === 'CLIENTE' ? clientContextId || undefined : undefined,
                currentPath: pathname || undefined,
              });
        setThread(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao abrir suporte.');
      } finally {
        setLoading(false);
      }
    },
    [mode, effectiveScope, clientContextId, pathname],
  );

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length, pending, open]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || pending) return;
    setDraft('');
    startTransition(async () => {
      try {
        const data =
          mode === 'portal'
            ? await sendPortalSupportMessage(body, pathname || undefined)
            : await sendSupportMessage({
                scope: effectiveScope,
                servedClientId: effectiveScope === 'CLIENTE' ? clientContextId || undefined : undefined,
                currentPath: pathname || undefined,
                body,
              });
        setThread(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao enviar mensagem.');
      }
    });
  }

  function escalate() {
    startTransition(async () => {
      try {
        const data =
          mode === 'portal'
            ? await escalatePortalSupport(undefined, pathname || undefined)
            : await escalateSupport({
                scope: effectiveScope,
                servedClientId: effectiveScope === 'CLIENTE' ? clientContextId || undefined : undefined,
                currentPath: pathname || undefined,
              });
        setThread(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao acionar humano.');
      }
    });
  }

  function backToAi() {
    startTransition(async () => {
      try {
        const data =
          mode === 'portal'
            ? await returnPortalSupportToAi(pathname || undefined)
            : await returnSupportToAi({
                scope: effectiveScope,
                servedClientId: effectiveScope === 'CLIENTE' ? clientContextId || undefined : undefined,
                currentPath: pathname || undefined,
              });
        setThread(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao voltar para IA.');
      }
    });
  }

  return (
    <div className={`support-widget ${open ? 'is-open' : ''}`}>
      {!open ? (
        <button
          type="button"
          className="support-widget__fab"
          onClick={() => setOpen(true)}
          aria-label="Abrir suporte interno"
        >
          Suporte
        </button>
      ) : (
        <section className="support-widget__panel" aria-label="Suporte interno">
          <header className="support-widget__header">
            <div>
              <strong>Suporte interno</strong>
              <small>
                {effectiveScope === 'CONSULTORIA'
                  ? 'Duvidas de operacao da consultoria'
                  : 'Duvidas de operacao da empresa cliente'}
              </small>
            </div>
            <button
              type="button"
              className="support-widget__close"
              onClick={() => setOpen(false)}
              aria-label="Fechar suporte"
            >
              ×
            </button>
          </header>

          <div className="support-widget__scope-label">
            Contexto: {effectiveScope === 'CONSULTORIA' ? 'Consultoria' : 'Cliente'}{' '}
            {pathname ? `· ${pathname}` : ''}
          </div>

          {thread?.status === 'human' ? (
            <div className="support-widget__banner">
              Fila humana ativa para esta conversa.
              <button type="button" onClick={backToAi} disabled={pending}>
                Voltar para IA
              </button>
            </div>
          ) : null}

          <div className="support-widget__thread">
            {loading && !thread ? <p>Abrindo conversa...</p> : null}
            {!loading && thread && thread.messages.length === 0 ? (
              <div className="support-widget__empty">
                <p>Pergunte algo sobre operacao do ProntEPI.</p>
                <div className="support-widget__suggestions">
                  {suggestions.map((item) => (
                    <button key={item} type="button" onClick={() => setDraft(item)} disabled={pending}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {thread?.messages.map((message) => (
              <article
                key={message.id}
                className={`support-widget__bubble support-widget__bubble--${message.role}`}
              >
                <span>{roleLabel(message.role)}</span>
                <p>{renderBodyWithDeepLinks(message.body)}</p>
              </article>
            ))}
            {pending ? (
              <article className="support-widget__bubble support-widget__bubble--assistant">
                <span>Agente</span>
                <p>Digitando...</p>
              </article>
            ) : null}
            <div ref={endRef} />
          </div>

          {error ? (
            <p className="support-widget__error" role="alert">
              {error}
            </p>
          ) : null}

          <form className="support-widget__compose" onSubmit={onSubmit}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Como faco...?"
              maxLength={4000}
              disabled={pending}
            />
            <button type="submit" disabled={pending || !draft.trim()}>
              Enviar
            </button>
          </form>

          <footer className="support-widget__footer">
            <button type="button" onClick={escalate} disabled={pending}>
              Falar com humano
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
