import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gestao Digital de Entrega de EPI',
  description: 'Plataforma de gestao digital de entrega de EPI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
