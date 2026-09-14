import { NextRequest, NextResponse } from 'next/server';

const MARKETING_HOSTS = new Set(['prontepi.com.br', 'www.prontepi.com.br']);
const PLATFORM_HOST = 'plataforma.prontepi.com.br';

const SYSTEM_PREFIXES = [
  '/dashboard',
  '/clientes',
  '/certificados',
  '/configuracoes',
  '/epi-needs',
  '/epis',
  '/caepi',
  '/entregas',
  '/estoque',
  '/trabalhadores',
  '/relatorios',
  '/documentos',
  '/assinaturas',
  '/conta',
  '/portal',
  '/login',
  '/register',
  '/esqueci-senha',
  '/plataforma',
];

function stripPort(host: string) {
  return host.split(':')[0].toLowerCase();
}

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = stripPort(request.headers.get('host') ?? '');
  const { pathname, search } = url;

  if (MARKETING_HOSTS.has(host)) {
    if (pathname === '/') {
      url.pathname = '/produto';
      return NextResponse.redirect(url, 308);
    }

    if (startsWithAny(pathname, SYSTEM_PREFIXES)) {
      return NextResponse.redirect(`https://${PLATFORM_HOST}${pathname}${search}`, 308);
    }
  }

  if (host === PLATFORM_HOST) {
    if (pathname === '/') {
      url.pathname = '/login';
      return NextResponse.redirect(url, 308);
    }

    if (pathname === '/produto' || pathname.startsWith('/produto/')) {
      url.pathname = '/login';
      url.search = '';
      return NextResponse.redirect(url, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
