'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  cloneElement,
  isValidElement,
  useState,
  type ReactNode,
  type Ref,
} from 'react';

import { cn } from '@/lib/utils';

/** One viewport and column rhythm for status and weekly planning boards. */
export function TaskBoardViewport({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className="pta-board-scroll pta-kanban-scroll min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden px-4 pb-3 pt-4 sm:px-6"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <div className="flex h-full min-h-0 w-max min-w-full items-stretch gap-4">
        {children}
      </div>
    </div>
  );
}

export function TaskBoardColumn({
  ref,
  id,
  title,
  coverUrl,
  icon,
  dragHandle,
  description,
  count,
  isOver,
  highlighted,
  children,
  action,
  headerAction,
}: {
  ref: Ref<HTMLElement>;
  id: string;
  title: string;
  coverUrl?: string | null;
  icon?: ReactNode;
  dragHandle?: ReactNode;
  description?: ReactNode;
  count: number;
  isOver: boolean;
  highlighted?: boolean;
  children: ReactNode;
  action?: ReactNode;
  headerAction?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const contentId = `${id}-content`;

  return (
    <section
      ref={ref}
      aria-labelledby={id}
      className={cn(
        'pta-board-column flex h-full min-h-0 shrink-0 flex-col gap-2 rounded-lg border border-transparent transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none',
        collapsed ? 'w-14' : 'w-[304px] xl:w-[320px]',
        highlighted && 'border-primary/30 bg-primary/[0.035]',
        isOver &&
          'border-primary/60 bg-primary/[0.08] ring-2 ring-inset ring-primary/20',
      )}
    >
      {!collapsed && coverUrl ? (
        // External media stays at its original HTTPS host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={`Capa da coluna ${title}`}
          referrerPolicy="no-referrer"
          draggable={false}
          className="h-28 w-full shrink-0 rounded-lg object-cover"
        />
      ) : null}
      <header
        className={cn(
          'pta-board-column-header flex min-h-12 shrink-0 items-center gap-1.5 rounded-lg bg-muted/65 px-2 py-1.5',
          collapsed && 'flex-col gap-3 py-3',
        )}
      >
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={contentId}
          aria-label={`${collapsed ? 'Expandir' : 'Recolher'} coluna ${title}`}
          onClick={() => setCollapsed((value) => !value)}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:size-11 [@media(pointer:coarse)]:size-11"
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" className="size-3.5" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-3.5" />
          )}
        </button>
        {!collapsed ? icon : null}
        <div className="min-w-0 flex-1">
          <h3
            id={id}
            className={cn(
              'truncate text-[15px] font-semibold leading-6 tracking-[-0.01em]',
              collapsed && '[writing-mode:vertical-rl]',
            )}
            title={title}
          >
            {!collapsed &&
            isValidElement<{ className?: string; children?: ReactNode }>(
              dragHandle,
            )
              ? cloneElement(dragHandle, {
                  className:
                    'flex h-9 w-full min-w-0 cursor-grab touch-none items-center justify-start rounded-md px-1 text-left text-[15px] font-semibold hover:bg-background/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
                  children: <span className="truncate">{title}</span>,
                })
              : title}
          </h3>
          {!collapsed && description ? (
            <div className="truncate text-[13px] leading-5 text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        <span
          className="grid min-w-5 shrink-0 place-items-center px-1 text-[13px] font-medium tabular-nums text-muted-foreground"
          aria-label={`${count} ${count === 1 ? 'tarefa' : 'tarefas'}`}
        >
          {count}
        </span>
        {!collapsed && headerAction ? (
          <div className="shrink-0">{headerAction}</div>
        ) : null}
      </header>
      <div
        id={contentId}
        hidden={collapsed}
        className="pta-scrollbar min-h-0 overflow-y-auto overscroll-y-contain rounded-lg bg-muted/40 p-2"
      >
        <div className="space-y-1.5">{children}</div>
        {action}
      </div>
    </section>
  );
}

export function TaskBoardEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 py-3 text-[13px] leading-5 text-muted-foreground">
      {children}
    </p>
  );
}
