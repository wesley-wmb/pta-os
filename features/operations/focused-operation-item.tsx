'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

export function FocusedOperationItem({
  id,
  active,
  children,
  className,
}: {
  id: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const itemRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!active) return;

    const frame = window.requestAnimationFrame(() => {
      itemRef.current?.focus({ preventScroll: true });
      itemRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [active, id]);

  return (
    <li
      ref={itemRef}
      id={id}
      tabIndex={active ? -1 : undefined}
      aria-current={active ? 'true' : undefined}
      data-search-target={active ? 'true' : undefined}
      className={cn(
        'scroll-mt-20 rounded-md outline-none transition-[background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4',
        active &&
          'bg-accent/55 ring-2 ring-pta-blue/30 ring-offset-4 ring-offset-background',
        className,
      )}
    >
      {active ? (
        <span className="sr-only">Resultado selecionado pela busca.</span>
      ) : null}
      {children}
    </li>
  );
}
