'use client';

import type { PortalWorkerEpiSheetResponse } from '@gestao-epi/shared';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { RequireClientAuth } from '../../../../../components/RequireClientAuth';
import { WorkerEpiSheetView } from '../../../../../components/WorkerEpiSheetView';
import { fetchPortalWorkerEpiSheet } from '../../../../../lib/client-auth';

function PortalWorkerEpiSheetContent({ workerId }: { workerId: string }) {
  const [scope, setScope] = useState<'history' | 'open'>('history');
  const [data, setData] = useState<PortalWorkerEpiSheetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (nextScope: 'history' | 'open') => {
      setLoading(true);
      setError(null);
      void fetchPortalWorkerEpiSheet(workerId, nextScope)
        .then((res) => {
          setData(res);
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(
            err instanceof Error
              ? err.message
              : 'Falha ao carregar a ficha de EPI.',
          );
          setLoading(false);
        });
    },
    [workerId],
  );

  useEffect(() => {
    load(scope);
  }, [load, scope]);

  return (
    <div className="portal-home">
      {error ? (
        <p className="error no-print" role="alert">
          {error}
        </p>
      ) : null}
      {loading && !data ? (
        <p className="page-lead no-print">Carregando ficha de EPI...</p>
      ) : null}
      {data ? (
        <WorkerEpiSheetView
          data={data}
          scope={scope}
          onScopeChange={(next) => setScope(next)}
        />
      ) : null}
    </div>
  );
}

export default function PortalWorkerEpiSheetPage() {
  const params = useParams();
  const workerId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  return (
    <RequireClientAuth>
      {() =>
        workerId ? (
          <PortalWorkerEpiSheetContent workerId={workerId} />
        ) : (
          <p className="error">Trabalhador invalido.</p>
        )
      }
    </RequireClientAuth>
  );
}
