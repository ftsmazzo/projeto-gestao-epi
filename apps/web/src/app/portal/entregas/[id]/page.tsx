'use client';

import type { PortalDeliveryDetail } from '@gestao-epi/shared';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DeliveryReceiptView } from '../../../../components/DeliveryReceiptView';
import { RequireClientAuth } from '../../../../components/RequireClientAuth';
import { fetchPortalDelivery } from '../../../../lib/client-auth';

function PortalEntregaDetailContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [detail, setDetail] = useState<PortalDeliveryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void fetchPortalDelivery(id)
      .then((res) => {
        if (!cancelled) {
          setDetail(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Falha ao carregar o comprovante.',
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="portal-home">
      {loading ? <p className="page-lead">Carregando comprovante...</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {detail ? (
        <DeliveryReceiptView detail={detail} onUpdated={setDetail} />
      ) : null}
    </div>
  );
}

export default function PortalEntregaDetailPage() {
  return (
    <RequireClientAuth>
      {() => <PortalEntregaDetailContent />}
    </RequireClientAuth>
  );
}
