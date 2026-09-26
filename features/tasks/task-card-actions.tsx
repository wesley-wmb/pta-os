'use client';
import { MoreHorizontal, Trash2, Link2 } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { taskHrefWithReturn } from './task-return-path';
import type { TaskOverview } from './types';
export function TaskCardActions({ task }: { task: TaskOverview }) {
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
    <div
      className="relative z-10"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={`Ações do card ${task.title}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={taskHrefWithReturn(task.id, returnPath)} scroll={false}>
              <Link2 />
              Editar tarefa
            </Link>
          </DropdownMenuItem>
          {task.event_id ? (
            <DropdownMenuItem asChild>
              <Link href={`/projetos/${task.event_id}?visao=board`}>
                <Link2 />
                Abrir projeto vinculado
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={() => void archive(true, task.version)}
            className="text-destructive"
          >
            <Trash2 />
            Excluir card
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
