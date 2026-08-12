'use client';

import type { AuthUser } from '@gestao-epi/shared';
import { FormEvent, useEffect, useState } from 'react';
import {
  deleteOrganizationLogo,
  fetchOrganizationLogoObjectUrl,
  uploadOrganizationLogo,
} from '../../lib/organization';

export function MarcaSection({ user }: { user: AuthUser }) {
  const canEdit =
    user.membershipRole === 'OWNER' || user.membershipRole === 'ADMIN';
  const [hasLogo, setHasLogo] = useState(user.organization.hasLogo);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasLogo) {
      setPreview(null);
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
      setPreview(url);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hasLogo]);

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem(
      'logo-file',
    ) as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setError('Selecione um arquivo de logo.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await uploadOrganizationLogo(file);
      setHasLogo(true);
      setSuccess('Logo atualizado. Ele aparece no painel da consultoria.');
      if (input) input.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar logo.');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteOrganizationLogo();
      setHasLogo(false);
      setSuccess('Logo removido.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover logo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dash-panel" aria-labelledby="marca-title">
      <h2 id="marca-title" className="dash-panel__title">
        Marca da consultoria
      </h2>
      <p className="page-lead">
        O logo de <strong>{user.organization.name}</strong> aparece no painel
        do gestor. O rodape continua ProntEPI.
      </p>
      <div className="tenant-brand tenant-brand--preview">
        {preview ? (
          <img src={preview} alt={user.organization.name} className="tenant-brand__logo" />
        ) : (
          <span className="tenant-brand__mark" aria-hidden="true">
            {user.organization.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="tenant-brand__text">
          <strong>{user.organization.name}</strong>
          <span>Gestao</span>
        </span>
      </div>
      {canEdit ? (
        <form className="form" onSubmit={onUpload}>
          <div className="field">
            <label htmlFor="logo-file">Arquivo (PNG, JPG, WEBP ou SVG, ate 2 MB)</label>
            <input
              id="logo-file"
              name="logo-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={saving}
            />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Enviando...' : 'Salvar logo'}
            </button>
            {hasLogo ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={saving}
                onClick={() => void onRemove()}
              >
                Remover
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="field-hint">Somente OWNER ou ADMIN alteram a marca.</p>
      )}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="field-hint" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );
}
