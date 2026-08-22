import { CircleAlert, Inbox } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center"
    >
      <CircleAlert aria-hidden="true" className="size-5 text-destructive" />
      <h2 className="mt-4 text-base font-semibold">
        Não foi possível carregar as demandas.
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Seus dados não foram alterados.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-5"
        onClick={onRetry}
      >
        Tentar novamente
      </Button>
    </div>
  );
}

export function EmptyTasks({
  filtered = false,
  onClear,
}: {
  filtered?: boolean;
  onClear?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <Inbox aria-hidden="true" className="size-5 text-muted-foreground" />
      <h2 className="mt-4 text-base font-semibold">
        {filtered
          ? 'Nenhuma demanda corresponde a estes filtros.'
          : 'Nenhuma demanda criada.'}
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {filtered
          ? 'Ajuste os filtros para ampliar os resultados.'
          : 'Crie a primeira demanda para começar a organizar a operação.'}
      </p>
      {filtered && onClear ? (
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          onClick={onClear}
        >
          Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}
