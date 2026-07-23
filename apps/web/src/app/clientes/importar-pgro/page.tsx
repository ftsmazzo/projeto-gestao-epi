'use client';

import type {
  ConfirmPgroImportPayload,
  EpiNeed,
  OccupationalRiskCategory,
  PgroCompanyData,
  PgroExtractedEpiNeed,
  PgroExtractedFunction,
  PgroExtractedRisk,
  PgroExtractedSector,
  PgroImportConfirmSummary,
  PgroImportRun,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '../../../components/RequireAuth';
import { formatCnpj, formatCnpjInput } from '../../../lib/cnpj';
import { listEpiNeeds } from '../../../lib/epi-needs';
import { confirmPgroImport, previewPgroImport } from '../../../lib/pgro';

type Step =
  | 'upload'
  | 'empresa'
  | 'setores'
  | 'funcoes'
  | 'riscos'
  | 'epis'
  | 'revisao';

const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'setores', label: 'Setores' },
  { id: 'funcoes', label: 'Funcoes' },
  { id: 'riscos', label: 'Riscos' },
  { id: 'epis', label: 'EPIs' },
  { id: 'revisao', label: 'Revisao final' },
];

const RISK_CATEGORIES: { value: OccupationalRiskCategory; label: string }[] = [
  { value: 'FISICO', label: 'Fisico' },
  { value: 'QUIMICO', label: 'Quimico' },
  { value: 'BIOLOGICO', label: 'Biologico' },
  { value: 'ERGONOMICO', label: 'Ergonomico' },
  { value: 'MECANICO', label: 'Mecanico' },
  { value: 'ACIDENTE', label: 'Acidente' },
  { value: 'PSICOSSOCIAL', label: 'Psicossocial' },
  { value: 'OUTROS', label: 'Outros' },
];

function qualityBadge(item: {
  confidence?: 'high' | 'low';
  source?: string;
  extractionSource?: string;
  gheName?: string | null;
}) {
  const source = item.source ?? item.extractionSource;
  const confidence = item.confidence ?? 'high';
  return (
    <span className="epi-need-picker">
      {source === 'GHE' ? (
        <span className="status-pill status-pill--active">GHE</span>
      ) : (
        <span className="status-pill status-pill--info">Sugestao</span>
      )}
      {confidence === 'low' ? (
        <span className="status-pill status-pill--warn">Baixa confianca</span>
      ) : null}
      {item.gheName ? (
        <span className="table-sub">{item.gheName}</span>
      ) : null}
    </span>
  );
}

function emptyCompany(): PgroCompanyData {
  return {
    legalName: null,
    tradeName: null,
    cnpj: null,
    addressLine: null,
    city: null,
    state: null,
    cnae: null,
    riskGrade: null,
    employeeCount: null,
    rawText: null,
  };
}

function PgroImportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetClientId = searchParams.get('clientId');

  const [step, setStep] = useState<Step>('upload');
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [servedClientId, setServedClientId] = useState<string | null>(
    presetClientId,
  );
  const [company, setCompany] = useState<PgroCompanyData>(emptyCompany());
  const [allocatedLifeQuota, setAllocatedLifeQuota] = useState('0');
  const [sectors, setSectors] = useState<PgroExtractedSector[]>([]);
  const [functions, setFunctions] = useState<PgroExtractedFunction[]>([]);
  const [risks, setRisks] = useState<PgroExtractedRisk[]>([]);
  const [epiNeeds, setEpiNeeds] = useState<PgroExtractedEpiNeed[]>([]);
  const [catalogNeeds, setCatalogNeeds] = useState<EpiNeed[]>([]);
  const [summary, setSummary] = useState<PgroImportConfirmSummary | null>(null);

  useEffect(() => {
    void listEpiNeeds({ status: 'active' })
      .then(setCatalogNeeds)
      .catch(() => setCatalogNeeds([]));
  }, []);

  const extractionWarnings = useMemo(
    () => warnings.filter((w) => !w.startsWith('Ignorado:')),
    [warnings],
  );
  const ignoredWarnings = useMemo(
    () => warnings.filter((w) => w.startsWith('Ignorado:')),
    [warnings],
  );

  const highSectors = useMemo(
    () => sectors.filter((s) => (s.confidence ?? 'high') === 'high'),
    [sectors],
  );
  const lowSectors = useMemo(
    () => sectors.filter((s) => s.confidence === 'low'),
    [sectors],
  );
  const highFunctions = useMemo(
    () => functions.filter((f) => (f.confidence ?? 'high') === 'high'),
    [functions],
  );
  const lowFunctions = useMemo(
    () => functions.filter((f) => f.confidence === 'low'),
    [functions],
  );

  const includedCounts = useMemo(
    () => ({
      sectors: sectors.filter((s) => s.included).length,
      functions: functions.filter((f) => f.included).length,
      risks: risks.filter((r) => r.included).length,
      epis: epiNeeds.filter((e) => e.included).length,
    }),
    [sectors, functions, risks, epiNeeds],
  );

  function applyRun(run: PgroImportRun) {
    setRunId(run.id);
    setFileName(run.fileName);
    setServedClientId(run.servedClientId ?? presetClientId);
    setCompany(run.company ?? emptyCompany());
    setWarnings(run.warnings ?? []);
    setSectors(
      (run.sectors ?? []).map((item) => ({
        ...item,
        included: item.confidence === 'low' ? false : item.included !== false,
      })),
    );
    setFunctions(
      (run.functions ?? []).map((item) => ({
        ...item,
        included: item.confidence === 'low' ? false : item.included !== false,
      })),
    );
    setRisks(run.risks ?? []);
    setEpiNeeds(
      (run.epiNeeds ?? []).map((item) => ({
        ...item,
        included: item.confidence === 'low' ? false : item.included !== false,
      })),
    );
    if (run.status === 'FAILED') {
      setError(
        run.errorMessage ??
          'Este PDF parece nao ter texto extraivel. Use um PDF gerado digitalmente ou uma versao OCR.',
      );
      setStep('upload');
      return;
    }
    setError(null);
    setStep('empresa');
  }

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSummary(null);
    const form = event.currentTarget;
    const input = form.elements.namedItem('pgroFile') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setError('Selecione um arquivo PDF.');
      return;
    }
    setUploading(true);
    try {
      const run = await previewPgroImport({
        file,
        servedClientId: presetClientId,
      });
      applyRun(run);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao processar o PDF.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function onConfirm() {
    if (!runId) return;
    setConfirming(true);
    setError(null);
    try {
      const payload: ConfirmPgroImportPayload = {
        servedClientId,
        company: {
          legalName: company.legalName,
          tradeName: company.tradeName,
          cnpj: company.cnpj,
          allocatedLifeQuota: Number(allocatedLifeQuota) || 0,
        },
        sectors: sectors.map((s) => ({
          tempId: s.tempId,
          name: s.name,
          included: s.included,
        })),
        functions: functions.map((f) => ({
          tempId: f.tempId,
          name: f.name,
          sectorName: f.sectorName,
          activityDescription: f.activityDescription,
          environmentDescription: f.environmentDescription,
          included: f.included,
        })),
        risks: risks.map((r) => ({
          tempId: r.tempId,
          name: r.name,
          category: r.category,
          functionNames: r.functionNames,
          included: r.included,
        })),
        epiNeeds: epiNeeds.map((e) => ({
          tempId: e.tempId,
          suggestedName: e.suggestedName,
          matchedEpiNeedId: e.matchedEpiNeedId,
          createNew: e.createNew,
          functionNames: e.functionNames,
          riskNames: e.riskNames,
          included: e.included,
        })),
      };
      const result = await confirmPgroImport(runId, payload);
      setSummary(result.summary);
      setWarnings([
        ...(result.warnings ?? []),
        ...(result.confirmWarnings ?? []),
      ]);
      router.push(
        `/clientes/${result.summary.servedClientId}/estrutura?pgro=${result.id}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel confirmar a implantacao.',
      );
    } finally {
      setConfirming(false);
    }
  }

  function goNext() {
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx >= 0 && idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1].id);
    }
  }

  function goPrev() {
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx > 0) setStep(STEPS[idx - 1].id);
  }

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Importacao assistida</p>
          <h1 className="page-title">Importar PGRO / PGR</h1>
          <p className="page-lead">
            Envie o PDF, revise os dados extraidos em blocos e confirme a
            implantacao. Nada e gravado apenas pelo upload.
          </p>
        </div>
        <div className="header-actions header-actions--wrap">
          <Link
            className="btn btn-secondary"
            href={
              presetClientId
                ? `/clientes/${presetClientId}/estrutura`
                : '/clientes'
            }
          >
            Voltar
          </Link>
        </div>
      </header>

      <div className="panel-tabs" role="tablist" aria-label="Etapas">
        {STEPS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className={`panel-tab ${step === item.id ? 'is-active' : ''}`}
            aria-selected={step === item.id}
            disabled={!runId && item.id !== 'upload'}
            onClick={() => {
              if (runId || item.id === 'upload') setStep(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {extractionWarnings.length > 0 && step !== 'upload' ? (
        <section className="surface" aria-label="Avisos">
          <p className="page-kicker">Avisos da extracao</p>
          <ul>
            {extractionWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          {ignoredWarnings.length > 0 ? (
            <details style={{ marginTop: '0.75rem' }}>
              <summary>
                {ignoredWarnings.length} item(ns) ignorados por baixa confianca
              </summary>
              <ul>
                {ignoredWarnings.slice(0, 30).map((warning) => (
                  <li key={warning}>{warning.replace(/^Ignorado:\s*/, '')}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      {step === 'upload' ? (
        <section className="surface" aria-labelledby="upload-title">
          <h2 id="upload-title" className="page-title page-title--sm">
            Upload do PDF
          </h2>
          <p className="page-lead">
            Use um PDF gerado digitalmente (ex.: exportado do Word). PDFs
            escaneados sem OCR nao serao lidos nesta etapa.
          </p>
          {presetClientId ? (
            <p className="field-hint">
              A importacao sera vinculada ao cliente ja selecionado.
            </p>
          ) : null}
          <form className="form" onSubmit={onUpload}>
            <div className="field">
              <label htmlFor="pgroFile">Arquivo PDF</label>
              <input
                id="pgroFile"
                name="pgroFile"
                type="file"
                accept="application/pdf,.pdf"
                required
              />
            </div>
            <div className="btn-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={uploading}
              >
                {uploading ? 'Extraindo...' : 'Analisar PDF'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {step === 'empresa' ? (
        <section className="surface">
          <h2 className="page-title page-title--sm">Dados da empresa</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="legalName">Razao social</label>
              <input
                id="legalName"
                value={company.legalName ?? ''}
                onChange={(e) =>
                  setCompany((prev) => ({
                    ...prev,
                    legalName: e.target.value || null,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="tradeName">Nome fantasia</label>
              <input
                id="tradeName"
                value={company.tradeName ?? ''}
                onChange={(e) =>
                  setCompany((prev) => ({
                    ...prev,
                    tradeName: e.target.value || null,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="cnpj">CNPJ</label>
              <input
                id="cnpj"
                value={company.cnpj ? formatCnpj(company.cnpj) : ''}
                onChange={(e) =>
                  setCompany((prev) => ({
                    ...prev,
                    cnpj: formatCnpjInput(e.target.value) || null,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="city">Municipio</label>
              <input
                id="city"
                value={company.city ?? ''}
                onChange={(e) =>
                  setCompany((prev) => ({
                    ...prev,
                    city: e.target.value || null,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="state">UF</label>
              <input
                id="state"
                value={company.state ?? ''}
                onChange={(e) =>
                  setCompany((prev) => ({
                    ...prev,
                    state: e.target.value || null,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="cnae">CNAE</label>
              <input
                id="cnae"
                value={company.cnae ?? ''}
                onChange={(e) =>
                  setCompany((prev) => ({
                    ...prev,
                    cnae: e.target.value || null,
                  }))
                }
              />
            </div>
            {!servedClientId ? (
              <div className="field">
                <label htmlFor="quota">Cota de vidas (novo cliente)</label>
                <input
                  id="quota"
                  type="number"
                  min={0}
                  value={allocatedLifeQuota}
                  onChange={(e) => setAllocatedLifeQuota(e.target.value)}
                />
              </div>
            ) : null}
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={goPrev}>
              Voltar
            </button>
            <button type="button" className="btn btn-primary" onClick={goNext}>
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {step === 'setores' ? (
        <ReviewList
          title="Setores encontrados"
          empty="Nenhum setor extraido. Voce pode seguir e criar depois na estrutura."
          items={highSectors}
          lowItems={lowSectors}
          onToggle={(tempId) =>
            setSectors((prev) =>
              prev.map((item) =>
                item.tempId === tempId
                  ? { ...item, included: !item.included }
                  : item,
              ),
            )
          }
          onRename={(tempId, name) =>
            setSectors((prev) =>
              prev.map((item) =>
                item.tempId === tempId ? { ...item, name } : item,
              ),
            )
          }
          onPrev={goPrev}
          onNext={goNext}
        />
      ) : null}

      {step === 'funcoes' ? (
        <section className="surface">
          <h2 className="page-title page-title--sm">Funcoes encontradas</h2>
          {functions.length === 0 ? (
            <p className="page-lead">Nenhuma funcao extraida com confianca.</p>
          ) : (
            <>
              <FunctionTable
                items={highFunctions}
                onToggle={(tempId) =>
                  setFunctions((prev) =>
                    prev.map((row) =>
                      row.tempId === tempId
                        ? { ...row, included: !row.included }
                        : row,
                    ),
                  )
                }
                onRename={(tempId, name) =>
                  setFunctions((prev) =>
                    prev.map((row) =>
                      row.tempId === tempId ? { ...row, name } : row,
                    ),
                  )
                }
                onSector={(tempId, sectorName) =>
                  setFunctions((prev) =>
                    prev.map((row) =>
                      row.tempId === tempId
                        ? { ...row, sectorName: sectorName || null }
                        : row,
                    ),
                  )
                }
              />
              {lowFunctions.length > 0 ? (
                <div style={{ marginTop: '1rem' }}>
                  <p className="page-kicker">Revisar / ignorar (baixa confianca)</p>
                  <FunctionTable
                    items={lowFunctions}
                    onToggle={(tempId) =>
                      setFunctions((prev) =>
                        prev.map((row) =>
                          row.tempId === tempId
                            ? { ...row, included: !row.included }
                            : row,
                        ),
                      )
                    }
                    onRename={(tempId, name) =>
                      setFunctions((prev) =>
                        prev.map((row) =>
                          row.tempId === tempId ? { ...row, name } : row,
                        ),
                      )
                    }
                    onSector={(tempId, sectorName) =>
                      setFunctions((prev) =>
                        prev.map((row) =>
                          row.tempId === tempId
                            ? { ...row, sectorName: sectorName || null }
                            : row,
                        ),
                      )
                    }
                  />
                </div>
              ) : null}
            </>
          )}
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={goPrev}>
              Voltar
            </button>
            <button type="button" className="btn btn-primary" onClick={goNext}>
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {step === 'riscos' ? (
        <section className="surface">
          <h2 className="page-title page-title--sm">Riscos encontrados</h2>
          {risks.length === 0 ? (
            <p className="page-lead">Nenhum risco extraido.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Incluir</th>
                    <th scope="col">Risco</th>
                    <th scope="col">Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((item) => (
                    <tr key={item.tempId}>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.included}
                          onChange={() =>
                            setRisks((prev) =>
                              prev.map((row) =>
                                row.tempId === item.tempId
                                  ? { ...row, included: !row.included }
                                  : row,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={item.name}
                          onChange={(e) =>
                            setRisks((prev) =>
                              prev.map((row) =>
                                row.tempId === item.tempId
                                  ? { ...row, name: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={item.category}
                          onChange={(e) =>
                            setRisks((prev) =>
                              prev.map((row) =>
                                row.tempId === item.tempId
                                  ? {
                                      ...row,
                                      category: e.target
                                        .value as OccupationalRiskCategory,
                                    }
                                  : row,
                              ),
                            )
                          }
                        >
                          {RISK_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={goPrev}>
              Voltar
            </button>
            <button type="button" className="btn btn-primary" onClick={goNext}>
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {step === 'epis' ? (
        <section className="surface">
          <h2 className="page-title page-title--sm">
            EPIs necessarios encontrados
          </h2>
          <p className="page-lead">
            O PGRO sugere necessidades de EPI (nao cria estoque nem EPI com
            CA).
          </p>
          {epiNeeds.length === 0 ? (
            <p className="page-lead">
              Nenhum EPI identificado. Voce ainda pode importar setores,
              funcoes e riscos.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Incluir</th>
                    <th scope="col">Texto / sugestao</th>
                    <th scope="col">Necessidade</th>
                    <th scope="col">Criar nova</th>
                  </tr>
                </thead>
                <tbody>
                  {epiNeeds.map((item) => (
                    <tr key={item.tempId}>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.included}
                          onChange={() =>
                            setEpiNeeds((prev) =>
                              prev.map((row) =>
                                row.tempId === item.tempId
                                  ? { ...row, included: !row.included }
                                  : row,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <strong>{item.extractedText}</strong>
                        <span className="table-sub">{item.suggestedName}</span>
                      </td>
                      <td>
                        <select
                          value={item.matchedEpiNeedId ?? ''}
                          onChange={(e) => {
                            const id = e.target.value || null;
                            const match = catalogNeeds.find((n) => n.id === id);
                            setEpiNeeds((prev) =>
                              prev.map((row) =>
                                row.tempId === item.tempId
                                  ? {
                                      ...row,
                                      matchedEpiNeedId: id,
                                      matchedEpiNeedName: match?.name ?? null,
                                      createNew: !id,
                                      suggestedName:
                                        match?.name ?? row.suggestedName,
                                    }
                                  : row,
                              ),
                            );
                          }}
                        >
                          <option value="">Criar / usar sugestao</option>
                          {catalogNeeds.map((need) => (
                            <option key={need.id} value={need.id}>
                              {need.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.createNew}
                          disabled={!!item.matchedEpiNeedId}
                          onChange={() =>
                            setEpiNeeds((prev) =>
                              prev.map((row) =>
                                row.tempId === item.tempId
                                  ? { ...row, createNew: !row.createNew }
                                  : row,
                              ),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={goPrev}>
              Voltar
            </button>
            <button type="button" className="btn btn-primary" onClick={goNext}>
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {step === 'revisao' ? (
        <section className="surface">
          <h2 className="page-title page-title--sm">Revisao final</h2>
          <p className="page-lead">
            Arquivo: {fileName || '—'}. Confira os totais antes de gravar.
          </p>
          <section className="quota-summary" aria-label="Resumo">
            <div className="quota-summary-item">
              <span className="quota-summary-label">Setores</span>
              <strong className="quota-summary-value">
                {includedCounts.sectors}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Funcoes</span>
              <strong className="quota-summary-value">
                {includedCounts.functions}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">Riscos</span>
              <strong className="quota-summary-value">
                {includedCounts.risks}
              </strong>
            </div>
            <div className="quota-summary-item">
              <span className="quota-summary-label">EPIs</span>
              <strong className="quota-summary-value">
                {includedCounts.epis}
              </strong>
            </div>
          </section>
          <dl className="meta-list" style={{ marginTop: '1rem' }}>
            <div>
              <dt>Empresa</dt>
              <dd>{company.legalName || '—'}</dd>
            </div>
            <div>
              <dt>CNPJ</dt>
              <dd className="mono">
                {company.cnpj ? formatCnpj(company.cnpj) : '—'}
              </dd>
            </div>
          </dl>
          {summary ? (
            <p className="field-hint">
              Ultima confirmacao: cliente {summary.servedClientId}.
            </p>
          ) : null}
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={goPrev}>
              Voltar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={confirming}
              onClick={() => void onConfirm()}
            >
              {confirming ? 'Confirmando...' : 'Confirmar implantacao'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ReviewList({
  title,
  empty,
  items,
  lowItems = [],
  onToggle,
  onRename,
  onPrev,
  onNext,
}: {
  title: string;
  empty: string;
  items: PgroExtractedSector[];
  lowItems?: PgroExtractedSector[];
  onToggle: (tempId: string) => void;
  onRename: (tempId: string, name: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  function renderRows(rows: PgroExtractedSector[]) {
    return rows.map((item) => (
      <tr key={item.tempId}>
        <td>
          <input
            type="checkbox"
            checked={item.included}
            onChange={() => onToggle(item.tempId)}
          />
        </td>
        <td>
          <input
            value={item.name}
            onChange={(e) => onRename(item.tempId, e.target.value)}
          />
          {qualityBadge(item)}
        </td>
        <td>
          <span className="table-sub">{item.rawText}</span>
        </td>
      </tr>
    ));
  }

  return (
    <section className="surface">
      <h2 className="page-title page-title--sm">{title}</h2>
      {items.length === 0 && lowItems.length === 0 ? (
        <p className="page-lead">{empty}</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Incluir</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Original</th>
                </tr>
              </thead>
              <tbody>{renderRows(items)}</tbody>
            </table>
          </div>
          {lowItems.length > 0 ? (
            <div style={{ marginTop: '1rem' }}>
              <p className="page-kicker">Revisar / ignorar (baixa confianca)</p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Incluir</th>
                      <th scope="col">Nome</th>
                      <th scope="col">Original</th>
                    </tr>
                  </thead>
                  <tbody>{renderRows(lowItems)}</tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}
      <div className="btn-row">
        <button type="button" className="btn btn-secondary" onClick={onPrev}>
          Voltar
        </button>
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Continuar
        </button>
      </div>
    </section>
  );
}

function FunctionTable({
  items,
  onToggle,
  onRename,
  onSector,
}: {
  items: PgroExtractedFunction[];
  onToggle: (tempId: string) => void;
  onRename: (tempId: string, name: string) => void;
  onSector: (tempId: string, sectorName: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Incluir</th>
            <th scope="col">Funcao</th>
            <th scope="col">Setor</th>
            <th scope="col">Origem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.tempId}>
              <td>
                <input
                  type="checkbox"
                  checked={item.included}
                  onChange={() => onToggle(item.tempId)}
                />
              </td>
              <td>
                <input
                  value={item.name}
                  onChange={(e) => onRename(item.tempId, e.target.value)}
                />
              </td>
              <td>
                <input
                  value={item.sectorName ?? ''}
                  onChange={(e) => onSector(item.tempId, e.target.value)}
                />
              </td>
              <td>{qualityBadge(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PgroImportPage() {
  return (
    <RequireAuth>
      {() => (
        <Suspense fallback={<p className="page-lead">Carregando...</p>}>
          <PgroImportContent />
        </Suspense>
      )}
    </RequireAuth>
  );
}
