'use client';

import { APP_NAME } from '@gestao-epi/shared';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { BrandLockup } from '../../components/BrandLockup';

type Asset = {
  label: string;
  path: string;
  note: string;
};

const BRAND: Asset[] = [
  {
    label: 'Símbolo SVG (sem texto)',
    path: '/brand/prontepi-mark.svg',
    note: 'Vetor. Favicon, ícone, sistemas que aceitam SVG.',
  },
  {
    label: 'Símbolo PNG',
    path: '/brand/prontepi-mark.png',
    note: 'Escudo + P, fundo escuro, sem wordmark.',
  },
  {
    label: 'Símbolo PNG (web)',
    path: '/brand/prontepi-mark-web.png',
    note: 'Versão para Apple touch / preview.',
  },
  {
    label: 'Lockup SVG (com texto)',
    path: '/brand/prontepi-lockup.svg',
    note: 'Marca + ProntEPI em vetor.',
  },
  {
    label: 'Lockup PNG (com texto)',
    path: '/brand/prontepi-lockup.png',
    note: 'Marca + ProntEPI em raster.',
  },
  {
    label: 'Ícone 180',
    path: '/brand/prontepi-icon-180.png',
    note: 'Apple 180×180',
  },
  {
    label: 'Ícone 192',
    path: '/brand/prontepi-icon-192.png',
    note: 'PWA 192×192',
  },
  {
    label: 'Ícone 512',
    path: '/brand/prontepi-icon-512.png',
    note: 'PWA 512×512',
  },
  {
    label: 'Favicon',
    path: '/favicon.png',
    note: 'Aba do navegador',
  },
];

const SCREENS: Asset[] = [
  {
    label: 'Home',
    path: '/branding/screens/home.png',
    note: 'Página inicial pública (captura 2026-08)',
  },
  {
    label: 'Login consultoria',
    path: '/branding/screens/login-consultoria.png',
    note: 'Acesso da gestão',
  },
  {
    label: 'Login portal',
    path: '/branding/screens/login-portal.png',
    note: 'Painel do cliente',
  },
  {
    label: 'Landing produto',
    path: '/branding/screens/produto.png',
    note: '/produto',
  },
  {
    label: 'Painel',
    path: '/ajuda/portal/painel.png',
    note: 'Portal — painel',
  },
  {
    label: 'Entregas',
    path: '/ajuda/portal/entregas.png',
    note: 'Portal — entregas',
  },
  {
    label: 'Estoque',
    path: '/ajuda/portal/estoque.png',
    note: 'Portal — estoque',
  },
  {
    label: 'Validade',
    path: '/ajuda/portal/validade.png',
    note: 'Portal — validade',
  },
  {
    label: 'Trabalhadores',
    path: '/ajuda/portal/trabalhadores.png',
    note: 'Portal — trabalhadores',
  },
  {
    label: 'Relatórios',
    path: '/ajuda/portal/relatorios.png',
    note: 'Portal — relatórios',
  },
  {
    label: 'Estrutura',
    path: '/ajuda/portal/estrutura.png',
    note: 'Portal — estrutura',
  },
  {
    label: 'Custos',
    path: '/ajuda/portal/custos.png',
    note: 'Portal — custos',
  },
  {
    label: 'Conta',
    path: '/ajuda/portal/conta.png',
    note: 'Portal — conta',
  },
  {
    label: 'Ficha de EPI',
    path: '/ajuda/portal/ficha-epi.png',
    note: 'Portal — ficha',
  },
  {
    label: 'Comprovante',
    path: '/ajuda/portal/comprovante.png',
    note: 'Portal — comprovante',
  },
  {
    label: 'Importar CSV',
    path: '/ajuda/portal/importar-csv.png',
    note: 'Portal — importação',
  },
  {
    label: 'Saldos de estoque',
    path: '/ajuda/portal/estoque-saldos.png',
    note: 'Portal — saldos',
  },
  {
    label: 'Painel mobile',
    path: '/ajuda/portal/painel-mobile.png',
    note: 'Portal no celular',
  },
  {
    label: 'Entregas mobile',
    path: '/ajuda/portal/entregas-mobile.png',
    note: 'Entregas no celular',
  },
  {
    label: 'Marketing — painel',
    path: '/marketing/painel.png',
    note: 'Landing / ads',
  },
  {
    label: 'Marketing — entregas',
    path: '/marketing/entregas.png',
    note: 'Landing / ads',
  },
  {
    label: 'Marketing — estoque',
    path: '/marketing/estoque.png',
    note: 'Landing / ads',
  },
];

function CopyField({ url }: { url: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      setDone(false);
    }
  }

  return (
    <div className="brand-kit__copy">
      <input readOnly value={url} aria-label="URL do arquivo" />
      <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
        {done ? 'Copiado' : 'Copiar link'}
      </button>
      <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
        Abrir
      </a>
    </div>
  );
}

function AssetCard({ asset, origin }: { asset: Asset; origin: string }) {
  const url = `${origin}${asset.path}`;
  return (
    <article className="brand-kit__card">
      <div className="brand-kit__preview">
        <img src={asset.path} alt={asset.label} />
      </div>
      <h3>{asset.label}</h3>
      <p>{asset.note}</p>
      <CopyField url={url} />
    </article>
  );
}

export default function BrandingPage() {
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const hostHint = useMemo(
    () => origin || 'https://gestao-epi-web.kxryyk.easypanel.host',
    [origin],
  );

  return (
    <AppShell
      headerActions={
        <Link className="btn btn-ghost" href="/">
          Voltar
        </Link>
      }
    >
      <section className="brand-kit">
        <header className="brand-kit__hero">
          <BrandLockup onDark={false} subtitle="Kit de marca" />
          <h1 className="page-title">Branding {APP_NAME}</h1>
          <p className="page-lead">
            Links diretos para colar em outro sistema (Notion, n8n, site, WhatsApp).
            Os URLs usam o domínio desta página.
          </p>
          <p className="muted">
            Exemplo de produção:{' '}
            <code>{hostHint}/brand/prontepi-mark.svg</code>
          </p>
        </header>

        <h2>Marca</h2>
        <div className="brand-kit__grid">
          {BRAND.map((asset) => (
            <AssetCard key={asset.path} asset={asset} origin={hostHint} />
          ))}
        </div>

        <h2>Telas</h2>
        <p className="page-lead">
          Cada card tem o link direto da imagem para colar. As quatro primeiras são
          capturas novas (home e logins). As demais são as telas do portal já no ar.
        </p>
        <div className="brand-kit__grid brand-kit__grid--wide">
          {SCREENS.map((asset) => (
            <AssetCard key={asset.path} asset={asset} origin={hostHint} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
