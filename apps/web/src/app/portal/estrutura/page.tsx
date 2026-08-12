'use client';

import type {
  ClientPortalUser,
  PortalEstruturaResponse,
} from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { StockDashboardKpis } from '../../../components/portal/StockDashboardKpis';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import { fetchPortalEstrutura } from '../../../lib/client-auth';

function formatWhen(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function PortalEstruturaContent({ user }: { user: ClientPortalUser }) {
  const [data, setData] = useState<PortalEstruturaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchPortalEstrutura()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Falha ao carregar estrutura.',
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const kpiItems = useMemo(() => {
    if (!data) return [];
    const jobs = data.sectors.reduce((acc, s) => acc + s.jobs.length, 0);
    const needs = data.sectors.reduce(
      (acc, s) =>
        acc + s.jobs.reduce((jAcc, job) => jAcc + job.needs.length, 0),
      0,
    );
    const riskSet = new Set<string>();
    for (const sector of data.sectors) {
      for (const job of sector.jobs) {
        for (const risk of job.risks) riskSet.add(risk);
      }
    }
    return [
      {
        id: 'units',
        label: 'Unidades',
        value: data.units.length,
      },
      {
        id: 'sectors',
        label: 'Setores',
        value: data.sectors.length,
      },
      {
        id: 'jobs',
        label: 'Funcoes',
        value: jobs,
      },
      {
        id: 'needs',
        label: 'Necessidades de EPI',
        value: needs,
        hint: `${riskSet.size} risco(s) distintos`,
      },
    ];
  }, [data]);

  return (
    <div className="portal-home">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Operacao</p>
          <h1 className="page-title">Estrutura</h1>
          <p className="page-lead">
            Setores, funcoes, riscos e necessidades ativos. O gestor pode
            reenviar o PGR quando a empresa mudar cargos ou setores.
          </p>
        </div>
        <div className="dash-page-header__actions">
          {user.role === 'CLIENT_MANAGER' ? (
            <Link className="btn btn-primary" href="/portal/estrutura/atualizar-pgr">
              Atualizar PGR
            </Link>
          ) : null}
          <Link className="btn btn-secondary" href="/portal/trabalhadores">
            Trabalhadores
          </Link>
          <Link className="btn btn-secondary" href="/portal">
            Painel
          </Link>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="page-lead">Carregando estrutura...</p> : null}

      {data?.lastPgroImport ? (
        <p className="page-lead">
          Ultimo PGR confirmado: {data.lastPgroImport.fileName}
          {formatWhen(data.lastPgroImport.finishedAt) ||
          formatWhen(data.lastPgroImport.createdAt)
            ? ` · ${formatWhen(data.lastPgroImport.finishedAt) ?? formatWhen(data.lastPgroImport.createdAt)}`
            : ''}
        </p>
      ) : null}

      {data ? (
        data.sectors.length === 0 ? (
          <section className="dash-panel" style={{ minHeight: 0 }}>
            <p className="dash-panel__empty" style={{ padding: '1.5rem 1rem' }}>
              Nenhum setor ativo. A primeira estrutura vem da Consultoria; o
              gestor pode reenviar o PGR depois.
            </p>
          </section>
        ) : (
          <>
            <StockDashboardKpis items={kpiItems} />

            <div className="estrutura-sector-list">
              {data.sectors.map((sector) => (
                <section
                  key={sector.id}
                  className="dash-panel estrutura-sector"
                  style={{ minHeight: 0 }}
                >
                  <div className="dash-panel__head">
                    <h2>{sector.name}</h2>
                    <p>
                      {sector.unitName
                        ? `Unidade: ${sector.unitName}`
                        : 'Sem unidade vinculada'}{' '}
                      · {sector.jobs.length} funcao
                      {sector.jobs.length === 1 ? '' : 'oes'}
                    </p>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table data-table--refined">
                      <thead>
                        <tr>
                          <th scope="col">Funcao</th>
                          <th scope="col">Riscos</th>
                          <th scope="col">Necessidades</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sector.jobs.length === 0 ? (
                          <tr>
                            <td colSpan={3}>Nenhuma funcao neste setor.</td>
                          </tr>
                        ) : (
                          sector.jobs.map((job) => (
                            <tr key={job.id}>
                              <td>
                                <strong>{job.name}</strong>
                              </td>
                              <td>
                                {job.risks.length === 0 ? (
                                  '—'
                                ) : (
                                  <div className="portal-risk-chips">
                                    {job.risks.map((risk) => (
                                      <span
                                        key={risk}
                                        className="portal-risk-chip"
                                      >
                                        {risk}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td>
                                {job.needs.length === 0 ? (
                                  '—'
                                ) : (
                                  <ul className="estrutura-needs-list">
                                    {job.needs.map((need) => (
                                      <li key={need.id}>{need.name}</li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          </>
        )
      ) : null}
    </div>
  );
}

export default function PortalEstruturaPage() {
  return (
    <RequireClientAuth>
      {(user) => <PortalEstruturaContent user={user} />}
    </RequireClientAuth>
  );
}
