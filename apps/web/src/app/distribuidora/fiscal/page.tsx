'use client';

import { FormEvent, useEffect, useState } from 'react';
import { fetchMe } from '../../../lib/auth';
import {
  getDistributorFiscal,
  isDistributorManager,
  saveDistributorFiscal,
  uploadDistributorCertificate,
  type DistributorFiscalProfile,
} from '../../../lib/distributor';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export default function DistribuidoraFiscalPage() {
  const [profile, setProfile] = useState<DistributorFiscalProfile | null>(null);
  const [manager, setManager] = useState(false);
  const [cnpj, setCnpj] = useState('');
  const [uf, setUf] = useState('SP');
  const [stateRegistration, setStateRegistration] = useState('');
  const [regime, setRegime] = useState<'PRESUMIDO' | 'SIMPLES' | 'REAL'>('PRESUMIDO');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([getDistributorFiscal(), fetchMe()])
      .then(([row, me]) => {
        setProfile(row);
        setManager(isDistributorManager(me.membershipRole));
        if (row.cnpj) setCnpj(row.cnpj);
        if (row.uf) setUf(row.uf);
        setStateRegistration(row.stateRegistration ?? '');
        setRegime(row.regime);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Falha ao carregar.'),
      );
  }, []);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const saved = await saveDistributorFiscal({
        cnpj,
        uf,
        stateRegistration: stateRegistration || undefined,
        regime,
      });
      setProfile(saved);
      setNotice('Identidade fiscal salva.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function onCertificate(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Escolha o arquivo A1.');
      return;
    }
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const saved = await uploadDistributorCertificate(file, password);
      setProfile(saved);
      setPassword('');
      setNotice('Certificado guardado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao guardar o certificado.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-page">
      <header className="dash-page-header">
        <div>
          <p className="page-kicker">Cadastro</p>
          <h1 className="page-title">Fiscal</h1>
          <p className="page-lead">
            Cadastre a identidade da empresa e o certificado A1. A autorização na
            SEFAZ só liga depois da homologação — um A1 cobre venda para qualquer
            UF do cliente; a SEFAZ é a do emitente.
          </p>
        </div>
      </header>
      <section className="dash-panel" aria-label="Ordem do go-live">
        <h2 className="dash-panel__title">Ordem até emitir de verdade</h2>
        <ol className="field-hint" style={{ margin: 0, paddingLeft: '1.25rem' }}>
          <li>Salvar CNPJ, UF, IE e regime.</li>
          <li>Guardar o A1 (.pfx + senha) deste CNPJ.</li>
          <li>Conferir NCM e CFOP nos produtos que vão na nota.</li>
          <li>Homologar com o material do contador / Daniel.</li>
          <li>Só então a ProntEPI liga a autorização na SEFAZ.</li>
        </ol>
      </section>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="field-hint">{notice}</p> : null}
      {profile ? (
        <section className="dash-kpi-grid" aria-label="Prontidao fiscal">
          <article className="dash-kpi">
            <p className="dash-kpi__label">Regime</p>
            <p className="dash-kpi__value">{profile.regime === 'PRESUMIDO' ? 'Presumido' : profile.regime === 'SIMPLES' ? 'Simples' : 'Real'}</p>
          </article>
          <article className={`dash-kpi ${profile.certificateUploaded ? 'dash-kpi--ok' : 'dash-kpi--warn'}`}>
            <p className="dash-kpi__label">Certificado A1</p>
            <p className="dash-kpi__value">{profile.certificateUploaded ? 'Guardado' : 'Pendente'}</p>
          </article>
          <article className="dash-kpi">
            <p className="dash-kpi__label">Último NSU</p>
            <p className="dash-kpi__value">{profile.lastNsu}</p>
          </article>
          <article className="dash-kpi">
            <p className="dash-kpi__label">Busca na SEFAZ</p>
            <p className="dash-kpi__value">{profile.signedQueryEnabled ? 'Ligada' : 'Parada'}</p>
          </article>
        </section>
      ) : null}
      {profile ? <p className="field-hint">{profile.note}</p> : null}
      {manager ? (
        <>
          <form className="form dash-panel" onSubmit={onSave}>
            <h2 className="dash-panel__title">Empresa</h2>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="cnpj">CNPJ</label>
                <input id="cnpj" required value={cnpj} onChange={(event) => setCnpj(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="uf">UF</label>
                <select id="uf" value={uf} onChange={(event) => setUf(event.target.value)}>
                  {UFS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ie">Inscrição estadual</label>
                <input
                  id="ie"
                  value={stateRegistration}
                  onChange={(event) => setStateRegistration(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="regime">Regime</label>
                <select
                  id="regime"
                  value={regime}
                  onChange={(event) => setRegime(event.target.value as 'PRESUMIDO' | 'SIMPLES' | 'REAL')}
                >
                  <option value="PRESUMIDO">Lucro presumido</option>
                  <option value="SIMPLES">Simples Nacional</option>
                  <option value="REAL">Lucro real</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              Salvar identidade
            </button>
          </form>
          <form className="form dash-panel" onSubmit={onCertificate}>
            <h2 className="dash-panel__title">Certificado A1</h2>
            <div className="field">
              <label htmlFor="pfx">Arquivo .pfx</label>
              <input
                id="pfx"
                type="file"
                accept=".pfx,.p12,application/x-pkcs12"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="field">
              <label htmlFor="senha-cert">Senha do certificado</label>
              <input
                id="senha-cert"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="off"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              Guardar certificado
            </button>
          </form>
        </>
      ) : (
        <p className="field-hint">A identidade fiscal é do gestor.</p>
      )}
    </div>
  );
}
