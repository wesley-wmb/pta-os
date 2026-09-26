import type { ReactNode } from 'react';
import { CalendarDays, Check, Layers, ListTodo } from 'lucide-react';

import { PtaMark } from '@/components/brand/pta-mark';

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main
      id="conteudo-principal"
      className="grid min-h-dvh bg-background lg:grid-cols-2"
    >
      <aside className="pta-auth-aside relative hidden overflow-hidden border-r p-10 lg:flex lg:flex-col xl:p-14">
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-foreground text-background">
            <PtaMark className="h-7 w-auto" />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-[0.08em]">
              PTA OS
            </span>
            <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
              Seu espaço de trabalho
            </span>
          </span>
        </div>

        <div className="relative z-10 my-auto max-w-lg py-16">
          <p className="pta-eyebrow">Espaço para o que importa</p>
          <h2 className="mt-4 text-[clamp(2.25rem,3.2vw,3.4rem)] font-semibold leading-[1.02] tracking-[-0.025em]">
            Clareza para pensar.
            <br />
            Espaço para realizar.
          </h2>
          <p className="mt-5 max-w-sm text-base leading-7 text-muted-foreground">
            O trabalho da equipe encontra seu lugar. Das primeiras ideias à
            próxima entrega.
          </p>
          <div
            className="mt-10 space-y-0 divide-y border-y"
            aria-label="Organize seu trabalho"
          >
            {[
              {
                icon: ListTodo,
                label: 'Demandas com contexto',
                description: 'Cada próximo passo, no lugar certo.',
              },
              {
                icon: CalendarDays,
                label: 'Uma semana mais clara',
                description: 'Prazos e prioridades em perspectiva.',
              },
              {
                icon: Layers,
                label: 'Uma equipe conectada',
                description: 'Pessoas, projetos e recursos juntos.',
              },
            ].map(({ icon: Icon, label, description }) => (
              <div key={label} className="flex items-center gap-4 py-5">
                <Icon
                  className="size-5 shrink-0 text-primary"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {description}
                  </p>
                </div>
                <Check
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          PTA OS · Um lugar para fazer acontecer.
        </p>
      </aside>

      <div className="grid place-items-center px-6 py-12 sm:px-12">
        <section
          className="relative w-full max-w-[420px]"
          aria-labelledby="auth-title"
        >
          <div className="mb-12 flex items-center gap-2 text-sm font-semibold tracking-tight lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-foreground text-background">
              <PtaMark className="h-6 w-auto" />
            </span>
            <span className="tracking-[0.08em]">PTA OS</span>
          </div>

          <header className="mb-8">
            <p className="pta-eyebrow mb-2">Acesso ao workspace</p>
            <h1
              id="auth-title"
              className="text-[clamp(2rem,6vw,2.65rem)] font-semibold leading-[1.1] tracking-[-0.04em]"
            >
              {title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </header>

          {children}

          <p className="mt-10 border-t pt-5 text-xs leading-5 text-muted-foreground">
            {footer}
          </p>
        </section>
      </div>
    </main>
  );
}
