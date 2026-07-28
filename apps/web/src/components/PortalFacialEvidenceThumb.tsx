'use client';

import { useEffect, useState } from 'react';
import { fetchPortalDeliveryFacialBlob } from '../lib/client-auth';

/** Miniatura autenticada da evidência facial de uma entrega (dado sensível). */
export function PortalFacialEvidenceThumb({
  deliveryId,
  hasFile,
  fileRemovedByRetention,
  capturedAtLabel,
}: {
  deliveryId: string;
  hasFile: boolean;
  fileRemovedByRetention: boolean;
  capturedAtLabel?: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!hasFile || fileRemovedByRetention) {
      setUrl(null);
      setLoadError(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    void fetchPortalDeliveryFacialBlob(deliveryId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setUrl(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [deliveryId, hasFile, fileRemovedByRetention]);

  if (fileRemovedByRetention) {
    return (
      <p className="portal-evidence-thumb__msg" role="status">
        Evidencia removida por retencao (LGPD).
      </p>
    );
  }

  if (!hasFile) {
    return (
      <p className="portal-evidence-thumb__msg" role="status">
        Sem arquivo de evidencia facial.
      </p>
    );
  }

  if (loadError) {
    return (
      <p className="portal-evidence-thumb__msg" role="status">
        Nao foi possivel carregar a evidencia facial.
      </p>
    );
  }

  if (!url) {
    return (
      <p className="portal-evidence-thumb__msg" role="status">
        Carregando evidencia facial...
      </p>
    );
  }

  return (
    <figure className="portal-evidence-thumb">
      {/* eslint-disable-next-line @next/next/no-img-element -- blob URL autenticado */}
      <img
        src={url}
        alt="Evidencia facial da entrega — dado sensivel"
        className="portal-evidence-thumb__img"
      />
      <figcaption className="portal-evidence-thumb__caption">
        Evidencia facial da entrega — dado sensivel
        {capturedAtLabel ? ` · ${capturedAtLabel}` : ''}
      </figcaption>
    </figure>
  );
}
