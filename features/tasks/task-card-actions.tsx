'use client';
import { Trash2, Link2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { taskHrefWithReturn } from './task-return-path';
import type { TaskOverview } from './types';
export function TaskCardActions({
  task,
  children,
  disabled = false,
}: {
  task: TaskOverview;
  children: ReactElement;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const params = useSearchParams();
  const returnPath = `${pathname}${params.size ? `?${params.toString()}` : ''}`;
  const [pending, setPending] = useState(false);
  async function archive(archived: boolean, version: number) {
    setPending(true);
    const { data, error } = await createClient().rpc('set_task_card_archived', {
      p_workspace_id: task.workspace_id,
      p_task_id: task.id,
      p_expected_version: version,
      p_archived: archived,
    });
    setPending(false);
    if (error) {
      toast.error(
        error.message.includes('VERSION_CONFLICT')
          ? 'A tarefa foi alterada em outra sessão. Atualize e tente novamente.'
          : 'Não foi possível alterar o card.',
      );
      return;
    }
    await queryClient.invalidateQueries({
      predicate: (query) => query.queryKey.includes(task.workspace_id),
    });
    if (archived)
      toast.success('Card excluído dos quadros.', {
        action: { label: 'Desfazer', onClick: () => void archive(false, data) },
        duration: 10000,
      });
    else toast.success('Card restaurado.');
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        disabled={disabled || pending}
        onKeyDown={(event) => {
          if (
            event.key === 'ContextMenu' ||
            (event.shiftKey && event.key === 'F10')
          ) {
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            event.currentTarget.dispatchEvent(
              new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: rect.left + 24,
                clientY: rect.top + 24,
              }),
            );
          }
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent onPointerDown={(event) => event.stopPropagation()}>
        <ContextMenuItem asChild>
          <Link href={taskHrefWithReturn(task.id, returnPath)} scroll={false}>
            <Link2 />
            Editar tarefa
          </Link>
        </ContextMenuItem>
        {task.event_id ? (
          <ContextMenuItem asChild>
            <Link href={`/projetos/${task.event_id}?visao=board`}>
              <Link2 />
              Abrir equipe vinculada
            </Link>
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem
          disabled={pending || disabled}
          onSelect={() => void archive(true, task.version)}
          className="text-destructive"
        >
          <Trash2 />
          Excluir card
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
