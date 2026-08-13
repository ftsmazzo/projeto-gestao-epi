'use client';

import type { AuthUser } from '@gestao-epi/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import { BiometriaSection } from '../../components/settings/BiometriaSection';
import { ContatosSection } from '../../components/settings/ContatosSection';
import { MarcaSection } from '../../components/settings/MarcaSection';
import { EquipeSection } from '../../components/settings/EquipeSection';
import { ResetSection } from '../../components/settings/ResetSection';
import { SenhaSection } from '../../components/settings/SenhaSection';
import {
  parseSettingsSection,
  SETTINGS_NAV,
  type SettingsSectionId,
} from '../../components/settings/settings-sections';

export default function ConfiguracoesPage() {
  return (
    <RequireAuth>
      {(user) => (
        <Suspense
          fallback={
            <p className="field-hint" role="status">
              Carregando configuracoes...
            </p>
          }
        >
          <ConfiguracoesHub user={user} />
        </Suspense>
      )}
    </RequireAuth>
  );
}

function ConfiguracoesHub({ user }: { user: AuthUser }) {
  const searchParams = useSearchParams();
  const section = parseSettingsSection(searchParams.get('aba'));

  return (
    <div className="module-page settings-page">
      <header className="module-header">
        <div>
          <p className="page-kicker">Consultoria</p>
          <h1 className="page-title">Configuracoes</h1>
          <p className="page-lead">
            Conta de <strong>{user.organization.name}</strong>: marca, contatos,
            equipe, retencao biometrica e reset geral — no mesmo lugar.
          </p>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-rail" aria-label="Secoes de configuracao">
          {SETTINGS_NAV.map((group) => (
            <div key={group.id} className="settings-rail__group">
              <p className="settings-rail__label">{group.label}</p>
              <ul>
                {group.items.map((item) => {
                  const active = section === item.id;
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/configuracoes?aba=${item.id}`}
                        className={`settings-rail__link${active ? ' is-active' : ''}${item.danger ? ' is-danger' : ''}`}
                        aria-current={active ? 'page' : undefined}
                      >
                        <span className="settings-rail__name">{item.label}</span>
                        <span className="settings-rail__hint">{item.hint}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="settings-main" role="region" aria-live="polite">
          <SettingsSectionBody section={section} user={user} />
        </div>
      </div>
    </div>
  );
}

function SettingsSectionBody({
  section,
  user,
}: {
  section: SettingsSectionId;
  user: AuthUser;
}) {
  switch (section) {
    case 'senha':
      return <SenhaSection user={user} />;
    case 'equipe':
      return (
        <EquipeSection
          currentUserId={user.id}
          currentRole={user.membershipRole}
        />
      );
    case 'biometria':
      return <BiometriaSection role={user.membershipRole} />;
    case 'reset':
      return <ResetSection role={user.membershipRole} />;
    case 'contatos':
      return <ContatosSection />;
    case 'marca':
    default:
      return <MarcaSection user={user} />;
  }
}
