'use client';

import type {
  ClientPortalUser,
  SstClientProfile,
  SstDocumentListItem,
  SstDocumentSendResult,
  SstDocumentType,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import {
  createPortalSstDocument,
  deletePortalSstCompanyLogo,
  downloadPortalSstDocumentPdf,
  fetchPortalSstCompanyLogoObjectUrl,
  fetchPortalSstDocuments,
  fetchPortalSstProfile,
  fetchPortalTrabalhadores,
  resendPortalSstDocumentLink,
  savePortalSstProfile,
  uploadPortalSstCompanyLogo,
} from '../../../lib/client-auth';
import { formatCpf, stripCpf } from '../../../lib/cpf';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return iso;
  }
}

function matchesIssuedFilter(row: SstDocumentListItem, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (row.workerName.toLowerCase().includes(needle)) return true;
  const digits = stripCpf(needle);
  const cpf = stripCpf(row.workerCpf ?? '');
  return Boolean(digits && cpf.includes(digits));
}

function PortalSstContent() {
  const [docs, setDocs] = useState<SstDocumentListItem[]>([]);
  const [workers, setWorkers] = useState<
    Array<{
      id: string;
      name: string;
      jobFunctionName: string | null;
      hasValidBiometrics: boolean;
      status: string;
    }>
  >([]);
  const [profile, setProfile] = useState<SstClientProfile | null>(null);
  const [workerId, setWorkerId] = useState('');
  const [type, setType] = useState<SstDocumentType>('INTEGRACAO');
  const [documentDate, setDocumentDate] = useState('');
  const [issuedFilter, setIssuedFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, trab, prof] = await Promise.all([
        fetchPortalSstDocuments(),
        fetchPortalTrabalhadores(),
        fetchPortalSstProfile(),
      ]);
      setDocs(list.documents);
      setWorkers(
        trab.workers.filter((w) => w.status === 'ACTIVE').map((w) => ({
          id: w.id,
          name: w.name,
          jobFunctionName: w.jobFunctionName,
          hasValidBiometrics: w.hasValidBiometrics,
          status: w.status,
        })),
      );
      setProfile(prof);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Nao foi possivel carregar.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!profile?.hasLogo) {
      setLogoPreview(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void fetchPortalSstCompanyLogoObjectUrl().then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setLogoPreview(url);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile?.hasLogo]);

  const selected = useMemo(
    () => workers.find((w) => w.id === workerId) ?? null,
    [workers, workerId],
  );

  const issuedDocs = useMemo(
    () => docs.filter((row) => matchesIssuedFilter(row, issuedFilter)),
    [docs, issuedFilter],
  );

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!workerId) {
      setError('Selecione o trabalhador.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await createPortalSstDocument({
        workerId,
        type,
        documentDate: documentDate || undefined,
      });
      applySend(result);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar.');
    } finally {
      setSaving(false);
    }
  }

  function applySend(result: SstDocumentSendResult) {
    setLastUrl(result.url);
    setNotice(result.notice);
  }

  async function onResend(id: string) {
    setSaving(true);
    setError(null);
    try {
      const result = await resendPortalSstDocumentLink(id);
      applySend(result);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao reenviar.');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const { hasLogo: _hasLogo, ...rest } = profile;
      const next = await savePortalSstProfile(rest);
      setProfile(next);
      setNotice('Dados da empresa salvos para os proximos documentos.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function onUploadLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem(
      'sst-logo-file',
    ) as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setError('Selecione o logo da empresa.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await uploadPortalSstCompanyLogo(file);
      setProfile((prev) => (prev ? { ...prev, hasLogo: true } : prev));
      setNotice('Logo da empresa salvo. Ele aparece a direita na O.S.');
      if (input) input.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar logo.');
    } finally {
      setSaving(false);
    }
  }

  async function onRemoveLogo() {
    setSaving(true);
    setError(null);
    try {
      await deletePortalSstCompanyLogo();
      setProfile((prev) => (prev ? { ...prev, hasLogo: false } : prev));
      setNotice('Logo da empresa removido.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover logo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Painel do Cliente</p>
          <h1 className="page-title">Documentos SST</h1>
          <p className="page-lead">
            Gera Integracao e Ordem de Servico com os dados do PGR, envia o
            link no WhatsApp e o trabalhador confirma com a face.
          </p>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="notice notice--info" role="status">
          {notice}
          {lastUrl ? (
            <>
              {' '}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void navigator.clipboard.writeText(lastUrl)}
              >
                Copiar link
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      <section className="surface" aria-labelledby="sst-new-title">
        <h2 id="sst-new-title" className="page-title page-title--sm">
          Novo documento
        </h2>
        <form className="form" onSubmit={(e) => void onCreate(e)}>
          <div className="field">
            <label htmlFor="sst-worker">Trabalhador</label>
            <select
              id="sst-worker"
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              required
            >
              <option value="">Selecione</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.jobFunctionName ? ` · ${w.jobFunctionName}` : ''}
                  {w.hasValidBiometrics ? '' : ' · sem face'}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sst-type">Tipo</label>
            <select
              id="sst-type"
              value={type}
              onChange={(e) => setType(e.target.value as SstDocumentType)}
            >
              <option value="INTEGRACAO">Integracao de SST</option>
              <option value="ORDEM_SERVICO">Ordem de Servico</option>
            </select>
          </div>
          {selected && !selected.hasValidBiometrics ? (
            <p className="field-hint">
              Cadastre a face deste trabalhador em Trabalhadores antes de
              enviar.
            </p>
          ) : null}
          {type === 'ORDEM_SERVICO' && selected && !selected.jobFunctionName ? (
            <p className="field-hint">
              Vincule uma funcao ao trabalhador para montar a O.S. com riscos e
              EPIs do PGR.
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="sst-document-date">
              Data em que o documento SST foi feito
            </label>
            <input
              id="sst-document-date"
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
            />
            <p className="field-hint">
              Se preencher, esta data entra no documento. Se deixar vazio, usa
              a data automatica do sistema.
            </p>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Gerando...' : 'Gerar e enviar link'}
          </button>
        </form>
      </section>

      <section className="surface" aria-labelledby="sst-list-title">
        <div className="field">
          <label htmlFor="sst-issued-filter">Filtrar por CPF ou nome</label>
          <input
            id="sst-issued-filter"
            value={issuedFilter}
            onChange={(e) => setIssuedFilter(e.target.value)}
            placeholder="Nome ou CPF do trabalhador"
          />
        </div>
        <h2 id="sst-list-title" className="page-title page-title--sm">
          Emitidos
        </h2>
        {loading ? (
          <p className="page-lead">Carregando...</p>
        ) : docs.length === 0 ? (
          <p className="page-lead">Nenhum documento ainda.</p>
        ) : issuedDocs.length === 0 ? (
          <p className="page-lead">Nenhum documento com esse filtro.</p>
        ) : (
          <div className="stack-list" role="list">
            {issuedDocs.map((row) => (
              <article key={row.id} className="stack-card" role="listitem">
                <div className="stack-card__body stack-card__body--stack">
                  <div className="stack-card__main">
                    <strong className="stack-card__title">{row.title}</strong>
                    <p className="stack-card__meta">
                      {row.workerName}
                      {row.workerCpf
                        ? ` · ${formatCpf(row.workerCpf)}`
                        : ''}
                    </p>
                    <p className="stack-card__meta">
                      {row.statusLabel} · {formatDate(row.generatedAt)}
                    </p>
                  </div>
                  <div className="stack-card__actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void downloadPortalSstDocumentPdf(row.id)}
                    >
                      PDF
                    </button>
                    {row.status === 'PENDING_SIGNATURE' ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={saving}
                        onClick={() => void onResend(row.id)}
                      >
                        Reenviar link
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {profile ? (
        <section className="surface" aria-labelledby="sst-profile-title">
          <h2 id="sst-profile-title" className="page-title page-title--sm">
            Dados da empresa nestes documentos
          </h2>
          <p className="page-lead">
            Opcional. Nao altera o cadastro do cliente — so o texto da
            integracao e da O.S.
          </p>
          <form className="form" onSubmit={(e) => void onSaveProfile(e)}>
            <div className="field">
              <label htmlFor="sst-tech">Responsavel tecnico</label>
              <input
                id="sst-tech"
                value={profile.technicalResponsibleName}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    technicalResponsibleName: e.target.value,
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="sst-reg">Registro MTE</label>
              <input
                id="sst-reg"
                value={profile.technicalResponsibleRegistry}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    technicalResponsibleRegistry: e.target.value,
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="sst-city">Cidade</label>
              <input
                id="sst-city"
                value={profile.city}
                onChange={(e) =>
                  setProfile({ ...profile, city: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="sst-time">Horario da integracao</label>
              <input
                id="sst-time"
                value={profile.integrationTime}
                onChange={(e) =>
                  setProfile({ ...profile, integrationTime: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="sst-hours">Duracao (horas)</label>
              <input
                id="sst-hours"
                type="number"
                min={1}
                max={24}
                value={profile.integrationDurationHours}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    integrationDurationHours: Number(e.target.value) || 2,
                  })
                }
              />
            </div>
            <button className="btn btn-secondary" type="submit" disabled={saving}>
              Salvar dados
            </button>
          </form>
          <form className="form" onSubmit={(e) => void onUploadLogo(e)}>
            <p className="page-lead">
              Logo da empresa (direita do cabecalho). A esquerda fica o logo
              da consultoria, ja enviado em Configuracoes.
            </p>
            {logoPreview ? (
              <p>
                <img
                  src={logoPreview}
                  alt="Logo da empresa"
                  style={{ maxHeight: 64, maxWidth: 160 }}
                />
              </p>
            ) : null}
            <div className="field">
              <label htmlFor="sst-logo-file">Arquivo (PNG, JPG ou WEBP)</label>
              <input
                id="sst-logo-file"
                name="sst-logo-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
              />
            </div>
            <div className="btn-row">
              <button className="btn btn-secondary" type="submit" disabled={saving}>
                Enviar logo
              </button>
              {profile.hasLogo ? (
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={saving}
                  onClick={() => void onRemoveLogo()}
                >
                  Remover logo
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

export default function PortalDocumentosSstPage() {
  return (
    <RequireClientAuth>
      {(user) =>
        user.servedClient.sstDocumentsEnabled ? (
          <PortalSstContent />
        ) : (
          <SstModuleLocked user={user} />
        )
      }
    </RequireClientAuth>
  );
}

function SstModuleLocked({ user }: { user: ClientPortalUser }) {
  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Painel do Cliente</p>
          <h1 className="page-title">Documentos SST</h1>
          <p className="page-lead">
            Este modulo nao esta liberado para{' '}
            {user.servedClient.tradeName || user.servedClient.legalName}. A
            consultoria precisa ativar a chave no cadastro do cliente.
          </p>
        </div>
      </header>
      <Link className="btn btn-secondary" href="/portal">
        Voltar ao painel
      </Link>
    </div>
  );
}
