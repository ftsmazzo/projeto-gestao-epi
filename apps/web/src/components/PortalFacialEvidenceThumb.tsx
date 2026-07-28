'use client';

import { useEffect, useState } from 'react';
import { fetchPortalDeliveryFacialBlob } from '../lib/client-auth';

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Falha ao converter imagem.'));
    };
    reader.onerror = () => reject(new Error('Falha ao ler imagem facial.'));
    reader.readAsDataURL(blob);
  });
}

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

    let cancelled = false;

    void fetchPortalDeliveryFacialBlob(deliveryId)
      .then((blob) => blobToDataUrl(blob))
      .then((dataUrl) => {
        if (cancelled) return;
        setUrl(dataUrl);
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
        Sem arquivo de evidencia facial no storage.
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
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL autenticado (imprime corretamente) */}
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
