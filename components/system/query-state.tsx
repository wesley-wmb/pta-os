import { CircleAlert, Inbox } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="max-w-lg px-1 py-14">
      <CircleAlert aria-hidden="true" className="size-5 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold leading-6">
        A lista de demandas não carregou.
      </h2>
      <p className="mt-2 text-[15px] leading-[23px] text-muted-foreground">
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
    <div className="max-w-lg px-1 py-14">
      <Inbox aria-hidden="true" className="size-5 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold leading-6">
        {filtered
          ? 'Nenhuma demanda corresponde aos filtros'
          : 'Crie a primeira demanda'}
      </h2>
      <p className="mt-2 text-[15px] leading-[23px] text-muted-foreground">
        {filtered
          ? 'Revise os filtros ou limpe a seleção.'
          : 'Registre a entrega, defina o prazo e atribua um responsável.'}
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
