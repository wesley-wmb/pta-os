import { cn } from '@/lib/utils';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  width = 'workspace',
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  width?: 'reading' | 'workspace' | 'wide';
  compact?: boolean;
}) {
  return (
    <header
      className={cn(
        'mx-auto flex w-full flex-col pta-page-heading gap-4 px-4 pb-6 pt-6 sm:px-6 sm:pt-7 lg:flex-row lg:items-end lg:justify-between',
        width === 'reading' && 'max-w-[900px]',
        width === 'workspace' && 'max-w-[1200px]',
        width === 'wide' && 'max-w-[1500px]',
        compact &&
          'max-w-none min-h-10 flex-row items-center justify-between gap-3 px-4 py-0 sm:px-6 sm:py-0 lg:items-center',
      )}
    >
      <div className="min-w-0">
        {eyebrow && !compact ? (
          <p className="pta-eyebrow mb-2.5">{eyebrow}</p>
        ) : null}
        <h1
          className={cn(
            'text-balance text-[30px] font-semibold leading-[1.2] tracking-[-0.025em] sm:text-[34px]',
            compact && 'text-xl sm:text-[22px]',
          )}
        >
          {title}
        </h1>
        <p
          className={cn(
            'mt-2 max-w-2xl text-base text-muted-foreground',
            compact && 'sr-only',
          )}
        >
          {description}
        </p>
      </div>
      {actions ? (
        <div
          className={cn(
            'min-w-0 w-full lg:w-auto lg:shrink-0',
            compact && 'w-auto',
          )}
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
}
