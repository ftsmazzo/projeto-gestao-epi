'use client';

import type { SupportMessageView, SupportScope, SupportThreadView } from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import {
  escalateSupport,
  fetchSupportThread,
  sendSupportMessage,
} from '../lib/auth';
import {
  escalatePortalSupport,
  fetchPortalSupportThread,
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

function mapSupportError(err: unknown, fallback: string) {
  if (!(err instanceof Error) || !err.message) return fallback;
  const lower = err.message.toLowerCase();
  if (
    lower.startsWith('erro http') ||
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('database') ||
    lower.includes('prisma') ||
    lower.includes('stack') ||
    lower.includes('sql') ||
    lower.includes('timeout')
  ) {
    return fallback;
  }
  return err.message;
}

function renderBodyWithDeepLinks(body: string, onNavigate?: () => void): ReactNode {
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
        <Link
          key={`${idx}-${start}-${href}`}
          href={href}
          className="support-widget__link"
          onClick={() => onNavigate?.()}
        >
          {label}
        </Link>,
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
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const loadRequestRef = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const effectiveScope: SupportScope =
    mode === 'portal' || Boolean(clientContextId) ? 'CLIENTE' : 'CONSULTORIA';
  const suggestions = suggestionsByPath(pathname, effectiveScope);

  const load = useMemo(
    () => async (silent = false) => {
      const requestId = ++loadRequestRef.current;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data =
          mode === 'portal'
            ? await fetchPortalSupportThread(pathname || undefined)
            : await fetchSupportThread({
                scope: effectiveScope,
                servedClientId: effectiveScope === 'CLIENTE' ? clientContextId || undefined : undefined,
                currentPath: pathname || undefined,
              });
        if (requestId === loadRequestRef.current) setThread(data);
      } catch (err) {
        if (!silent && requestId === loadRequestRef.current) {
          setError(mapSupportError(err, 'Falha ao abrir suporte.'));
        }
      } finally {
        if (!silent && requestId === loadRequestRef.current) setLoading(false);
      }
    },
    [mode, effectiveScope, clientContextId, pathname],
  );

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    const behavior = reducedMotion ? 'auto' : 'smooth';
    endRef.current?.scrollIntoView({ behavior });
  }, [thread?.messages.length, pending, open, reducedMotion]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const persisted = window.sessionStorage.getItem('support.widget.open');
    if (persisted === '1') setOpen(true);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem('support.widget.open', open ? '1' : '0');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => {
      if (!pending) void load(true);
    }, thread?.status === 'human' ? 6000 : 15000);
    return () => window.clearInterval(id);
  }, [open, pending, load, thread?.status]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !rootRef.current) return;
    const changed: Array<{ element: HTMLElement; inert: boolean }> = [];
    let current: HTMLElement | null = rootRef.current;
    while (current?.parentElement) {
      const parent: HTMLElement = current.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (sibling !== current && sibling instanceof HTMLElement) {
          changed.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      current = parent;
      if (parent === document.body) break;
    }
    return () => {
      for (const item of changed) item.element.inert = item.inert;
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    previousFocusRef.current?.focus();
  }, [open]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || pending) return;
    const previousDraft = draft;
    loadRequestRef.current += 1;
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
        setDraft('');
      } catch (err) {
        setDraft(previousDraft);
        setError(mapSupportError(err, 'Falha ao enviar mensagem.'));
      }
    });
  }

  function escalate() {
    loadRequestRef.current += 1;
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
        setError(mapSupportError(err, 'Falha ao acionar humano.'));
      }
    });
  }

  return (
    <div ref={rootRef} className={`support-widget ${open ? 'is-open' : ''}`}>
      {!open ? (
        <button
          ref={fabRef}
          type="button"
          className="support-widget__fab"
          onClick={() => {
            previousFocusRef.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : fabRef.current;
            setOpen(true);
          }}
          aria-label="Abrir suporte interno"
        >
          Suporte
        </button>
      ) : (
        <section
          ref={panelRef}
          className="support-widget__panel"
          aria-label="Suporte interno"
          role="dialog"
          aria-modal="true"
        >
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
              ref={closeRef}
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
          <p className="support-widget__sr-only" aria-live="polite">
            {loading
              ? 'Carregando conversa.'
              : pending
                ? 'Aguarde, processando mensagem.'
                : error
                  ? `Erro: ${error}`
                  : thread?.messages.length
                    ? `Conversa com ${thread.messages.length} mensagens carregada.`
                    : 'Conversa vazia.'}
          </p>

          {thread?.status === 'human' ? (
            <div className="support-widget__banner">
              {thread.lifecycleStatus === 'IN_PROGRESS'
                ? 'A equipe ProntEPI está atendendo esta conversa.'
                : 'Solicitação enviada à equipe ProntEPI. Você pode continuar descrevendo o problema.'}
            </div>
          ) : null}

          <div
            className="support-widget__thread"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-atomic="false"
          >
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
                <p>{renderBodyWithDeepLinks(message.body, () => setOpen(true))}</p>
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
            <label htmlFor="support-widget-message" className="support-widget__sr-only">
              Mensagem para o suporte
            </label>
            <input
              ref={inputRef}
              id="support-widget-message"
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
