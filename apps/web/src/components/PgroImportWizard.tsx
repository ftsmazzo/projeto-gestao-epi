'use client';

import type {
  ConfirmPgroImportPayload,
  EpiNeed,
  OccupationalRisk,
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
import { useRouter } from 'next/navigation';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { listOccupationalRisks } from '../lib/client-structure';
import { storeClientAccessOnce } from '../lib/client-access-session';
import { formatCnpj, formatCnpjInput } from '../lib/cnpj';
import { listEpiNeeds } from '../lib/epi-needs';
import { confirmPgroImport, previewPgroImport } from '../lib/pgro';
import { listOperationalUnits } from '../lib/operational-units';
import { getServedClient } from '../lib/served-clients';
import { WizardSteps } from './ui/WizardSteps';

function newManualId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

function qualityBadge(
  item: {
    confidence?: 'high' | 'low';
    source?: string;
    extractionSource?: string;
    gheName?: string | null;
  },
  options?: { showGheName?: boolean },
) {
  const source = item.source ?? item.extractionSource;
  const confidence = item.confidence ?? 'high';
  const showGheName = options?.showGheName !== false;
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
      {showGheName && item.gheName ? (
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

type PgroImportWizardProps = {
  /** Quando informado, opera no workspace do cliente (Atualizar PGR). */
  lockedClientId?: string;
  /** Esconde o cabecalho interno (a pagina ja explica o contexto). */
  hideHeader?: boolean;
  backHref?: string;
  backLabel?: string;
};

export function PgroImportWizard({
  lockedClientId,
  hideHeader = false,
  backHref,
  backLabel,
}: PgroImportWizardProps) {
  const router = useRouter();
  const isUpdateMode = !!lockedClientId;

  const [step, setStep] = useState<Step>('upload');
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parseMeta, setParseMeta] = useState<PgroImportRun['parseMeta']>(null);
  const [fileName, setFileName] = useState('');
  const [servedClientId, setServedClientId] = useState<string | null>(
    lockedClientId ?? null,
  );
  const [company, setCompany] = useState<PgroCompanyData>(emptyCompany());
  const [allocatedLifeQuota, setAllocatedLifeQuota] = useState('0');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [provisionManager, setProvisionManager] = useState(!isUpdateMode);
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [sectors, setSectors] = useState<PgroExtractedSector[]>([]);
  const [functions, setFunctions] = useState<PgroExtractedFunction[]>([]);
  const [risks, setRisks] = useState<PgroExtractedRisk[]>([]);
  const [epiNeeds, setEpiNeeds] = useState<PgroExtractedEpiNeed[]>([]);
  const [catalogNeeds, setCatalogNeeds] = useState<EpiNeed[]>([]);
  const [catalogRisks, setCatalogRisks] = useState<OccupationalRisk[]>([]);
  const [summary, setSummary] = useState<PgroImportConfirmSummary | null>(null);
  const [forceConfirmWeakCoverage, setForceConfirmWeakCoverage] =
    useState(false);

  useEffect(() => {
    if (!lockedClientId) return;
    void getServedClient(lockedClientId)
      .then((client) => {
        setContactEmail(client.contactEmail ?? '');
        setContactPhone(client.contactPhone ?? '');
      })
      .catch(() => {
        /* preview ainda preenche empresa; contato fica editavel */
      });
  }, [lockedClientId]);

  useEffect(() => {
    if (lockedClientId) setServedClientId(lockedClientId);
  }, [lockedClientId]);

  useEffect(() => {
    void listEpiNeeds({ status: 'active' })
      .then(setCatalogNeeds)
      .catch(() => setCatalogNeeds([]));
    void listOccupationalRisks({ status: 'active' })
      .then(setCatalogRisks)
      .catch(() => setCatalogRisks([]));
  }, []);

  const extractionWarnings = useMemo(
    () => warnings.filter((w) => !w.startsWith('Ignorado:')),
    [warnings],
  );
  const ignoredWarnings = useMemo(
    () => warnings.filter((w) => w.startsWith('Ignorado:')),
    [warnings],
  );

  const coverageIncomplete = useMemo(
    () =>
      parseMeta?.coverageOk === false ||
      (parseMeta?.gheHeaderCount != null &&
        parseMeta?.ghesWithFunctions != null &&
        parseMeta.ghesWithFunctions < parseMeta.gheHeaderCount),
    [parseMeta],
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
  const includedSectorNames = useMemo(
    () =>
      [
        ...new Set(
          [
            ...sectors.filter((s) => s.included).map((s) => s.name.trim()),
            ...functions
              .filter((f) => f.included && f.sectorName)
              .map((f) => f.sectorName!.trim()),
          ].filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [sectors, functions],
  );
  const includedFunctionNames = useMemo(
    () =>
      functions
        .filter((f) => f.included)
        .map((f) => f.name.trim())
        .filter(Boolean),
    [functions],
  );
  const includedRiskNames = useMemo(
    () =>
      risks
        .filter((r) => r.included)
        .map((r) => r.name.trim())
        .filter(Boolean),
    [risks],
  );

  function ensureSectorNamed(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = sectors.some(
      (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) return;
    setSectors((prev) => [
      ...prev,
      {
        tempId: newManualId(),
        name: trimmed,
        rawText: 'Incluido na revisao',
        included: true,
        confidence: 'high',
        source: 'KEYWORD',
        gheName: null,
      },
    ]);
  }

  async function applyRun(run: PgroImportRun) {
    setRunId(run.id);
    setFileName(run.fileName);
    const clientId = run.servedClientId ?? lockedClientId ?? null;
    setServedClientId(clientId);
    let nextCompany = run.company ?? emptyCompany();
    if (clientId) {
      try {
        const units = await listOperationalUnits(clientId);
        const matriz =
          units.find(
            (unit) =>
              unit.code?.toUpperCase() === 'MATRIZ' ||
              unit.name.trim().toLowerCase() === 'matriz',
          ) ?? units[0];
        if (matriz) {
          nextCompany = {
            ...nextCompany,
            addressLine: nextCompany.addressLine || matriz.addressLine,
            city: nextCompany.city || matriz.city,
            state: nextCompany.state || matriz.state,
          };
        }
      } catch {
        // revisao segue com o que veio do PGR
      }
    }
    setCompany(nextCompany);
    setWarnings(run.warnings ?? []);
    setParseMeta(
      run.parseMeta ??
        (run.layout || run.parseMethod
          ? {
              layout: run.layout ?? undefined,
              parseMethod: run.parseMethod ?? undefined,
              structureWeak: run.structureWeak ?? undefined,
            }
          : null),
    );
    setForceConfirmWeakCoverage(false);
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
          'Este arquivo parece nao ter texto extraivel. Prefira o .docx do Word; .doc antigo e PDF com texto selecionavel tambem sao aceitos.',
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
      setError('Selecione um arquivo Word (.doc ou .docx) ou PDF.');
      return;
    }
    setUploading(true);
    try {
      const run = await previewPgroImport({
        file,
        servedClientId: lockedClientId,
      });
      await applyRun(run);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao processar o documento.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function onConfirm() {
    if (!runId) return;
    if (provisionManager) {
      if (!managerName.trim() || !managerEmail.trim()) {
        setError(
          'Para liberar o portal, informe nome e e-mail do gestor. Ou desmarque a opcao.',
        );
        return;
      }
    }
    const coverageIncomplete =
      parseMeta?.coverageOk === false ||
      (parseMeta?.gheHeaderCount != null &&
        parseMeta?.ghesWithFunctions != null &&
        parseMeta.ghesWithFunctions < parseMeta.gheHeaderCount);
    if (coverageIncomplete && !forceConfirmWeakCoverage) {
      setError(
        'Cobertura de GHE incompleta. Revise setores/funcoes ou marque o override explicito no passo final.',
      );
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      const payload: ConfirmPgroImportPayload = {
        servedClientId,
        archiveMissing: isUpdateMode,
        skipCompanyUpdate: isUpdateMode,
        forceConfirmWeakCoverage: coverageIncomplete
          ? forceConfirmWeakCoverage
          : undefined,
        company: {
          legalName: company.legalName,
          tradeName: company.tradeName,
          cnpj: company.cnpj,
          allocatedLifeQuota: Number(allocatedLifeQuota) || 0,
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
          addressLine: company.addressLine?.trim() || null,
          city: company.city?.trim() || null,
          state: company.state?.trim().toUpperCase().slice(0, 2) || null,
        },
        ...(provisionManager
          ? {
              initialManager: {
                name: managerName.trim(),
                email: managerEmail.trim(),
                phone: managerPhone.trim() || null,
              },
            }
          : {}),
        sectors: sectors.map((s) => ({
          tempId: s.tempId,
          name: s.name,
          included: s.included,
        })),
        functions: functions.map((f) => ({
          tempId: f.tempId,
          name: f.name,
          sectorName: f.sectorName,
          activityDescription: f.activityDescription
            ? f.activityDescription.slice(0, 2000)
            : f.activityDescription,
          environmentDescription: f.environmentDescription
            ? f.environmentDescription.slice(0, 2000)
            : f.environmentDescription,
          included: f.included,
        })),
        risks: risks.map((r) => ({
          tempId: r.tempId,
          name: r.name,
          category: r.category,
          functionNames: r.functionNames,
          exposure: r.exposure,
          source: r.source,
          possibleDamage: r.possibleDamage,
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
      const clientId = result.summary.servedClientId;
      if (result.initialAccess) {
        storeClientAccessOnce(clientId, result.initialAccess);
        router.push(`/clientes/${clientId}/usuarios`);
        return;
      }
      router.push(`/clientes/${clientId}/estrutura?pgro=${result.id}`);
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
    <div className={isUpdateMode ? 'workspace-section' : 'module-page'}>
      {!hideHeader ? (
      <header className="module-header">
        <div>
          <p className="page-kicker">
            {isUpdateMode ? 'Atualizacao no cliente' : 'Importacao assistida'}
          </p>
          <h1 className="page-title page-title--sm">
            {isUpdateMode ? 'Atualizar PGR' : 'Importar PGR'}
          </h1>
          <p className="page-lead">
            {isUpdateMode
              ? 'Envie o Word (.doc ou .docx) ou PDF neste ambiente do cliente, revise e confirme. Setores e funcoes que sumirem do PGR saem das telas operacionais, mas o historico permanece.'
              : 'Envie o Word (.doc ou .docx) ou PDF, revise os dados extraidos e confirme. Nada e gravado apenas pelo upload.'}
          </p>
        </div>
        <div className="header-actions header-actions--wrap">
          <Link
            className="btn btn-secondary"
            href={
              backHref ??
              (lockedClientId
                ? `/clientes/${lockedClientId}/estrutura`
                : '/clientes')
            }
          >
            {backLabel ??
              (isUpdateMode ? 'Voltar para Estrutura' : 'Voltar')}
          </Link>
        </div>
      </header>
      ) : null}

      <WizardSteps
        label="Etapas do PGR"
        steps={STEPS}
        currentId={step}
        unlockedIds={
          runId ? STEPS.map((s) => s.id) : (['upload'] as Step[])
        }
        onSelect={(id) => {
          if (runId || id === 'upload') setStep(id as Step);
        }}
      />

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {parseMeta &&
      step !== 'upload' &&
      (parseMeta.layout === 'UNKNOWN' ||
        parseMeta.parseMethod === 'HEURISTIC_PLUS_LLM' ||
        parseMeta.structureWeak ||
        coverageIncomplete ||
        parseMeta.coverageOk === true) ? (
        <section
          className="surface"
          aria-label="Layout / extracao"
          style={
            coverageIncomplete || parseMeta.structureWeak
              ? {
                  borderColor: 'var(--color-warning, #d97706)',
                  background: 'var(--color-warning-bg, #fffbeb)',
                }
              : undefined
          }
        >
          <p className="page-kicker">Cobertura GHE / extracao</p>
          <p style={{ margin: 0 }}>
            {coverageIncomplete
              ? `Cobertura incompleta: ${parseMeta.ghesWithFunctions ?? 0}/${parseMeta.gheHeaderCount ?? 0} GHE(s) com setor+funcao. Nao confirme cego — revise a lista ou use o override no passo final.`
              : parseMeta.parseMethod === 'HEURISTIC_PLUS_LLM'
                ? 'Este PGR usou IA para complementar a leitura (layout pouco conhecido). Revise setores, funcoes, riscos e EPIs com cuidado antes de confirmar — suas correcoes ajudam o proximo documento da consultoria.'
                : parseMeta.layout === 'UNKNOWN'
                  ? 'Layout do PGR nao reconhecido automaticamente. Revise a extracao com cuidado. Ao confirmar, o sistema aprende aliases para os proximos documentos.'
                  : parseMeta.structureWeak
                    ? 'Estrutura fraca detectada no documento. Revise setores e funcoes antes de confirmar.'
                    : `Motor tabular: ${parseMeta.ghesWithFunctions ?? parseMeta.gheHeaderCount ?? '—'}/${parseMeta.gheHeaderCount ?? '—'} GHE(s) com funcao.`}
          </p>
          <p
            className="muted"
            style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}
          >
            Layout: {parseMeta.layout ?? '—'} · Metodo:{' '}
            {parseMeta.parseMethod ?? '—'}
            {parseMeta.motor ? ` · Motor: ${parseMeta.motor}` : ''}
            {parseMeta.sourceFormat
              ? ` · Origem: ${parseMeta.sourceFormat}`
              : ''}
            {parseMeta.gheHeaderCount != null
              ? ` · GHE: ${parseMeta.ghesWithFunctions ?? '—'}/${parseMeta.gheHeaderCount}`
              : ''}
            {parseMeta.functionCount != null
              ? ` · Funcoes: ${parseMeta.functionCount}`
              : ''}
            {parseMeta.functionsWithSector != null
              ? ` · Com setor: ${parseMeta.functionsWithSector}`
              : ''}
            {parseMeta.riskLinks != null
              ? ` · Riscos: ${parseMeta.riskLinks}`
              : parseMeta.riskCount != null
                ? ` · Riscos: ${parseMeta.riskCount}`
                : ''}
            {parseMeta.epiLinks != null
              ? ` · EPIs: ${parseMeta.epiLinks}`
              : ''}
          </p>
        </section>
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
            Upload do PGR
          </h2>
          <p className="page-lead">
            Preferencial: Word .docx (tabelas mais fiéis). Tambem aceita .doc
            antigo e PDF com texto selecionavel (nao escaneado sem OCR).
          </p>
          {lockedClientId ? (
            <p className="field-hint">
              A atualizacao sera vinculada a este cliente do workspace.
            </p>
          ) : null}
          <form className="form" onSubmit={onUpload}>
            <div className="field">
              <label htmlFor="pgroFile">Arquivo Word (.doc, .docx) ou PDF</label>
              <input
                id="pgroFile"
                name="pgroFile"
                type="file"
                accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,.pdf"
                required
              />
            </div>
            <div className="btn-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={uploading}
              >
                {uploading ? 'Extraindo...' : 'Analisar documento'}
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
            <div className="field field--span-2">
              <label htmlFor="addressLine">Endereco</label>
              <input
                id="addressLine"
                value={company.addressLine ?? ''}
                onChange={(e) =>
                  setCompany((prev) => ({
                    ...prev,
                    addressLine: e.target.value || null,
                  }))
                }
                placeholder="Rua, numero, bairro, CEP"
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
                maxLength={2}
                value={company.state ?? ''}
                onChange={(e) =>
                  setCompany((prev) => ({
                    ...prev,
                    state: e.target.value
                      ? e.target.value.toUpperCase().slice(0, 2)
                      : null,
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
            <div className="field">
              <label htmlFor="riskGrade">Grau de risco</label>
              <input
                id="riskGrade"
                value={company.riskGrade ?? ''}
                onChange={(e) =>
                  setCompany((prev) => ({
                    ...prev,
                    riskGrade: e.target.value || null,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="employeeCount">Nº funcionarios</label>
              <input
                id="employeeCount"
                type="number"
                min={0}
                value={company.employeeCount ?? ''}
                onChange={(e) =>
                  setCompany((prev) => ({
                    ...prev,
                    employeeCount: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
              />
            </div>
            {!servedClientId && !isUpdateMode ? (
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

          <fieldset className="epi-form-section" style={{ marginTop: '1.25rem' }}>
            <legend>Contato institucional</legend>
            <p className="field-hint">
              Usado nos alertas diarios (trocas, CA, biometria). Nao e o login do
              portal.
            </p>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="contactEmail">E-mail de contato</label>
                <input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="contactPhone">WhatsApp / telefone</label>
                <input
                  id="contactPhone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="11999999999"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="epi-form-section" style={{ marginTop: '1.25rem' }}>
            <legend>Acesso ao portal do cliente</legend>
            <label className="field" htmlFor="provisionManager">
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <input
                  id="provisionManager"
                  type="checkbox"
                  checked={provisionManager}
                  onChange={(e) => setProvisionManager(e.target.checked)}
                />
                Criar gestor e enviar link + senha temporaria por e-mail/WhatsApp
              </span>
            </label>
            {provisionManager ? (
              <div className="form-grid" style={{ marginTop: '0.75rem' }}>
                <div className="field">
                  <label htmlFor="managerName">Nome do gestor</label>
                  <input
                    id="managerName"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    required={provisionManager}
                    minLength={2}
                  />
                </div>
                <div className="field">
                  <label htmlFor="managerEmail">E-mail (login)</label>
                  <input
                    id="managerEmail"
                    type="email"
                    value={managerEmail}
                    onChange={(e) => setManagerEmail(e.target.value)}
                    required={provisionManager}
                  />
                </div>
                <div className="field">
                  <label htmlFor="managerPhone">
                    WhatsApp (para enviar login)
                  </label>
                  <input
                    id="managerPhone"
                    value={managerPhone}
                    onChange={(e) => setManagerPhone(e.target.value)}
                    placeholder="11999999999"
                  />
                </div>
              </div>
            ) : (
              <p className="field-hint">
                Sem gestor, a implantacao grava so a estrutura. Voce pode criar o
                acesso depois em Usuarios do cliente.
              </p>
            )}
          </fieldset>

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
          lead="Lista de setores unicos do PGR — varios GHEs podem compartilhar o mesmo setor (por isso os numeros de GHE nao aparecem em sequencia aqui). As funcoes de cada GHE ficam no proximo passo."
          empty="Nenhum setor extraido. Inclua abaixo o que o scan nao pegou."
          items={highSectors}
          lowItems={lowSectors}
          showGheName={false}
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
          footer={
            <AddSectorForm
              existingNames={sectors.map((s) => s.name)}
              onAdd={(name) =>
                setSectors((prev) => [
                  ...prev,
                  {
                    tempId: newManualId(),
                    name,
                    rawText: 'Incluido na revisao',
                    included: true,
                    confidence: 'high',
                    source: 'KEYWORD',
                    gheName: null,
                  },
                ])
              }
            />
          }
          onPrev={goPrev}
          onNext={goNext}
        />
      ) : null}

      {step === 'funcoes' ? (
        <section className="surface">
          <h2 className="page-title page-title--sm">Funcoes encontradas</h2>
          {functions.length === 0 ? (
            <p className="page-lead">
              Nenhuma funcao extraida. Inclua abaixo a que o scan nao pegou.
            </p>
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
          <AddFunctionForm
            sectorOptions={includedSectorNames}
            existingNames={functions.map((f) => f.name)}
            onAdd={(name, sectorName) => {
              if (sectorName) ensureSectorNamed(sectorName);
              setFunctions((prev) => [
                ...prev,
                {
                  tempId: newManualId(),
                  name,
                  sectorName: sectorName || null,
                  activityDescription: null,
                  environmentDescription: null,
                  gheName: null,
                  rawText: 'Incluido na revisao',
                  included: true,
                  confidence: 'high',
                  source: 'KEYWORD',
                },
              ]);
            }}
          />
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
            <p className="page-lead">
              Nenhum risco extraido. Inclua abaixo o que o scan nao pegou.
            </p>
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
          <AddRiskForm
            catalogRisks={catalogRisks}
            functionOptions={includedFunctionNames}
            existingNames={risks.map((r) => r.name)}
            onAdd={(item) =>
              setRisks((prev) => [
                ...prev,
                {
                  tempId: newManualId(),
                  name: item.name,
                  category: item.category,
                  exposure: null,
                  source: 'Incluido na revisao',
                  possibleDamage: null,
                  riskLevel: null,
                  functionNames: item.functionNames,
                  rawText: 'Incluido na revisao',
                  included: true,
                  confidence: 'high',
                  extractionSource: 'KEYWORD',
                  gheName: null,
                },
              ])
            }
          />
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
            O PGR sugere necessidades de EPI (nao cria estoque nem EPI com
            CA).
          </p>
          {epiNeeds.length === 0 ? (
            <p className="page-lead">
              Nenhum EPI identificado. Inclua abaixo a necessidade que o scan
              nao pegou.
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
          <AddNeedForm
            catalogNeeds={catalogNeeds}
            functionOptions={includedFunctionNames}
            riskOptions={includedRiskNames}
            existingNames={epiNeeds.map((e) => e.suggestedName)}
            onAdd={(item) =>
              setEpiNeeds((prev) => [
                ...prev,
                {
                  tempId: newManualId(),
                  extractedText: item.suggestedName,
                  suggestedName: item.suggestedName,
                  matchedEpiNeedId: item.matchedEpiNeedId,
                  matchedEpiNeedName: item.matchedEpiNeedName,
                  createNew: item.createNew,
                  functionNames: item.functionNames,
                  riskNames: item.riskNames,
                  included: true,
                  confidence: 'high',
                  extractionSource: 'KEYWORD',
                  gheName: null,
                },
              ])
            }
          />
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
            <div>
              <dt>Endereco</dt>
              <dd>
                {[company.addressLine, company.city, company.state]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </dd>
            </div>
            <div>
              <dt>Contato (alertas)</dt>
              <dd>
                {contactEmail || '—'}
                {contactPhone ? ` · ${contactPhone}` : ''}
              </dd>
            </div>
            <div>
              <dt>Gestor do portal</dt>
              <dd>
                {provisionManager
                  ? `${managerName || '—'} · ${managerEmail || '—'}${
                      managerPhone ? ` · ${managerPhone}` : ''
                    }`
                  : 'Nao criar agora'}
              </dd>
            </div>
          </dl>
          {summary ? (
            <p className="field-hint">
              Ultima confirmacao: cliente {summary.servedClientId}.
            </p>
          ) : null}
          {coverageIncomplete ? (
            <label
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
                margin: '0.75rem 0',
              }}
            >
              <input
                type="checkbox"
                checked={forceConfirmWeakCoverage}
                onChange={(e) =>
                  setForceConfirmWeakCoverage(e.target.checked)
                }
              />
              <span>
                Entendo que a cobertura de GHE esta incompleta (
                {parseMeta?.ghesWithFunctions ?? 0}/
                {parseMeta?.gheHeaderCount ?? 0}) e quero confirmar mesmo assim.
              </span>
            </label>
          ) : null}
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={goPrev}>
              Voltar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                confirming ||
                (coverageIncomplete && !forceConfirmWeakCoverage)
              }
              onClick={() => void onConfirm()}
            >
              {confirming
                ? 'Confirmando...'
                : provisionManager
                  ? 'Confirmar e enviar acesso'
                  : 'Confirmar implantacao'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ReviewList({
  title,
  lead,
  empty,
  items,
  lowItems = [],
  footer,
  showGheName = true,
  onToggle,
  onRename,
  onPrev,
  onNext,
}: {
  title: string;
  lead?: string;
  empty: string;
  items: PgroExtractedSector[];
  lowItems?: PgroExtractedSector[];
  footer?: ReactNode;
  showGheName?: boolean;
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
          {qualityBadge(item, { showGheName })}
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
      {lead ? <p className="page-lead">{lead}</p> : null}
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
      {footer}
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
            <th scope="col">Setor associado</th>
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
                  aria-label={`Incluir ${item.name}`}
                />
              </td>
              <td>
                <input
                  value={item.name}
                  onChange={(e) => onRename(item.tempId, e.target.value)}
                  aria-label={`Nome da funcao ${item.name}`}
                />
                {item.sectorName ? (
                  <p className="table-sub">Setor: {item.sectorName}</p>
                ) : (
                  <p className="table-sub">Setor nao associado</p>
                )}
              </td>
              <td>
                <input
                  value={item.sectorName ?? ''}
                  onChange={(e) => onSector(item.tempId, e.target.value)}
                  placeholder="Ex.: PRODUCAO"
                  aria-label={`Setor de ${item.name}`}
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

function ManualAddPanel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="form-panel" style={{ marginTop: '1.25rem' }}>
      <p className="page-kicker">{title}</p>
      {hint ? <p className="field-hint">{hint}</p> : null}
      {children}
    </div>
  );
}

function hasSameName(existing: string[], name: string) {
  const key = name.trim().toLowerCase();
  return existing.some((item) => item.trim().toLowerCase() === key);
}

function AddSectorForm({
  existingNames,
  onAdd,
}: {
  existingNames: string[];
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  return (
    <ManualAddPanel
      title="Incluir setor que o scan nao pegou"
      hint="Use quando o PGR menciona um setor e a leitura pulou."
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (trimmed.length < 2) {
            setError('Informe o nome do setor.');
            return;
          }
          if (hasSameName(existingNames, trimmed)) {
            setError('Esse setor ja esta na lista.');
            return;
          }
          onAdd(trimmed);
          setName('');
          setError('');
        }}
      >
        <div className="field">
          <label htmlFor="manual-sector">Nome do setor</label>
          <input
            id="manual-sector"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            required
            placeholder="Ex.: Almoxarifado"
          />
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button type="submit" className="btn btn-secondary">
            Incluir setor
          </button>
        </div>
      </form>
      {error ? <p className="field-hint">{error}</p> : null}
    </ManualAddPanel>
  );
}

function AddFunctionForm({
  sectorOptions,
  existingNames,
  onAdd,
}: {
  sectorOptions: string[];
  existingNames: string[];
  onAdd: (name: string, sectorName: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [sectorChoice, setSectorChoice] = useState(sectorOptions[0] ?? '');
  const [newSector, setNewSector] = useState('');
  const [error, setError] = useState('');

  return (
    <ManualAddPanel
      title="Incluir funcao que o scan nao pegou"
      hint="Associe a um setor ja revisado ou crie o setor junto."
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (trimmed.length < 2) {
            setError('Informe o nome da funcao.');
            return;
          }
          if (hasSameName(existingNames, trimmed)) {
            setError('Essa funcao ja esta na lista.');
            return;
          }
          const sectorName =
            sectorChoice === '__new'
              ? newSector.trim() || null
              : sectorChoice.trim() || null;
          if (sectorChoice === '__new' && !sectorName) {
            setError('Informe o novo setor.');
            return;
          }
          onAdd(trimmed, sectorName);
          setName('');
          setNewSector('');
          setError('');
        }}
      >
        <div className="field">
          <label htmlFor="manual-function">Nome da funcao</label>
          <input
            id="manual-function"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            required
            placeholder="Ex.: Operador de empilhadeira"
          />
        </div>
        <div className="field">
          <label htmlFor="manual-function-sector">Setor</label>
          <select
            id="manual-function-sector"
            value={sectorChoice}
            onChange={(e) => setSectorChoice(e.target.value)}
          >
            <option value="">Geral</option>
            {sectorOptions.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
            <option value="__new">Outro setor...</option>
          </select>
        </div>
        {sectorChoice === '__new' ? (
          <div className="field">
            <label htmlFor="manual-function-new-sector">Novo setor</label>
            <input
              id="manual-function-new-sector"
              value={newSector}
              onChange={(e) => setNewSector(e.target.value)}
              minLength={2}
              required
              placeholder="Ex.: Expedicao"
            />
          </div>
        ) : null}
        <div className="field" style={{ alignSelf: 'end' }}>
          <button type="submit" className="btn btn-secondary">
            Incluir funcao
          </button>
        </div>
      </form>
      {error ? <p className="field-hint">{error}</p> : null}
    </ManualAddPanel>
  );
}

function NameChecklist({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset className="field" style={{ gridColumn: '1 / -1' }}>
      <legend>{label}</legend>
      <p className="field-hint">
        Sem marcacao, o item entra para todas as funcoes incluidas.
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem 1rem',
          marginTop: '0.35rem',
        }}
      >
        {options.map((option) => {
          const checked = selected.includes(option);
          return (
            <label
              key={option}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? selected.filter((item) => item !== option)
                      : [...selected, option],
                  )
                }
              />
              {option}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function AddRiskForm({
  catalogRisks,
  functionOptions,
  existingNames,
  onAdd,
}: {
  catalogRisks: OccupationalRisk[];
  functionOptions: string[];
  existingNames: string[];
  onAdd: (item: {
    name: string;
    category: OccupationalRiskCategory;
    functionNames: string[];
  }) => void;
}) {
  const [catalogId, setCatalogId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<OccupationalRiskCategory>('FISICO');
  const [functionNames, setFunctionNames] = useState<string[]>([]);
  const [error, setError] = useState('');

  return (
    <ManualAddPanel
      title="Incluir risco que o scan nao pegou"
      hint="Escolha um risco comum do catalogo ou escreva o nome."
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const catalog = catalogRisks.find((risk) => risk.id === catalogId);
          const trimmed = (catalog?.name ?? name).trim();
          const nextCategory = catalog?.category ?? category;
          if (trimmed.length < 2) {
            setError('Informe o risco ou escolha no catalogo.');
            return;
          }
          if (hasSameName(existingNames, trimmed)) {
            setError('Esse risco ja esta na lista.');
            return;
          }
          onAdd({
            name: trimmed,
            category: nextCategory,
            functionNames,
          });
          setCatalogId('');
          setName('');
          setFunctionNames([]);
          setError('');
        }}
      >
        <div className="field">
          <label htmlFor="manual-risk-catalog">Catalogo de riscos</label>
          <select
            id="manual-risk-catalog"
            value={catalogId}
            onChange={(e) => {
              const id = e.target.value;
              setCatalogId(id);
              const match = catalogRisks.find((risk) => risk.id === id);
              if (match) {
                setName(match.name);
                setCategory(match.category);
              }
            }}
          >
            <option value="">Digitar um risco novo</option>
            {catalogRisks.map((risk) => (
              <option key={risk.id} value={risk.id}>
                {risk.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="manual-risk-name">Nome do risco</label>
          <input
            id="manual-risk-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setCatalogId('');
            }}
            minLength={2}
            required={!catalogId}
            placeholder="Ex.: Ruido"
          />
        </div>
        <div className="field">
          <label htmlFor="manual-risk-category">Categoria</label>
          <select
            id="manual-risk-category"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as OccupationalRiskCategory)
            }
          >
            {RISK_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button type="submit" className="btn btn-secondary">
            Incluir risco
          </button>
        </div>
        <NameChecklist
          label="Vincular a funcoes"
          options={functionOptions}
          selected={functionNames}
          onChange={setFunctionNames}
        />
      </form>
      {error ? <p className="field-hint">{error}</p> : null}
    </ManualAddPanel>
  );
}

function AddNeedForm({
  catalogNeeds,
  functionOptions,
  riskOptions,
  existingNames,
  onAdd,
}: {
  catalogNeeds: EpiNeed[];
  functionOptions: string[];
  riskOptions: string[];
  existingNames: string[];
  onAdd: (item: {
    suggestedName: string;
    matchedEpiNeedId: string | null;
    matchedEpiNeedName: string | null;
    createNew: boolean;
    functionNames: string[];
    riskNames: string[];
  }) => void;
}) {
  const [catalogId, setCatalogId] = useState('');
  const [name, setName] = useState('');
  const [functionNames, setFunctionNames] = useState<string[]>([]);
  const [riskNames, setRiskNames] = useState<string[]>([]);
  const [error, setError] = useState('');

  return (
    <ManualAddPanel
      title="Incluir necessidade que o scan nao pegou"
      hint="Escolha um tipo do catalogo ou crie o nome operacional."
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const catalog = catalogNeeds.find((need) => need.id === catalogId);
          const trimmed = (catalog?.name ?? name).trim();
          if (trimmed.length < 2) {
            setError('Informe a necessidade ou escolha no catalogo.');
            return;
          }
          if (hasSameName(existingNames, trimmed)) {
            setError('Essa necessidade ja esta na lista.');
            return;
          }
          onAdd({
            suggestedName: trimmed,
            matchedEpiNeedId: catalog?.id ?? null,
            matchedEpiNeedName: catalog?.name ?? null,
            createNew: !catalog,
            functionNames,
            riskNames,
          });
          setCatalogId('');
          setName('');
          setFunctionNames([]);
          setRiskNames([]);
          setError('');
        }}
      >
        <div className="field">
          <label htmlFor="manual-need-catalog">Catalogo de necessidades</label>
          <select
            id="manual-need-catalog"
            value={catalogId}
            onChange={(e) => {
              const id = e.target.value;
              setCatalogId(id);
              const match = catalogNeeds.find((need) => need.id === id);
              setName(match?.name ?? '');
            }}
          >
            <option value="">Digitar uma necessidade nova</option>
            {catalogNeeds.map((need) => (
              <option key={need.id} value={need.id}>
                {need.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="manual-need-name">Nome da necessidade</label>
          <input
            id="manual-need-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setCatalogId('');
            }}
            minLength={2}
            required={!catalogId}
            placeholder="Ex.: Luva de raspa"
          />
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button type="submit" className="btn btn-secondary">
            Incluir necessidade
          </button>
        </div>
        <NameChecklist
          label="Vincular a funcoes"
          options={functionOptions}
          selected={functionNames}
          onChange={setFunctionNames}
        />
        <NameChecklist
          label="Vincular a riscos"
          options={riskOptions}
          selected={riskNames}
          onChange={setRiskNames}
        />
      </form>
      {error ? <p className="field-hint">{error}</p> : null}
    </ManualAddPanel>
  );
}
