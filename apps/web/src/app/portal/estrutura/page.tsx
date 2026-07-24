'use client';

import type { PortalEstruturaResponse } from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireClientAuth } from '../../../components/RequireClientAuth';
import { fetchPortalEstrutura } from '../../../lib/client-auth';

function PortalEstruturaContent() {
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

  return (
    <div className="portal-home">
      <header className="portal-home-header">
        <div>
          <p className="page-kicker">Dia a dia</p>
          <h1 className="page-title page-title--sm">Estrutura</h1>
          <p className="page-lead">
            Visao somente leitura dos setores, funcoes, riscos e necessidades
            implantados pela Consultoria.
          </p>
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="page-lead">Carregando estrutura...</p> : null}

      {data ? (
        data.sectors.length === 0 ? (
          <section className="portal-card">
            <p className="page-lead">
              Nenhum setor ativo. A Consultoria define a estrutura no workspace
              do cliente.
            </p>
            <Link className="btn btn-secondary" href="/portal">
              Voltar ao painel
            </Link>
          </section>
        ) : (
          <div className="portal-home">
            {data.sectors.map((sector) => (
              <section key={sector.id} className="portal-card">
                <p className="page-kicker">Setor</p>
                <h2 className="page-title page-title--sm">{sector.name}</h2>
                <p className="page-lead">
                  {sector.unitName
                    ? `Unidade: ${sector.unitName}`
                    : 'Sem unidade vinculada'}{' '}
                  · {sector.jobs.length} funcao(oes)
                </p>
                <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
                  <table className="data-table">
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
                                <div className="epi-need-picker">
                                  {job.risks.map((risk) => (
                                    <span
                                      key={risk}
                                      className="epi-need-chip"
                                    >
                                      {risk}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              {job.needs.length === 0
                                ? '—'
                                : job.needs.map((n) => n.name).join(', ')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
            <div className="btn-row">
              <Link className="btn btn-secondary" href="/portal">
                Voltar ao painel
              </Link>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

export default function PortalEstruturaPage() {
  return (
    <RequireClientAuth>
      {() => <PortalEstruturaContent />}
    </RequireClientAuth>
  );
}
