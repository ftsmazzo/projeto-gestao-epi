'use client';

import type { PortalWorkerEpiSheetResponse } from '@gestao-epi/shared';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { RequireClientAuth } from '../../../../../components/RequireClientAuth';
import { WorkerEpiSheetView } from '../../../../../components/WorkerEpiSheetView';
import { fetchPortalWorkerEpiSheet } from '../../../../../lib/client-auth';

function PortalWorkerEpiSheetContent({ workerId }: { workerId: string }) {
  const [scope, setScope] = useState<'history' | 'open'>('history');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [data, setData] = useState<PortalWorkerEpiSheetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (
      nextScope: 'history' | 'open',
      nextFrom: string,
      nextTo: string,
    ) => {
      setLoading(true);
      setError(null);
      void fetchPortalWorkerEpiSheet(workerId, nextScope, {
        from: nextFrom || undefined,
        to: nextTo || undefined,
      })
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
    load(scope, appliedFrom, appliedTo);
  }, [load, scope, appliedFrom, appliedTo]);

  const applyPeriod = () => {
    setAppliedFrom(from.trim());
    setAppliedTo(to.trim());
  };

  const clearPeriod = () => {
    setFrom('');
    setTo('');
    setAppliedFrom('');
    setAppliedTo('');
  };

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
          periodFrom={from}
          periodTo={to}
          onPeriodFromChange={setFrom}
          onPeriodToChange={setTo}
          onApplyPeriod={applyPeriod}
          onClearPeriod={clearPeriod}
          periodLoading={loading}
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
