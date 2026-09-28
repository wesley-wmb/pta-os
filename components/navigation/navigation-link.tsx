'use client';

import Link, { useLinkStatus } from 'next/link';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/** Keeps feedback local to the latest navigation, without delaying its commit. */
export function NavigationLink({
  children,
  className,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={cn('relative active:bg-primary/10', className)}>
      {children}
      <NavigationHint />
    </Link>
  );
}

function NavigationHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      data-navigation-pending={pending || undefined}
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] bg-primary/10 ring-1 ring-inset ring-primary/25 transition-opacity duration-150 motion-reduce:transition-none',
        pending ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}
