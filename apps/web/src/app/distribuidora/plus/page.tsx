'use client';

import { FormEvent, useEffect, useState } from 'react';
import { fetchMe } from '../../../lib/auth';
import {
  createPlusContract,
  isDistributorManager,
  listDistributorProducts,
  listPlusCatalog,
  listPlusContracts,
  listPlusMappings,
  listPlusShipments,
  previewPlusClient,
  revokePlusContract,
  upsertPlusMapping,
  type DistributorProduct,
  type PlusCatalogItem,
  type PlusContract,
  type PlusMapping,
  type PlusPreviewClient,
  type PlusShipment,
} from '../../../lib/distributor';

export default function DistribuidoraPlusPage() {
  const [contracts, setContracts] = useState<PlusContract[]>([]);
  const [shipments, setShipments] = useState<PlusShipment[]>([]);
  const [products, setProducts] = useState<DistributorProduct[]>([]);
  const [mappings, setMappings] = useState<PlusMapping[]>([]);
  const [catalog, setCatalog] = useState<PlusCatalogItem[]>([]);
  const [preview, setPreview] = useState<PlusPreviewClient[]>([]);
  const [manager, setManager] = useState(false);
  const [cnpj, setCnpj] = useState('');
  const [consultoriaOrganizationId, setConsultoriaOrganizationId] = useState('');
  const [contractId, setContractId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [epiItemId, setEpiItemId] = useState('');
  const [epiVariantId, setEpiVariantId] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload(selectedContractId?: string) {
    const [contractRows, shipmentRows, productRows] = await Promise.all([
      listPlusContracts(),
      listPlusShipments(selectedContractId || undefined),
      listDistributorProducts(),
    ]);
    setContracts(contractRows);
    setShipments(shipmentRows);
    setProducts(productRows);
    const activeId =
      selectedContractId ||
      contractRows.find((row) => row.status === 'ACTIVE')?.id ||
      contractRows[0]?.id ||
      '';
    setContractId(activeId);
    if (activeId) {
      const [mappingRows, catalogRows] = await Promise.all([
        listPlusMappings(activeId),
        listPlusCatalog(activeId),
      ]);
      setMappings(mappingRows);
      setCatalog(catalogRows);
      const firstVariant = productRows[0]?.variants[0]?.id ?? '';
      setVariantId((current) => current || firstVariant);
      setEpiItemId((current) => current || catalogRows[0]?.id || '');
    } else {
      setMappings([]);
      setCatalog([]);
    }
  }

  useEffect(() => {
    void Promise.all([reload(), fetchMe()])
      .then(([, me]) => setManager(isDistributorManager(me.membershipRole)))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  async function onPreview(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const rows = await previewPlusClient(cnpj);
      setPreview(rows);
      setConsultoriaOrganizationId(rows[0]?.consultoriaOrganizationId ?? '');
      if (rows.length === 0) {
        setNotice('Nenhuma empresa ativa do ProntEPI com este CNPJ.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha na busca.');
    }
  }

  async function onCreateContract(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const created = await createPlusContract({
        cnpj,
        consultoriaOrganizationId: consultoriaOrganizationId || null,
      });
      setNotice(`Contrato Plus ativo com ${created.clientName}.`);
      setCnpj('');
      setPreview([]);
      await reload(created.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao vincular.');
    } finally {
      setSaving(false);
    }
  }

  async function onSelectContract(nextId: string) {
    setContractId(nextId);
    setError(null);
    try {
      const [mappingRows, catalogRows, shipmentRows] = await Promise.all([
        listPlusMappings(nextId),
        listPlusCatalog(nextId, catalogQuery),
        listPlusShipments(nextId),
      ]);
      setMappings(mappingRows);
      setCatalog(catalogRows);
      setShipments(shipmentRows);
      setEpiItemId(catalogRows[0]?.id ?? '');
      setEpiVariantId('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir contrato.');
    }
  }

  async function onSearchCatalog(event: FormEvent) {
    event.preventDefault();
    if (!contractId) return;
    setError(null);
    try {
      setCatalog(await listPlusCatalog(contractId, catalogQuery));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha no catalogo.');
    }
  }

  async function onSaveMapping(event: FormEvent) {
    event.preventDefault();
    if (!contractId) return;
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await upsertPlusMapping(contractId, {
        variantId,
        epiItemId,
        epiVariantId: epiVariantId || null,
      });
      setNotice('Mapeamento salvo. A ficha do cliente continua no EPI escolhido.');
      setMappings(await listPlusMappings(contractId));
      await reload(contractId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao mapear.');
    } finally {
      setSaving(false);
    }
  }

  async function onRevoke() {
    if (!contractId) return;
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await revokePlusContract(contractId);
      setNotice('Contrato Plus revogado.');
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao revogar.');
    } finally {
      setSaving(false);
    }
  }

  const selectedContract = contracts.find((row) => row.id === contractId) ?? null;
  const variantOptions = products.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      label: `${product.name} · ${variant.label} (${product.internalSku})`,
    })),
  );
  const selectedEpi = catalog.find((row) => row.id === epiItemId) ?? null;

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Distribuidora</p>
          <h1 className="page-title">Plus</h1>
          <p className="page-lead">
            Contrato explicito com empresa ja cliente do ProntEPI. Na confirmacao
            da nota de saida, o estoque dela sobe no EPI da ficha — sem atalho no
            saldo da consultoria.
          </p>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="success">{notice}</p> : null}

      {manager ? (
        <section className="dash-panel">
          <h2 className="dash-panel__title">Vincular empresa</h2>
          <form className="form-grid" onSubmit={onPreview}>
            <label htmlFor="plus-cnpj">CNPJ da empresa no ProntEPI</label>
            <input
              id="plus-cnpj"
              value={cnpj}
              onChange={(event) => setCnpj(event.target.value)}
              placeholder="00.000.000/0000-00"
            />
            <button type="submit" className="btn btn--secondary" disabled={saving}>
              Buscar
            </button>
          </form>
          {preview.length > 0 ? (
            <form className="form-grid" onSubmit={onCreateContract}>
              <label htmlFor="plus-consultoria">Consultoria</label>
              <select
                id="plus-consultoria"
                value={consultoriaOrganizationId}
                onChange={(event) => setConsultoriaOrganizationId(event.target.value)}
              >
                {preview.map((row) => (
                  <option
                    key={row.servedClientId}
                    value={row.consultoriaOrganizationId}
                  >
                    {row.consultoriaName} — {row.legalName}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn" disabled={saving}>
                Ativar contrato Plus
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      <section className="dash-panel">
        <h2 className="dash-panel__title">Contratos</h2>
        {contracts.length === 0 ? (
          <p className="field-hint">Nenhum contrato Plus ainda.</p>
        ) : (
          <ul className="list-plain">
            {contracts.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`btn btn--ghost ${row.id === contractId ? 'is-active' : ''}`}
                  onClick={() => void onSelectContract(row.id)}
                >
                  {row.clientName} · {row.clientCnpj} · {row.status} ·{' '}
                  {row.mappingCount} mapa(s)
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedContract?.status === 'ACTIVE' && manager ? (
          <button
            type="button"
            className="btn btn--secondary"
            disabled={saving}
            onClick={() => void onRevoke()}
          >
            Revogar contrato
          </button>
        ) : null}
      </section>

      {selectedContract ? (
        <section className="dash-panel">
          <h2 className="dash-panel__title">Mapear SKU → EPI da ficha</h2>
          <p className="field-hint">
            {selectedContract.clientName} via {selectedContract.consultoriaName}
          </p>
          {manager && selectedContract.status === 'ACTIVE' ? (
            <>
              <form className="form-grid" onSubmit={onSearchCatalog}>
                <label htmlFor="plus-catalog-q">Buscar EPI na consultoria</label>
                <input
                  id="plus-catalog-q"
                  value={catalogQuery}
                  onChange={(event) => setCatalogQuery(event.target.value)}
                  placeholder="Nome ou CA"
                />
                <button type="submit" className="btn btn--secondary">
                  Buscar catalogo
                </button>
              </form>
              <form className="form-grid" onSubmit={onSaveMapping}>
                <label htmlFor="plus-variant">Produto e tamanho da distribuidora</label>
                <select
                  id="plus-variant"
                  value={variantId}
                  onChange={(event) => setVariantId(event.target.value)}
                >
                  {variantOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <label htmlFor="plus-epi">EPI do cliente</label>
                <select
                  id="plus-epi"
                  value={epiItemId}
                  onChange={(event) => {
                    setEpiItemId(event.target.value);
                    setEpiVariantId('');
                  }}
                >
                  {catalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.caNumber ? ` · CA ${item.caNumber}` : ''}
                    </option>
                  ))}
                </select>
                {selectedEpi && selectedEpi.variants.length > 0 ? (
                  <>
                    <label htmlFor="plus-epi-variant">Variacao do EPI (opcional)</label>
                    <select
                      id="plus-epi-variant"
                      value={epiVariantId}
                      onChange={(event) => setEpiVariantId(event.target.value)}
                    >
                      <option value="">Sem variacao</option>
                      {selectedEpi.variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {[variant.size, variant.color, variant.model]
                            .filter(Boolean)
                            .join(' / ') || variant.id}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
                <button type="submit" className="btn" disabled={saving || !epiItemId}>
                  Salvar mapeamento
                </button>
              </form>
            </>
          ) : null}
          {mappings.length === 0 ? (
            <p className="field-hint">Nenhum mapeamento. Sem mapa, a confirmacao nao sobe estoque no cliente.</p>
          ) : (
            <ul className="list-plain">
              {mappings.map((row) => (
                <li key={row.id}>
                  {row.productName} {row.label} → {row.epiName ?? row.epiItemId}
                  {row.epiCaNumber ? ` (CA ${row.epiCaNumber})` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="dash-panel">
        <h2 className="dash-panel__title">Transferencias recentes</h2>
        {shipments.length === 0 ? (
          <p className="field-hint">
            Ainda nao houve confirmacao de nota com linhas mapeadas.
          </p>
        ) : (
          <ul className="list-plain">
            {shipments.map((row) => (
              <li key={row.id}>
                NF {row.series}/{row.number} · {row.clientName} · {row.quantity} un ·{' '}
                {new Date(row.createdAt).toLocaleString('pt-BR')}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
