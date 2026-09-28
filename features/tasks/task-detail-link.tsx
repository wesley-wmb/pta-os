'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ComponentProps } from 'react';

import { NavigationLink } from '@/components/navigation/navigation-link';

import { taskDetailQueryOptions } from './queries';
import { taskHrefWithReturn, taskReturnContext } from './task-return-path';

export function TaskDetailLink({
  taskId,
  workspaceId,
  onPointerEnter,
  onFocus,
  onPointerDown,
  ...props
}: Omit<ComponentProps<typeof NavigationLink>, 'href' | 'scroll'> & {
  taskId: string;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const returnPath = taskReturnContext(pathname, search);

  function warmDetail() {
    // Intent only: a board with hundreds of cards must not fetch every detail.
    void queryClient.prefetchQuery(taskDetailQueryOptions(workspaceId, taskId));
  }

  return (
    <NavigationLink
      {...props}
      href={taskHrefWithReturn(taskId, returnPath)}
      scroll={false}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (!event.defaultPrevented) warmDetail();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (!event.defaultPrevented) warmDetail();
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented && event.button === 0) warmDetail();
      }}
    />
  );
}
