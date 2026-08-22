'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
};

const notificationSchema = z.object({
  id: z.uuid(),
  entity_type: z.string(),
  entity_id: z.uuid(),
  title: z.string(),
  body: z.string().nullable(),
  created_at: z.string(),
  read_at: z.string().nullable(),
});

const notificationKey = (workspaceId: string) =>
  ['notifications', workspaceId] as const;

export function NotificationMenu({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryKey = notificationKey(workspaceId);
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('notifications')
        .select('id, entity_type, entity_id, title, body, created_at, read_at')
        .eq('workspace_id', workspaceId)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return notificationSchema
        .array()
        .parse(data ?? []) satisfies Notification[];
    },
  });
  const notifications = query.data ?? [];
  const unread = notifications.filter((item) => !item.read_at).length;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () =>
          queryClient.invalidateQueries({
            queryKey: notificationKey(workspaceId),
          }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, workspaceId]);

  async function markAsRead(notification: Notification) {
    if (notification.read_at) return;
    const { error } = await createClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notification.id)
      .eq('workspace_id', workspaceId);
    if (error) toast.error('Não foi possível marcar a notificação como lida.');
    await queryClient.invalidateQueries({ queryKey });
  }

  async function openNotification(notification: Notification) {
    await markAsRead(notification);
    if (notification.entity_type === 'task')
      router.push(`/tarefa/${notification.entity_id}`, { scroll: false });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? 'Há notificações não lidas' : 'Notificações'}
        >
          <Bell aria-hidden="true" />
          {unread ? (
            <span
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-pta-lime ring-1 ring-foreground/20"
              aria-hidden="true"
            />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(360px,calc(100vw-24px))] p-0"
      >
        <DropdownMenuLabel className="px-3 py-3">
          Notificações
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        {query.isPending ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            Carregando…
          </p>
        ) : null}
        {query.isError ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-destructive">
              Não foi possível carregar.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => void query.refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : null}
        {query.isSuccess && notifications.length === 0 ? (
          <div className="px-4 py-9 text-center">
            <CheckCircle2
              aria-hidden="true"
              className="mx-auto size-5 text-muted-foreground"
            />
            <p className="mt-2 text-sm">Tudo em dia.</p>
          </div>
        ) : null}
        {notifications.map((notification) => (
          <button
            type="button"
            key={notification.id}
            onClick={() => void openNotification(notification)}
            className={cn(
              'block w-full border-b px-3 py-3 text-left text-sm transition-colors last:border-0 hover:bg-muted',
              !notification.read_at && 'bg-accent/35',
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              {!notification.read_at ? (
                <span
                  className="size-1.5 rounded-full bg-pta-lime ring-1 ring-foreground/20"
                  aria-label="Não lida"
                />
              ) : null}
              {notification.title}
            </span>
            {notification.body ? (
              <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                {notification.body}
              </span>
            ) : null}
            <time
              dateTime={notification.created_at}
              className="mt-1 block text-[11px] text-muted-foreground"
            >
              {new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(notification.created_at))}
            </time>
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
