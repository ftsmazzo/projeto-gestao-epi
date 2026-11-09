'use client';

import { useEffect, useState } from 'react';
import { fetchOrganizationLogoObjectUrl } from '../lib/organization';

type Props = {
  name: string;
  hasLogo?: boolean;
  /** Subtitulo quando nao ha logo (ex.: Gestao / Distribuidora). */
  subtitle?: string;
};

export function TenantBrand({
  name,
  hasLogo = false,
  subtitle = 'Gestao',
}: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!hasLogo) {
      setSrc(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void fetchOrganizationLogoObjectUrl().then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setSrc(url);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hasLogo]);

  if (src) {
    return (
      <div className="tenant-brand tenant-brand--with-logo">
        <div className="tenant-brand__logo-plate">
          <img src={src} alt={name} className="tenant-brand__logo" />
        </div>
        <span className="tenant-brand__text tenant-brand__text--compact">
          <strong>{name}</strong>
        </span>
      </div>
    );
  }

  return (
    <div className="tenant-brand">
      <span className="tenant-brand__mark" aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="tenant-brand__text">
        <strong>{name}</strong>
        <span>{subtitle}</span>
      </span>
    </div>
  );
}
