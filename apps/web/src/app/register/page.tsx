'use client';

import { APP_NAME } from '@gestao-epi/shared';
import Link from 'next/link';
import { AuthLayout } from '../../components/AuthLayout';

export default function RegisterPage() {
  return (
    <AuthLayout
      kicker={`${APP_NAME} · Consultoria`}
      footer={
        <>
          Ja e cliente? <Link href="/login">Acesse a consultoria</Link>
          <br />
          Empresa cliente? <Link href="/portal/login">Entrar no portal</Link>
        </>
      }
    >
      <p className="page-kicker">Cadastro</p>
      <h1 id="register-title" className="page-title">
        A {APP_NAME} libera sua consultoria
      </h1>
      <p className="page-lead">
        O painel do gestor nao e auto-servico. A franquia de vidas e o acesso
        do dono sao criados no Painel SaaS da {APP_NAME}.
      </p>
      <p className="field-hint">
        Se voce ja recebeu o convite, entre com o e-mail e a senha temporaria.
      </p>
      <Link className="btn btn-primary btn-block" href="/login">
        Entrar na consultoria
      </Link>
    </AuthLayout>
  );
}
