'use client';

import {
  CalendarDays,
  House,
  ListTodo,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { NewTaskDialog } from '@/features/tasks/new-task-dialog';
import { NotificationMenu } from '@/features/notifications/notification-menu';
import type { WorkspaceContext } from '@/features/workspace/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const navigation = [
  { href: '/inicio', label: 'Início', icon: House },
  { href: '/semana', label: 'Minha semana', icon: CalendarDays },
  { href: '/demandas', label: 'Demandas', icon: ListTodo },
];

export function AppShell({
  context,
  children,
  peek,
}: {
  context: WorkspaceContext & {
    workspace: NonNullable<WorkspaceContext['workspace']>;
  };
  children: React.ReactNode;
  peek: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const title = pathname.startsWith('/semana')
    ? 'Minha semana'
    : pathname.startsWith('/demandas') || pathname.startsWith('/tarefa')
      ? 'Demandas'
      : 'Início';

  return (
    <div
      className="min-h-dvh bg-background lg:grid"
      style={{
        gridTemplateColumns: sidebarOpen
          ? '240px minmax(0, 1fr)'
          : '0 minmax(0, 1fr)',
      }}
    >
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh overflow-hidden border-r bg-sidebar transition-[width] duration-150 lg:flex lg:flex-col',
          sidebarOpen ? 'w-60' : 'w-0',
        )}
        aria-label="Navegação principal"
      >
        <SidebarContent
          context={context}
          pathname={pathname}
          onNavigate={() => undefined}
          onSignOut={signOut}
        />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={() => setSidebarOpen((value) => !value)}
            aria-label={sidebarOpen ? 'Recolher navegação' : 'Abrir navegação'}
          >
            {sidebarOpen ? (
              <PanelLeftClose aria-hidden="true" />
            ) : (
              <PanelLeftOpen aria-hidden="true" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir navegação"
          >
            <Menu aria-hidden="true" />
          </Button>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
          <NotificationMenu workspaceId={context.workspace.id} />
          {context.workspace.role !== 'viewer' ? (
            <>
              <div className="hidden sm:block">
                <NewTaskDialog
                  workspaceId={context.workspace.id}
                  taskPrefix={context.workspace.taskPrefix}
                  members={context.members}
                  role={context.workspace.role}
                  currentUserId={context.user.id}
                />
              </div>
              <div className="sm:hidden">
                <NewTaskDialog
                  workspaceId={context.workspace.id}
                  taskPrefix={context.workspace.taskPrefix}
                  members={context.members}
                  role={context.workspace.role}
                  currentUserId={context.user.id}
                  compact
                />
              </div>
            </>
          ) : null}
        </header>
        <main id="conteudo-principal" className="min-w-0">
          {children}
        </main>
      </div>

      {peek}

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[min(86vw,320px)] p-0"
          aria-describedby="mobile-navigation-description"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação</SheetTitle>
            <SheetDescription id="mobile-navigation-description">
              Acesse as áreas do PTA OS.
            </SheetDescription>
          </SheetHeader>
          <SidebarContent
            context={context}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
            onSignOut={signOut}
            mobile
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SidebarContent({
  context,
  pathname,
  onNavigate,
  onSignOut,
  mobile = false,
}: {
  context: WorkspaceContext & {
    workspace: NonNullable<WorkspaceContext['workspace']>;
  };
  pathname: string;
  onNavigate: () => void;
  onSignOut: () => void;
  mobile?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div
        className={cn(
          'flex items-center gap-2 px-2 font-semibold tracking-tight',
          mobile ? 'h-12' : 'h-10',
        )}
      >
        <span className="grid size-7 place-items-center rounded-md bg-foreground text-[10px] text-background">
          PTA
        </span>
        <span className="truncate text-sm">{context.workspace.name}</span>
        <span
          className="ml-auto size-2 rounded-full bg-pta-lime"
          aria-hidden="true"
        />
      </div>
      <nav className="mt-5 space-y-1" aria-label="Áreas do produto">
        {navigation.map((item) => {
          const active =
            item.href === '/demandas'
              ? pathname.startsWith('/demandas') ||
                pathname.startsWith('/tarefa')
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-sidebar-accent',
                mobile ? 'h-11' : 'h-8',
                active && 'bg-sidebar-accent font-medium',
              )}
            >
              {active ? (
                <span
                  className="absolute left-0 h-4 w-0.5 rounded-full bg-pta-lime"
                  aria-hidden="true"
                />
              ) : null}
              <Icon aria-hidden="true" className="size-4" strokeWidth={1.7} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2 text-left hover:bg-sidebar-accent',
                mobile ? 'h-14' : 'h-11',
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-semibold uppercase text-background">
                {initials(context.user.fullName)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {context.user.fullName}
                </span>
                <span className="block truncate text-xs capitalize text-muted-foreground">
                  {roleLabel(context.workspace.role)}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-52">
            <DropdownMenuItem onSelect={onSignOut}>
              <LogOut aria-hidden="true" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

function roleLabel(
  role: WorkspaceContext['workspace'] extends infer T
    ? T extends { role: infer R }
      ? R
      : never
    : never,
) {
  const labels = {
    owner: 'Proprietário',
    admin: 'Administrador',
    manager: 'Gestor',
    member: 'Membro',
    viewer: 'Visualizador',
  };
  return labels[role as keyof typeof labels];
}
