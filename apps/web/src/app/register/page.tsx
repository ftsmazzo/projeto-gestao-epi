'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/AppShell';
import { registerAccount } from '../../lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [contractedLifeQuota, setContractedLifeQuota] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerAccount({
        name,
        email,
        password,
        organizationName,
        contractedLifeQuota: Number(contractedLifeQuota) || 0,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no registro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      headerActions={
        <Link className="btn btn-secondary" href="/login">
          Entrar
        </Link>
      }
    >
      <div className="auth-layout">
        <section
          className="auth-panel auth-panel--wide"
          aria-labelledby="register-title"
        >
          <p className="page-kicker">Onboarding</p>
          <h1 id="register-title" className="page-title">
            Registrar organizacao
          </h1>
          <p className="page-lead">
            Cria a empresa usuaria (tenant) e o usuario dono. Clientes atendidos
            e cotas por cliente entram nas proximas etapas.
          </p>

          <form className="form" onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="register-name">Seu nome</label>
              <input
                id="register-name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="register-email">Email</label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="register-password">Senha</label>
              <input
                id="register-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="field-hint">Minimo de 8 caracteres.</p>
            </div>
            <div className="field">
              <label htmlFor="register-org">Nome da organizacao (tenant)</label>
              <input
                id="register-org"
                required
                minLength={2}
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="register-quota">
                Franquia total de vidas contratadas
              </label>
              <input
                id="register-quota"
                type="number"
                min={0}
                value={contractedLifeQuota}
                onChange={(e) => setContractedLifeQuota(e.target.value)}
              />
              <p className="field-hint">
                Valor total do contrato. Distribuicao por cliente vem depois.
              </p>
            </div>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Registrando...' : 'Criar conta'}
            </button>
          </form>

          <p className="form-footer">
            Ja tem conta? <Link href="/login">Entrar</Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
