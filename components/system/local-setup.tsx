import { Container, Database, TerminalSquare } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function LocalSetup() {
  return (
    <main
      id="conteudo-principal"
      className="mx-auto flex min-h-dvh w-full max-w-2xl items-center px-5 py-12"
    >
      <div className="w-full">
        <div className="mb-10 flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-foreground text-xs text-background">
            PTA
          </span>
          <span
            className="size-2 rounded-full bg-pta-lime"
            aria-hidden="true"
          />
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Ambiente local
        </p>
        <h1 className="max-w-xl text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
          Falta iniciar o banco local.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          O aplicativo está pronto para usar o Supabase local. As credenciais do
          projeto hospedado não serão usadas nesta fase.
        </p>

        <Alert className="mt-8 bg-muted/60">
          <Container aria-hidden="true" />
          <AlertTitle>Docker Desktop necessário</AlertTitle>
          <AlertDescription>
            Instale e inicie o Docker Desktop antes de executar os comandos
            abaixo.
          </AlertDescription>
        </Alert>

        <ol className="mt-8 space-y-5" aria-label="Passos para iniciar">
          <SetupStep
            icon={Database}
            number="01"
            title="Suba o Supabase"
            command="pnpm db:start"
          />
          <SetupStep
            icon={TerminalSquare}
            number="02"
            title="Crie seu ambiente"
            command="Copy-Item .env.example .env.local"
          />
          <SetupStep
            icon={Database}
            number="03"
            title="Copie as chaves locais"
            command="pnpm db:status"
          />
        </ol>
        <p className="mt-8 text-xs leading-5 text-muted-foreground">
          Depois, preencha somente a URL e a chave publicável em{' '}
          <code>.env.local</code> e reinicie <code>pnpm dev</code>.
        </p>
      </div>
    </main>
  );
}

function SetupStep({
  icon: Icon,
  number,
  title,
  command,
}: {
  icon: typeof Database;
  number: string;
  title: string;
  command: string;
}) {
  return (
    <li className="grid grid-cols-[32px_1fr] gap-3 border-t pt-4">
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-4 text-muted-foreground"
      />
      <div>
        <p className="text-sm font-medium">
          <span className="mr-2 font-mono text-xs text-muted-foreground">
            {number}
          </span>
          {title}
        </p>
        <code className="mt-2 block overflow-x-auto rounded-md bg-foreground px-3 py-2 text-xs text-background">
          {command}
        </code>
      </div>
    </li>
  );
}
