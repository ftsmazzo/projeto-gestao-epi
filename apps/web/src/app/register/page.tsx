'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
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
    <main>
      <section className="panel">
        <p className="eyebrow">Onboarding</p>
        <h1>Registrar organizacao</h1>
        <p>
          Cria a empresa usuaria (tenant) e o usuario dono. Cliente atendido e
          cotas por cliente ficam para subetapas futuras.
        </p>

        <form className="form" onSubmit={onSubmit}>
          <label>
            Seu nome
            <input
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Nome da organizacao (tenant)
            <input
              required
              minLength={2}
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
          </label>
          <label>
            Franquia total de vidas contratadas
            <input
              type="number"
              min={0}
              value={contractedLifeQuota}
              onChange={(e) => setContractedLifeQuota(e.target.value)}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? 'Registrando...' : 'Criar conta'}
          </button>
        </form>

        <p className="muted-link">
          Ja tem conta? <Link href="/login">Entrar</Link>
        </p>
      </section>
    </main>
  );
}
