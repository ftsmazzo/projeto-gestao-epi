'use client';

import type { ServedClientOverview } from '@gestao-epi/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getServedClientOverview } from '../../../lib/served-clients';

export default function ClienteVisaoGeralPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const [overview, setOverview] = useState<ServedClientOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const ov = await getServedClientOverview(clientId);
      setOverview(ov);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar a visao geral.',
      );
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !overview) {
    return <p className="page-lead">Carregando visao geral...</p>;
  }

  if (error || !overview) {
    return (
      <p className="error" role="alert">
        {error ?? 'Visao geral indisponivel.'}
      </p>
    );
  }

  const { client, counts, lives, lastPgroImport, operational } = overview;
  const base = `/clientes/${client.id}`;

  return (
    <div className="workspace-section">
      {!operational ? (
        <div className="notice notice--warn" role="status">
          <p>
            Cliente <strong>inativo</strong>. Reative na lista de clientes para
            operar estrutura, usuarios e vidas.
          </p>
        </div>
      ) : null}

      <section className="surface" aria-labelledby="overview-title">
        <p className="page-kicker">Resumo</p>
        <h2 id="overview-title" className="page-title page-title--sm">
          Visao geral
        </h2>
        <p className="page-lead">
          Use o menu acima para estrutura, PGRO, usuarios, unidades e
          trabalhadores. Gestores e estoque nao consomem vidas.
        </p>

        <div className="quota-summary" aria-label="Indicadores">
          <div className="quota-summary-item">
            <span className="quota-summary-label">Vidas</span>
            <strong className="quota-summary-value">
              {lives.used}/{lives.allocated}
            </strong>
            <span className="table-sub">{lives.available} disponiveis</span>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Setores</span>
            <strong className="quota-summary-value">
              {counts.sectors.active}
            </strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Funcoes</span>
            <strong className="quota-summary-value">
              {counts.jobFunctions.active}
            </strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Gestores</span>
            <strong className="quota-summary-value">
              {counts.users.managers.active}/{counts.users.managers.limit}
            </strong>
          </div>
          <div className="quota-summary-item">
            <span className="quota-summary-label">Operadores estoque</span>
            <strong className="quota-summary-value">
              {counts.users.stockOperators.active}/
              {counts.users.stockOperators.limit}
            </strong>
          </div>
        </div>

        <p className="table-sub">{lives.note}</p>

        {lastPgroImport ? (
          <p className="table-sub">
            Ultimo PGRO: {lastPgroImport.fileName} · {lastPgroImport.status} ·{' '}
            {new Date(lastPgroImport.createdAt).toLocaleString('pt-BR')}
          </p>
        ) : (
          <p className="table-sub">Nenhuma importacao PGRO neste cliente.</p>
        )}
      </section>

      <section className="surface" aria-labelledby="overview-next">
        <h2 id="overview-next" className="page-title page-title--sm">
          Proximos passos
        </h2>
        <ul className="workspace-link-list">
          <li>
            <Link href={`${base}/estrutura`}>Configurar estrutura</Link>
            <span>Setores, funcoes e riscos</span>
          </li>
          <li>
            <Link href={`/clientes/importar-pgro?clientId=${client.id}`}>
              Importar PGRO
            </Link>
            <span>Popular estrutura a partir do PDF</span>
          </li>
          <li>
            <Link href={`${base}/usuarios`}>Usuarios do cliente</Link>
            <span>Gestores e operadores (acesso ao portal)</span>
          </li>
          <li>
            <Link href={`${base}/trabalhadores`}>Trabalhadores</Link>
            <span>Vidas ativas do cliente</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
