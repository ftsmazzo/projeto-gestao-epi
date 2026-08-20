'use client';

import type {
  ServedClient,
  TrainingDeliveryKind,
  TrainingTemplate,
  WorkerListItem,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '../../../components/RequireAuth';
import { PageHeader } from '../../../components/ui/PageHeader';
import { listServedClients } from '../../../lib/served-clients';
import {
  fetchTrainingGenerationDefaults,
  generateTrainingPdf,
  listTrainingTemplates,
} from '../../../lib/training';
import { listWorkers } from '../../../lib/workers';
import { formatCpfInput, stripCpf } from '../../../lib/cpf';

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function GerarContent() {
  const searchParams = useSearchParams();
  const preset = searchParams.get('modelo');
  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);
  const [clients, setClients] = useState<ServedClient[]>([]);
  const [workers, setWorkers] = useState<WorkerListItem[]>([]);
  const [templateId, setTemplateId] = useState(preset ?? '');
  const [clientId, setClientId] = useState('');
  const [query, setQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [selected, setSelected] = useState<string[]>([]);
  const [heldOn, setHeldOn] = useState(todayIso);
  const [hours, setHours] = useState('8');
  const [location, setLocation] = useState('Sala de Treinamento');
  const [address, setAddress] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [instructorRole, setInstructorRole] = useState('');
  const [instructorRegistry, setInstructorRegistry] = useState('');
  const [legalRepName, setLegalRepName] = useState('');
  const [deliveryKind, setDeliveryKind] =
    useState<TrainingDeliveryKind>('INTERNO');
  const [controlNumber, setControlNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const template = useMemo(
    () => templates.find((row) => row.id === templateId) ?? null,
    [templates, templateId],
  );

  const filteredWorkers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const digits = stripCpf(needle);
    return workers.filter((worker) => {
      if (worker.status !== 'ACTIVE') return false;
      if (unitFilter && worker.unitName !== unitFilter) return false;
      if (sectorFilter && worker.sectorName !== sectorFilter) return false;
      if (
        jobFilter &&
        (worker.jobFunctionName || worker.role || '') !== jobFilter
      ) {
        return false;
      }
      if (!needle) return true;
      if (worker.name.toLowerCase().includes(needle)) return true;
      const cpf = stripCpf(worker.cpf ?? '');
      return Boolean(digits && cpf.includes(digits));
    });
  }, [workers, query, unitFilter, sectorFilter, jobFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredWorkers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedWorkers = filteredWorkers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const unitOptions = useMemo(
    () =>
      [...new Set(workers.map((w) => w.unitName).filter(Boolean))].sort((a, b) =>
        (a ?? '').localeCompare(b ?? '', 'pt-BR'),
      ) as string[],
    [workers],
  );
  const sectorOptions = useMemo(
    () =>
      [...new Set(workers.map((w) => w.sectorName).filter(Boolean))].sort(
        (a, b) => (a ?? '').localeCompare(b ?? '', 'pt-BR'),
      ) as string[],
    [workers],
  );
  const jobOptions = useMemo(
    () =>
      [
        ...new Set(
          workers
            .map((w) => w.jobFunctionName || w.role)
            .filter((value): value is string => Boolean(value?.trim())),
        ),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [workers],
  );

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [tpl, cli] = await Promise.all([
        listTrainingTemplates(),
        listServedClients(),
      ]);
      const active = tpl.templates.filter((row) => row.isActive);
      setTemplates(active);
      setClients(cli.filter((row) => row.status === 'ACTIVE'));
      setTemplateId((current) => {
        if (current && active.some((row) => row.id === current)) return current;
        if (preset && active.some((row) => row.id === preset)) return preset;
        return active[0]?.id ?? '';
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!template) return;
    setHours(String(template.defaultHours));
    setLocation(template.defaultLocation);
    setInstructorName(template.instructorName);
    setInstructorRole(template.instructorRole);
    setInstructorRegistry(template.instructorRegistry);
  }, [template]);

  useEffect(() => {
    if (!clientId) {
      setWorkers([]);
      setSelected([]);
      return;
    }
    let cancelled = false;
    void Promise.all([
      listWorkers(clientId),
      fetchTrainingGenerationDefaults(clientId),
    ])
      .then(([list, defaults]) => {
        if (cancelled) return;
        setWorkers(list);
        setAddress(defaults.address);
        setLegalRepName(defaults.legalName);
        if (defaults.location) setLocation(defaults.location);
        setSelected([]);
        setQuery('');
        setUnitFilter('');
        setSectorFilter('');
        setJobFilter('');
        setPage(1);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Falha ao carregar trabalhadores.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function toggleWorker(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function togglePage() {
    const ids = pagedWorkers.map((row) => row.id);
    const allOn = ids.every((id) => selected.includes(id));
    setSelected((prev) =>
      allOn
        ? prev.filter((id) => !ids.includes(id))
        : [...new Set([...prev, ...ids])],
    );
  }

  function toggleFiltered() {
    const ids = filteredWorkers.map((row) => row.id);
    const allOn = ids.every((id) => selected.includes(id));
    setSelected((prev) =>
      allOn
        ? prev.filter((id) => !ids.includes(id))
        : [...new Set([...prev, ...ids])],
    );
  }

  async function onGenerate(event: FormEvent) {
    event.preventDefault();
    if (!templateId) {
      setError('Escolha o modelo.');
      return;
    }
    if (!clientId) {
      setError('Escolha o cliente.');
      return;
    }
    if (selected.length === 0) {
      setError('Marque ao menos um trabalhador.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await generateTrainingPdf(templateId, {
        servedClientId: clientId,
        workerIds: selected,
        heldOn,
        hours: Number(hours) || 8,
        location,
        address,
        instructorName,
        instructorRole,
        instructorRegistry,
        legalRepName,
        deliveryKind,
        controlNumber: controlNumber || undefined,
      });
      setNotice(
        `PDF gerado para ${selected.length} trabalhador(es). Confira o download para impressao.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar o PDF.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-page">
      <PageHeader
        kicker="Consultoria"
        title="Gerar certificado"
        lead="Escolha o modelo, o cliente e os trabalhadores. O PDF sai em A4, um diploma por vida e o registro da turma."
        actions={
          <Link className="btn btn-secondary" href="/certificados">
            Modelos
          </Link>
        }
      />

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="notice notice--ok" role="status">
          {notice}
        </p>
      ) : null}

      <form className="form" onSubmit={(e) => void onGenerate(e)}>
        <section className="surface">
          <h2 className="page-title page-title--sm">Turma</h2>
          <div className="field">
            <label htmlFor="gen-template">Modelo</label>
            <select
              id="gen-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={loading}
              required
            >
              <option value="">Selecione</option>
              {templates.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="gen-client">Cliente</label>
            <select
              id="gen-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="">Selecione o CNPJ</option>
              {clients.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.tradeName || row.legalName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="gen-date">Data da realizacao</label>
            <input
              id="gen-date"
              type="date"
              value={heldOn}
              onChange={(e) => setHeldOn(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="gen-hours">Carga horaria</label>
            <input
              id="gen-hours"
              type="number"
              min={1}
              max={80}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="gen-local">Local</label>
            <input
              id="gen-local"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="gen-address">Endereco da empresa (automatico)</label>
            <input
              id="gen-address"
              value={address}
              readOnly
              placeholder="Cadastrado na unidade operacional do cliente"
            />
          </div>
          <div className="field">
            <label htmlFor="gen-kind">Tipo</label>
            <select
              id="gen-kind"
              value={deliveryKind}
              onChange={(e) =>
                setDeliveryKind(e.target.value as TrainingDeliveryKind)
              }
            >
              <option value="INTERNO">Interno</option>
              <option value="TLT">T.L.T.</option>
              <option value="EXTERNO">Externo</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="gen-inst">Instrutor</label>
            <input
              id="gen-inst"
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="gen-role">Cargo do instrutor</label>
            <input
              id="gen-role"
              value={instructorRole}
              onChange={(e) => setInstructorRole(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="gen-mtb">Registro MTE / MTB</label>
            <input
              id="gen-mtb"
              value={instructorRegistry}
              onChange={(e) => setInstructorRegistry(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="gen-legal">Representante legal (razao social)</label>
            <input
              id="gen-legal"
              value={legalRepName}
              readOnly
              placeholder="Razao social do cliente"
            />
          </div>
          <div className="field">
            <label htmlFor="gen-ctrl">N. de controle (opcional)</label>
            <input
              id="gen-ctrl"
              value={controlNumber}
              onChange={(e) => setControlNumber(e.target.value)}
              placeholder="Gerado automaticamente se vazio"
            />
          </div>
        </section>

        <section className="surface">
          <h2 className="page-title page-title--sm">Trabalhadores</h2>
          {!clientId ? (
            <p className="page-lead">Escolha o cliente para listar as vidas.</p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="gen-q">Buscar por nome ou CPF</label>
                <input
                  id="gen-q"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Nome ou CPF"
                />
              </div>
              <div className="field">
                <label htmlFor="gen-unit">Unidade</label>
                <select
                  id="gen-unit"
                  value={unitFilter}
                  onChange={(e) => {
                    setUnitFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todas</option>
                  {unitOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="gen-sector">Setor</label>
                <select
                  id="gen-sector"
                  value={sectorFilter}
                  onChange={(e) => {
                    setSectorFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  {sectorOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="gen-job">Funcao</label>
                <select
                  id="gen-job"
                  value={jobFilter}
                  onChange={(e) => {
                    setJobFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todas</option>
                  {jobOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="btn-row">
                <button type="button" className="btn btn-secondary" onClick={togglePage}>
                  Marcar esta pagina
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={toggleFiltered}
                >
                  Marcar filtrados
                </button>
                <span className="field-hint">
                  {selected.length} selecionado(s) · {filteredWorkers.length} no
                  filtro · pagina {currentPage}/{pageCount}
                </span>
              </div>
              <div className="stack-list">
                {pagedWorkers.length === 0 ? (
                  <p className="page-lead">Nenhum trabalhador ativo neste filtro.</p>
                ) : (
                  pagedWorkers.map((worker) => (
                    <label key={worker.id} className="stack-card">
                      <div className="stack-card__body">
                        <input
                          type="checkbox"
                          checked={selected.includes(worker.id)}
                          onChange={() => toggleWorker(worker.id)}
                        />
                        <div className="stack-card__main">
                          <strong>{worker.name}</strong>
                          <p className="stack-card__meta">
                            {worker.jobFunctionName || worker.role || 'Sem funcao'}
                            {worker.sectorName ? ` · ${worker.sectorName}` : ''}
                            {worker.unitName ? ` · ${worker.unitName}` : ''}
                            {worker.cpf
                              ? ` · ${formatCpfInput(worker.cpf)}`
                              : ' · sem CPF'}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
              {pageCount > 1 ? (
                <div className="btn-row" style={{ marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <span className="field-hint">
                    {(currentPage - 1) * PAGE_SIZE + 1}-
                    {Math.min(currentPage * PAGE_SIZE, filteredWorkers.length)} de{' '}
                    {filteredWorkers.length}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    Proxima
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Gerando PDF...' : 'Gerar PDF para impressao'}
        </button>
      </form>
    </div>
  );
}

export default function GerarCertificadoPage() {
  return (
    <RequireAuth>
      {() => (
        <Suspense fallback={<p className="page-lead">Carregando...</p>}>
          <GerarContent />
        </Suspense>
      )}
    </RequireAuth>
  );
}
