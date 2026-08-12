'use client';

import { useEffect, useState } from 'react';
import { fetchOrganizationLogoObjectUrl } from '../lib/organization';

type Props = {
  name: string;
  hasLogo?: boolean;
};

export function TenantBrand({ name, hasLogo = false }: Props) {
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

  return (
    <div className="tenant-brand">
      {src ? (
        <img src={src} alt={name} className="tenant-brand__logo" />
      ) : (
        <span className="tenant-brand__mark" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="tenant-brand__text">
        <strong>{name}</strong>
        <span>Gestao</span>
      </span>
    </div>
  );
}
