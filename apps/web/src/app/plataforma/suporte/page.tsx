'use client';

import type {
  PlatformAuthUser,
  PlatformSupportLifecycleStatus,
  PlatformSupportOverview,
  PlatformSupportThreadDetail,
  PlatformSupportThreadList,
  PlatformSupportThreadRow,
  SupportMessageRoleView,
  SupportScope,
} from '@gestao-epi/shared';
import type { RefObject } from 'react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { RequirePlatformAuth } from '../../../components/RequirePlatformAuth';
import {
  claimPlatformSupportThread,
  getPlatformSupportOverview,
  getPlatformSupportThread,
  getPlatformSupportThreads,
  replyPlatformSupportThread,
  resolvePlatformSupportThread,
  returnPlatformSupportThreadToAi,
} from '../../../lib/platform-support';

const STATUS_OPTIONS: Array<{
  value: PlatformSupportLifecycleStatus | '';
  label: string;
}> = [
  { value: '', label: 'Todos os estados' },
  { value: 'WAITING_HUMAN', label: 'Aguardando humano' },
  { value: 'IN_PROGRESS', label: 'Em atendimento' },
  { value: 'ACTIVE', label: 'Com a IA' },
  { value: 'RESOLVED', label: 'Resolvidos' },
];

function statusLabel(status: PlatformSupportLifecycleStatus) {
  if (status === 'WAITING_HUMAN') return 'Aguardando';
  if (status === 'IN_PROGRESS') return 'Em atendimento';
  if (status === 'RESOLVED') return 'Resolvido';
  return 'Com a IA';
}

function roleLabel(role: SupportMessageRoleView) {
  if (role === 'user') return 'Solicitante';
  if (role === 'assistant') return 'Agente ProntEPI';
  if (role === 'human_support') return 'Equipe ProntEPI';
  return 'Sistema';
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function minutesLabel(value: number | null) {
  if (value == null) return 'Sem dados';
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours}h${minutes ? ` ${minutes}min` : ''}`;
}

export default function PlataformaSuportePage() {
  return (
    <RequirePlatformAuth>
      {(user) => <SupportCenter user={user} />}
    </RequirePlatformAuth>
  );
}

function SupportCenter({ user }: { user: PlatformAuthUser }) {
  const [overview, setOverview] = useState<PlatformSupportOverview | null>(null);
  const [threads, setThreads] = useState<PlatformSupportThreadList | null>(null);
  const [detail, setDetail] = useState<PlatformSupportThreadDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<PlatformSupportLifecycleStatus | ''>(
    'WAITING_HUMAN',
  );
  const [scope, setScope] = useState<SupportScope | ''>('');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const conversationHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const queueRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  const loadQueue = useCallback(async () => {
    const requestId = ++queueRequestRef.current;
    const [overviewData, threadData] = await Promise.all([
      getPlatformSupportOverview(),
      getPlatformSupportThreads({
        status,
        scope,
        q: appliedQuery,
        page,
        pageSize: 30,
      }),
    ]);
    if (requestId !== queueRequestRef.current) return null;
    setOverview(overviewData);
    setThreads(threadData);
    return threadData;
  }, [status, scope, appliedQuery, page]);

  const loadDetail = useCallback(async (threadId: string, silent = false) => {
    const requestId = ++detailRequestRef.current;
    if (!silent) setDetailLoading(true);
    try {
      const data = await getPlatformSupportThread(threadId);
      if (
        requestId === detailRequestRef.current &&
        selectedIdRef.current === threadId
      ) {
        setDetail(data);
        if (!silent) {
          setAnnouncement(
            `Conversa de ${data.requester?.name || 'usuario'} aberta.`,
          );
          window.setTimeout(
            () => conversationHeadingRef.current?.focus(),
            0,
          );
        }
      }
    } finally {
      if (!silent && requestId === detailRequestRef.current) {
        setDetailLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    setLoading(true);
    void loadQueue()
      .then((data) => {
        if (!data) return;
        if (
          selectedId &&
          !data.items.some((thread) => thread.id === selectedId)
        ) {
          setSelectedId(null);
          setDetail(null);
        }
        setError(null);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Nao foi possivel carregar a central.',
        );
      })
      .finally(() => setLoading(false));
  }, [loadQueue, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId).catch((err: unknown) => {
      setError(
        err instanceof Error ? err.message : 'Nao foi possivel abrir a conversa.',
      );
    });
  }, [selectedId, loadDetail]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadQueue().catch(() => undefined);
      if (selectedId && !saving) {
        void loadDetail(selectedId, true).catch(() => undefined);
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [loadQueue, loadDetail, saving, selectedId]);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    messagesEndRef.current?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [detail?.messages.length]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setAppliedQuery(query.trim());
  }

  async function runAction(
    action: () => Promise<PlatformSupportThreadDetail>,
    message: string,
  ) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    detailRequestRef.current += 1;
    try {
      const updated = await action();
      if (selectedIdRef.current === updated.id) setDetail(updated);
      setSuccess(message);
      window.setTimeout(() => conversationHeadingRef.current?.focus(), 0);
      void loadQueue().catch(() => undefined);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel concluir.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    if (!detail || !draft.trim() || saving) return;
    const body = draft.trim();
    const sent = await runAction(
      () => replyPlatformSupportThread(detail.id, body),
      'Resposta enviada.',
    );
    if (sent) setDraft('');
  }

  return (
    <div className="platform-support">
      <header className="platform-support__heading">
        <div>
          <p className="page-kicker">Operacao centralizada</p>
          <h1 className="page-title">Central de Suporte</h1>
          <p className="page-lead">
            Atenda consultorias e empresas clientes sem sair do ProntEPI.
          </p>
        </div>
        <div className="platform-support__presence">
          <span aria-hidden="true" />
          {user.name} online
        </div>
      </header>

      <SupportMetrics overview={overview} loading={loading} />

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="success" role="status">
          {success}
        </p>
      ) : null}
      <p className="platform-support__sr-only" role="status">
        {announcement}
      </p>

      <section className="platform-support__workspace">
        <aside className="platform-support__queue" aria-label="Fila de suporte">
          <p className="platform-support__sr-only" role="status">
            {loading
              ? 'Atualizando fila de suporte.'
              : `${threads?.total ?? 0} conversas encontradas.`}
          </p>
          <form className="platform-support__filters" onSubmit={submitSearch}>
            <label>
              <span className="platform-support__sr-only">Estado</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(
                    event.target.value as PlatformSupportLifecycleStatus | '',
                  );
                  setPage(1);
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="platform-support__sr-only">Escopo</span>
              <select
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value as SupportScope | '');
                  setPage(1);
                }}
              >
                <option value="">Todos os niveis</option>
                <option value="CONSULTORIA">Consultorias</option>
                <option value="CLIENTE">Clientes</option>
              </select>
            </label>
            <div className="platform-support__search">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar consultoria, cliente ou pessoa"
                aria-label="Buscar na fila"
              />
              <button type="submit" className="btn btn-secondary">
                Buscar
              </button>
            </div>
          </form>

          <div className="platform-support__queue-list">
            {loading && !threads ? (
              <p className="muted">Carregando fila...</p>
            ) : null}
            {!loading && threads?.items.length === 0 ? (
              <div className="platform-support__empty">
                <strong>Nenhuma conversa neste filtro</strong>
                <span>A fila está organizada por tempo de espera.</span>
              </div>
            ) : null}
            {threads?.items.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                selected={thread.id === selectedId}
                onClick={() => {
                  selectedIdRef.current = thread.id;
                  detailRequestRef.current += 1;
                  setSelectedId(thread.id);
                  setDetail(null);
                  setDraft('');
                  setSuccess(null);
                }}
              />
            ))}
          </div>

          {threads && threads.totalPages > 1 ? (
            <div className="platform-support__pagination">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </button>
              <span>
                {page} de {threads.totalPages}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={page >= threads.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Proxima
              </button>
            </div>
          ) : null}
        </aside>

        <section
          className="platform-support__conversation"
          aria-label="Conversa selecionada"
          aria-busy={detailLoading}
        >
          {!selectedId ? (
            <div className="platform-support__empty platform-support__empty--large">
              <strong>Selecione uma conversa</strong>
              <span>O histórico e as ações aparecerão aqui.</span>
            </div>
          ) : detailLoading && !detail ? (
            <p className="muted">Abrindo conversa...</p>
          ) : detail ? (
            <>
              <ConversationHeader
                detail={detail}
                saving={saving}
                headingRef={conversationHeadingRef}
                onClaim={() =>
                  void runAction(
                    () => claimPlatformSupportThread(detail.id),
                    'Atendimento assumido.',
                  )
                }
                onResolve={() =>
                  void runAction(
                    () => resolvePlatformSupportThread(detail.id),
                    'Atendimento resolvido.',
                  )
                }
                onReturnAi={() =>
                  void runAction(
                    () => returnPlatformSupportThreadToAi(detail.id),
                    'Conversa devolvida ao agente.',
                  )
                }
              />
              <div
                className="platform-support__messages"
                aria-live="polite"
                aria-label="Mensagens da conversa"
              >
                {detail.messages.map((message) => (
                  <article
                    key={message.id}
                    className={`platform-support__message platform-support__message--${message.role}`}
                  >
                    <div>
                      <strong>{roleLabel(message.role)}</strong>
                      <time dateTime={message.createdAt}>
                        {formatDate(message.createdAt)}
                      </time>
                    </div>
                    <p>{message.body}</p>
                  </article>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form
                className="platform-support__reply"
                onSubmit={sendReply}
              >
                <label htmlFor="platform-support-reply">
                  Responder como equipe ProntEPI
                </label>
                <textarea
                  id="platform-support-reply"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  maxLength={4000}
                  disabled={
                    saving ||
                    detail.lifecycleStatus !== 'IN_PROGRESS' ||
                    detail.assignedTo?.id !== user.id
                  }
                  placeholder="Digite uma orientação clara para o solicitante..."
                />
                <div>
                  <span>{draft.length}/4000</span>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      saving ||
                      !draft.trim() ||
                      detail.lifecycleStatus !== 'IN_PROGRESS' ||
                      detail.assignedTo?.id !== user.id
                    }
                  >
                    {saving ? 'Enviando...' : 'Enviar resposta'}
                  </button>
                </div>
              </form>
            </>
          ) : null}
        </section>
      </section>
    </div>
  );
}

function SupportMetrics({
  overview,
  loading,
}: {
  overview: PlatformSupportOverview | null;
  loading: boolean;
}) {
  const metrics = [
    {
      label: 'Aguardando humano',
      value: overview?.totals.waitingHuman,
      detail: `Mais antiga: ${minutesLabel(overview?.performance.oldestWaitingMinutes ?? null)}`,
    },
    {
      label: 'Em atendimento',
      value: overview?.totals.inProgress,
      detail: 'Conversas assumidas',
    },
    {
      label: 'Tempo de 1ª resposta',
      value: minutesLabel(
        overview?.performance.averageFirstResponseMinutes ?? null,
      ),
      detail: 'Média histórica',
    },
    {
      label: 'Mensagens em 24h',
      value: overview?.totals.messagesLast24Hours,
      detail: `${overview?.totals.resolved ?? 0} atendimentos resolvidos`,
    },
  ];
  return (
    <section className="platform-support__metrics" aria-label="Indicadores">
      {metrics.map((metric) => (
        <article key={metric.label}>
          <span>{metric.label}</span>
          <strong>{loading && !overview ? '—' : (metric.value ?? 0)}</strong>
          <small>{metric.detail}</small>
        </article>
      ))}
    </section>
  );
}

function ThreadCard({
  thread,
  selected,
  onClick,
}: {
  thread: PlatformSupportThreadRow;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`platform-support__thread ${selected ? 'is-selected' : ''}`}
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
    >
      <div>
        <strong>{thread.requester?.name || 'Usuario não identificado'}</strong>
        <span
          className={`platform-support__status platform-support__status--${thread.lifecycleStatus.toLowerCase()}`}
        >
          {statusLabel(thread.lifecycleStatus)}
        </span>
      </div>
      <span>
        {thread.organization.name}
        {thread.servedClient ? ` · ${thread.servedClient.name}` : ''}
      </span>
      <p>{thread.lastMessage?.body || 'Conversa ainda sem mensagens.'}</p>
      <small>
        {thread.scope === 'CLIENTE' ? 'Cliente' : 'Consultoria'} ·{' '}
        {formatDate(thread.lastMessageAt || thread.updatedAt)}
      </small>
    </button>
  );
}

function ConversationHeader({
  detail,
  saving,
  headingRef,
  onClaim,
  onResolve,
  onReturnAi,
}: {
  detail: PlatformSupportThreadDetail;
  saving: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onClaim: () => void;
  onResolve: () => void;
  onReturnAi: () => void;
}) {
  return (
    <header className="platform-support__conversation-header">
      <div>
        <div className="platform-support__conversation-title">
          <h2 ref={headingRef} tabIndex={-1}>
            {detail.requester?.name || 'Usuario não identificado'}
          </h2>
          <span
            className={`platform-support__status platform-support__status--${detail.lifecycleStatus.toLowerCase()}`}
          >
            {statusLabel(detail.lifecycleStatus)}
          </span>
        </div>
        <p>
          {detail.organization.name}
          {detail.servedClient ? ` · ${detail.servedClient.name}` : ''}
          {' · '}
          {detail.requester?.email || 'sem e-mail'}
        </p>
      </div>
      <div className="platform-support__actions">
        {detail.lifecycleStatus === 'WAITING_HUMAN' ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={onClaim}
          >
            Assumir
          </button>
        ) : null}
        {detail.lifecycleStatus === 'IN_PROGRESS' ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={saving}
              onClick={onReturnAi}
            >
              Devolver à IA
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={onResolve}
            >
              Resolver
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
