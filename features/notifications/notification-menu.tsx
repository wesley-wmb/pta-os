'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  const [open, setOpen] = useState(false);
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
      .channel(`notifications:${workspaceId}:${crypto.randomUUID()}`)
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
    setOpen(false);
  }

  async function markAllAsRead() {
    const { error } = await createClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .is('read_at', null);
    if (error) {
      toast.error('Não foi possível marcar todas como lidas.');
      return;
    }
    await queryClient.invalidateQueries({ queryKey });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_14%,transparent)] ring-1 ring-background"
              aria-hidden="true"
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(360px,calc(100vw-24px))] gap-0 overflow-hidden rounded-lg border p-0 shadow-[0_18px_50px_rgb(15_18_12/16%)]"
      >
        <div className="flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2.5">
          <span className="text-sm font-semibold">Notificações</span>
          {unread ? (
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              className="min-h-8 rounded-lg px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-pta-blue/[0.07] hover:text-pta-blue"
            >
              Marcar todas como lidas
            </button>
          ) : null}
        </div>
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
            <p className="mt-2 text-sm">Nenhuma notificação.</p>
          </div>
        ) : null}
        {notifications.map((notification) => (
          <button
            type="button"
            key={notification.id}
            onClick={() => void openNotification(notification)}
            className={cn(
              'block w-full border-b px-4 py-3 text-left text-sm transition-[background-color,box-shadow] last:border-0 hover:bg-accent/60 hover:shadow-[inset_2px_0_0_color-mix(in_srgb,var(--primary)_68%,transparent)] focus-visible:bg-accent/60',
              !notification.read_at && 'bg-primary/[0.065]',
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              {!notification.read_at ? (
                <span
                  className="size-1.5 rounded-full bg-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
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
              className="mt-1 block text-xs text-muted-foreground"
            >
              {new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(notification.created_at))}
            </time>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
