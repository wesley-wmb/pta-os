import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export function OperationEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <section className="border-y px-1 py-12 sm:py-14">
      <div className="flex max-w-xl items-start gap-4">
        <span className="grid size-9 shrink-0 place-items-center text-muted-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold leading-6">{title}</h2>
          {description ? (
            <p className="mt-2 text-[15px] leading-[23px] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function OperationMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'neutral',
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
  tone?: 'neutral' | 'blue' | 'lime' | 'danger';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-w-0 border-l px-3 py-5 first:border-l-0 sm:px-5 sm:py-6',
        className,
      )}
    >
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-xs">
        <Icon
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0',
            tone === 'blue' && 'text-pta-blue',
            tone === 'lime' && 'text-pta-lime-foreground',
            tone === 'danger' && 'text-destructive',
          )}
        />
        {label}
      </p>
      <strong
        className={cn(
          'mt-2 block text-2xl font-semibold tracking-[-0.025em] sm:text-3xl',
          tone === 'danger' && 'text-destructive',
        )}
      >
        {value}
      </strong>
      <p className="mt-1 hidden text-xs leading-4 text-muted-foreground sm:block">
        {detail}
      </p>
    </div>
  );
}

export function InitialsMark({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold text-foreground',
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function OperationsPageSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[1200px] px-5 pb-12 pt-8 sm:px-8"
      aria-busy="true"
      aria-label="Carregando conteúdo"
    >
      <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
      <div className="mt-4 h-9 w-64 max-w-full animate-pulse rounded-md bg-muted" />
      <div className="mt-3 h-4 w-[28rem] max-w-full animate-pulse rounded-sm bg-muted" />
      <div className="mt-8 grid grid-cols-3 border-y py-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border-l px-4 first:border-l-0">
            <div className="h-3 w-20 animate-pulse rounded-sm bg-muted" />
            <div className="mt-3 h-8 w-12 animate-pulse rounded-sm bg-muted" />
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-48 animate-pulse border-t bg-muted/60"
          />
        ))}
      </div>
    </div>
  );
}
