import type { Metadata } from 'next';

import { AppProviders } from '@/components/providers/app-providers';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'PTA OS',
    template: '%s · PTA OS',
  },
  description: 'Demandas, semana e contexto operacional em um só lugar.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <a
          href="#conteudo-principal"
          className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background shadow-lg transition-transform focus:translate-y-0"
        >
          Ir para o conteúdo
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
