'use client';

import { useEffect, useState } from 'react';
import { fetchOrganizationLogoObjectUrl } from '../lib/organization';

type Props = {
  name: string;
  hasLogo?: boolean;
  /** Subtitulo quando nao ha logo (ex.: Gestao / Distribuidora). */
  subtitle?: string;
  /**
   * name = so texto (sidebar)
   * logo = so marca na topbar
   * full = logo + nome (preview / consultoria)
   */
  mode?: 'name' | 'logo' | 'full';
};

export function TenantBrand({
  name,
  hasLogo = false,
  subtitle = 'Gestao',
  mode = 'full',
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const wantsLogo = mode !== 'name' && hasLogo;

  useEffect(() => {
    if (!wantsLogo) {
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
  }, [wantsLogo]);

  if (mode === 'logo') {
    if (src) {
      return (
        <div className="tenant-brand tenant-brand--topbar-logo" title={name}>
          <img src={src} alt={name} className="tenant-brand__topbar-logo" />
        </div>
      );
    }
    return (
      <div className="tenant-brand tenant-brand--topbar-logo" title={name}>
        <span className="tenant-brand__mark tenant-brand__mark--topbar" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
      </div>
    );
  }

  if (mode === 'name' || !src) {
    return (
      <div className="tenant-brand">
        <span className="tenant-brand__text">
          <strong>{name}</strong>
          <span>{subtitle}</span>
        </span>
      </div>
    );
  }

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
