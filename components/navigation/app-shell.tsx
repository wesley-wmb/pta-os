'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarRange,
  CircleUserRound,
  ChevronRight,
  House,
  ListTodo,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search as SearchIcon,
  Settings,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { PtaMark } from '@/components/brand/pta-mark';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { GlobalSearch } from '@/features/search/global-search';
import { calendarWeekKeys } from '@/features/tasks/date-utils';
import { isClosed } from '@/features/tasks/formatters';
import { NewTaskDialog } from '@/features/tasks/new-task-dialog';
import { useTasks } from '@/features/tasks/queries';
import { NotificationMenu } from '@/features/notifications/notification-menu';
import type {
  WorkspaceContext,
  WorkspaceRole,
} from '@/features/workspace/types';
import { WorkspaceSwitcher } from '@/features/workspace/workspace-switcher';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: readonly WorkspaceRole[];
};

const navigationSections: Array<{
  label: string;
  items: NavigationItem[];
}> = [
  {
    label: 'Visão geral',
    items: [
      { href: '/inicio', label: 'Início', icon: House },
      { href: '/demandas', label: 'Tarefas', icon: ListTodo },
    ],
  },
  {
    label: 'Operação',
    items: [{ href: '/projetos', label: 'Projetos', icon: CalendarRange }],
  },
  {
    label: 'Gestão',
    items: [
      {
        href: '/equipe',
        label: 'Equipe',
        icon: UsersRound,
        roles: ['owner', 'admin', 'manager', 'member'],
      },
      { href: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

const topbarIconInteraction =
  'text-muted-foreground hover:bg-primary/10 hover:text-primary aria-expanded:bg-primary/10 aria-expanded:text-primary focus-visible:border-primary/45 focus-visible:ring-primary/25 dark:hover:bg-primary/15 dark:hover:text-primary dark:aria-expanded:bg-primary/15 dark:aria-expanded:text-primary';

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
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const searchReturnFocusRef = useRef<HTMLElement | null>(null);
  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileSearchTriggerRef = useRef<HTMLButtonElement>(null);
  const isWideDesktop = useSyncExternalStore(
    subscribeToWideDesktop,
    getWideDesktopSnapshot,
    () => false,
  );
  const sidebarExpanded = sidebarOpen && isWideDesktop;
  const isTasksArea =
    pathname === '/demandas' || pathname.startsWith('/tarefa/');

  const openGlobalSearch = useCallback((returnTarget?: HTMLElement | null) => {
    searchReturnFocusRef.current =
      returnTarget ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setGlobalSearchOpen(true);
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() !== 'k' ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      openGlobalSearch();
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [openGlobalSearch]);

  async function signOut() {
    await createClient().auth.signOut();
    queryClient.clear();
    router.replace('/login');
    router.refresh();
  }

  const title = routeTitle(pathname);

  return (
    <div
      className="pta-shell h-dvh overflow-hidden transition-[grid-template-columns] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] lg:grid"
      style={{
        gridTemplateColumns: sidebarOpen
          ? `${sidebarExpanded ? '264px' : '80px'} minmax(0, 1fr)`
          : '80px minmax(0, 1fr)',
      }}
    >
      <aside
        className={cn(
          'pta-sidebar sticky top-0 hidden overflow-hidden text-sidebar-foreground transition-[width] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] lg:flex lg:flex-col',
          sidebarExpanded ? 'w-[248px]' : 'w-16',
        )}
        aria-label="Navegação principal"
      >
        <SidebarContent
          context={context}
          pathname={pathname}
          onNavigate={() => undefined}
          onSignOut={signOut}
          onSearch={() => openGlobalSearch()}
          collapsed={!sidebarExpanded}
        />
      </aside>

      <div className="pta-workspace flex h-dvh min-w-0 flex-col">
        <header
          className={cn(
            'pta-toolbar z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 sm:px-6',
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('hidden lg:inline-flex', topbarIconInteraction)}
            onClick={() => setSidebarOpen((value) => !value)}
            aria-label={
              sidebarExpanded ? 'Recolher navegação' : 'Abrir navegação'
            }
          >
            {sidebarExpanded ? (
              <PanelLeftClose aria-hidden="true" />
            ) : (
              <PanelLeftOpen aria-hidden="true" />
            )}
          </Button>
          <Button
            ref={mobileNavTriggerRef}
            type="button"
            variant="ghost"
            size="icon"
            className={cn('lg:hidden', topbarIconInteraction)}
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir navegação"
          >
            <Menu aria-hidden="true" />
          </Button>
          <div className="hidden min-w-0 flex-1 items-center gap-2 text-sm sm:flex">
            <span className="truncate text-muted-foreground">
              {context.workspace.name}
            </span>
            <ChevronRight
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            <span className="truncate font-semibold">{title}</span>
          </div>
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold sm:hidden">
            {title}
          </p>
          <Button
            ref={mobileSearchTriggerRef}
            type="button"
            variant="ghost"
            size="icon"
            className={cn('lg:hidden', topbarIconInteraction)}
            onClick={() => openGlobalSearch()}
            aria-label="Abrir busca global"
          >
            <SearchIcon aria-hidden="true" />
          </Button>
          {isTasksArea ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openGlobalSearch()}
              className={cn('hidden lg:inline-flex', topbarIconInteraction)}
              aria-label="Buscar em todo o workspace, Ctrl K"
              title="Busca global · Ctrl K"
            >
              <SearchIcon aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => openGlobalSearch()}
              className="hidden w-[min(25vw,300px)] justify-start border-border bg-card text-muted-foreground shadow-none hover:border-primary/35 hover:bg-primary/10 hover:text-primary lg:inline-flex"
              aria-label="Buscar em tudo"
            >
              <SearchIcon aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-left">
                Buscar em tudo...
              </span>
              <kbd className="rounded-md border bg-card px-1.5 py-0.5 font-sans text-[11px] leading-none text-muted-foreground">
                Ctrl K
              </kbd>
            </Button>
          )}
          <ThemeToggle />
          <NotificationMenu workspaceId={context.workspace.id} />
          {context.workspace.role !== 'viewer' && !isTasksArea ? (
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
        <main
          id="conteudo-principal"
          className={cn(
            'pta-canvas pta-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto pb-24 lg:pb-0',
            isTasksArea && 'flex flex-col',
          )}
        >
          <div
            className="pta-page-transition"
            data-workspace-view={isTasksArea ? 'tasks' : undefined}
          >
            {children}
          </div>
        </main>
      </div>

      <nav className="pta-mobile-dock lg:hidden" aria-label="Acesso rápido">
        {[...navigationSections[0].items, ...navigationSections[1].items].map(
          (item) => {
            const Icon = item.icon;
            const active = isRouteActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          },
        )}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium text-muted-foreground"
          aria-label="Todas as áreas"
        >
          <Menu className="size-5" aria-hidden="true" />
          Mais
        </button>
      </nav>
      {peek}

      <GlobalSearch
        workspaceId={context.workspace.id}
        open={globalSearchOpen}
        onOpenChange={setGlobalSearchOpen}
        returnFocusRef={searchReturnFocusRef}
      />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[min(86vw,320px)] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
          aria-describedby="mobile-navigation-description"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            mobileNavTriggerRef.current?.focus();
          }}
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
            onSearch={() => {
              setMobileOpen(false);
              openGlobalSearch(mobileSearchTriggerRef.current);
            }}
            mobile
            collapsed={false}
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
  onSearch,
  mobile = false,
  collapsed = false,
}: {
  context: WorkspaceContext & {
    workspace: NonNullable<WorkspaceContext['workspace']>;
  };
  pathname: string;
  onNavigate: () => void;
  onSignOut: () => void;
  onSearch: () => void;
  mobile?: boolean;
  collapsed?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        title={collapsed ? context.workspace.name : undefined}
        className={cn(
          'flex shrink-0 items-center gap-2 px-4 font-semibold tracking-tight',
          'h-16',
          collapsed && 'justify-center px-2',
        )}
      >
        <span className="pta-brand-reveal grid size-10 shrink-0 place-items-center rounded-xl bg-foreground text-background">
          <PtaMark className="h-6 w-auto" />
        </span>
        {collapsed ? null : (
          <span className="pta-sidebar-label min-w-0">
            <span className="block truncate text-[15px] font-bold tracking-[0.04em]">
              PTA OS
            </span>
            <span className="mt-0.5 block truncate text-xs font-medium text-sidebar-muted">
              Seu espaço de trabalho
            </span>
          </span>
        )}
      </div>
      <WorkspaceSwitcher
        currentWorkspaceId={context.workspace.id}
        workspaces={context.availableWorkspaces}
        collapsed={collapsed}
        mobile={mobile}
        onNavigate={onNavigate}
      />
      <div className={cn('px-3 md:hidden', collapsed && 'px-2')}>
        <button
          type="button"
          onClick={onSearch}
          title={collapsed ? 'Busca global' : undefined}
          aria-label={collapsed ? 'Abrir busca global' : undefined}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border/80 bg-sidebar-accent/55 px-3 text-sm font-medium text-sidebar-muted shadow-[0_1px_0_rgb(10_12_9/3%)] outline-none transition-[background-color,border-color,color,box-shadow] hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar',
            mobile ? 'h-12 text-base' : 'h-11',
            collapsed && 'justify-center px-0',
          )}
        >
          <SearchIcon
            aria-hidden="true"
            className="size-[17px] shrink-0"
            strokeWidth={1.75}
          />
          {collapsed ? (
            <span className="sr-only">Busca global</span>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate text-left">
                Busca global
              </span>
              {mobile ? null : (
                <kbd
                  aria-hidden="true"
                  className="rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 font-sans text-xs leading-none text-sidebar-muted"
                >
                  Ctrl K
                </kbd>
              )}
            </>
          )}
        </button>
      </div>
      <nav
        className={cn(
          'pta-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto px-2.5 pb-4',
          collapsed && 'px-2',
        )}
        aria-label="Áreas do produto"
      >
        {navigationSections.map((section, sectionIndex) => (
          <div
            key={section.label}
            className={cn(sectionIndex > 0 && (collapsed ? 'mt-3' : 'mt-6'))}
          >
            {collapsed ? (
              sectionIndex > 0 ? (
                <div className="mx-auto mb-3 h-px w-7 bg-sidebar-border" />
              ) : null
            ) : (
              <p className="mb-2 px-3 text-xs font-medium text-sidebar-muted">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.items
                .filter(
                  (item) =>
                    !item.roles || item.roles.includes(context.workspace.role),
                )
                .map((item) => {
                  const active = isRouteActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-muted outline-none transition-[background-color,color,box-shadow] duration-150 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar',
                        mobile ? 'h-12 text-base' : 'h-11',
                        collapsed && 'justify-center px-0',
                        active &&
                          'bg-card font-semibold text-foreground shadow-[0_1px_4px_rgb(0_0_0/6%)] hover:bg-card hover:text-foreground',
                      )}
                    >
                      {active ? (
                        <span
                          className="pta-nav-active-indicator absolute left-0 h-4 w-0.5 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span
                        className={cn(
                          'pta-nav-symbol grid size-8 shrink-0 place-items-center rounded-md',
                          navigationTone(),
                        )}
                      >
                        <Icon
                          aria-hidden="true"
                          className="size-[18px]"
                          strokeWidth={1.8}
                        />
                      </span>
                      {collapsed ? (
                        <span className="sr-only">{item.label}</span>
                      ) : (
                        item.label
                      )}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>
      {collapsed ? null : (
        <WeeklySidebarProgress
          workspaceId={context.workspace.id}
          currentUserId={context.user.id}
          timezone={context.workspace.timezone}
        />
      )}
      <div className="mt-auto border-t border-sidebar-border/70 p-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={
                collapsed
                  ? `${context.user.fullName}, abrir menu da conta`
                  : undefined
              }
              className={cn(
                'group/account flex w-full items-center gap-2.5 rounded-xl px-2 text-left outline-none transition-[background-color,color,box-shadow] hover:bg-primary/10 hover:text-primary aria-expanded:bg-primary/10 aria-expanded:text-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar',
                mobile ? 'h-14' : 'h-11',
                collapsed && 'justify-center px-0',
              )}
            >
              <Avatar className="size-9 shrink-0 bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border transition-[box-shadow] group-hover/account:ring-primary/25 group-focus-visible/account:ring-primary/25 group-aria-expanded/account:ring-primary/25">
                {context.user.avatarUrl ? (
                  <AvatarImage src={context.user.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback className="bg-sidebar-accent text-xs font-bold uppercase text-sidebar-accent-foreground group-hover/account:bg-primary/15 group-hover/account:text-primary group-focus-visible/account:bg-primary/15 group-focus-visible/account:text-primary group-aria-expanded/account:bg-primary/15 group-aria-expanded/account:text-primary">
                  {initials(context.user.fullName)}
                </AvatarFallback>
              </Avatar>
              {collapsed ? null : (
                <span className="pta-sidebar-label min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {context.user.fullName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-sidebar-muted">
                    {roleLabel(context.workspace.role)}
                  </span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-52">
            <DropdownMenuItem asChild>
              <Link href="/perfil" onClick={onNavigate}>
                <CircleUserRound aria-hidden="true" />
                Meu perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/configuracoes" onClick={onNavigate}>
                <Settings aria-hidden="true" />
                Configurações
              </Link>
            </DropdownMenuItem>
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

function WeeklySidebarProgress({
  workspaceId,
  currentUserId,
  timezone,
}: {
  workspaceId: string;
  currentUserId: string;
  timezone: string;
}) {
  const query = useTasks(workspaceId);
  const summary = useMemo(() => {
    const weekKeys = calendarWeekKeys(timezone);
    const tasks = (query.data ?? []).filter(
      (task) =>
        task.primary_assignee_id === currentUserId &&
        Boolean(task.due_date && weekKeys.includes(task.due_date)) &&
        task.status_category !== 'cancelled',
    );
    const completed = tasks.filter((task) =>
      isClosed(task.status_category),
    ).length;
    return {
      completed,
      total: tasks.length,
      percentage: tasks.length
        ? Math.round((completed / tasks.length) * 100)
        : 0,
    };
  }, [currentUserId, query.data, timezone]);

  return (
    <section
      className="mx-4 mb-3 border-t border-sidebar-border/80 px-1 py-4"
      aria-label="Progresso da semana"
    >
      <div className="flex items-center justify-between gap-3 text-xs text-sidebar-muted">
        <span>Semana atual</span>
        <strong className="text-sidebar-foreground">
          {query.isPending ? '...' : `${summary.percentage}%`}
        </strong>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-sidebar-border"
        role="progressbar"
        aria-label="Tarefas concluídas nesta semana"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={summary.percentage}
      >
        <span
          className="block h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${summary.percentage}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-sidebar-muted">
        {query.isPending
          ? 'Calculando progresso'
          : `${summary.completed} de ${summary.total} tarefas concluídas`}
      </p>
    </section>
  );
}

function isRouteActive(pathname: string, href: string) {
  if (href === '/demandas')
    return (
      pathname === '/demandas' ||
      pathname.startsWith('/demandas/') ||
      pathname === '/tarefa' ||
      pathname.startsWith('/tarefa/')
    );
  return pathname === href || pathname.startsWith(`${href}/`);
}

function routeTitle(pathname: string) {
  if (pathname.startsWith('/tarefa')) return 'Tarefas';
  if (pathname.startsWith('/busca')) return 'Busca global';
  if (pathname.startsWith('/perfil')) return 'Perfil';
  for (const section of navigationSections) {
    const item = section.items.find(
      (candidate) =>
        pathname === candidate.href ||
        pathname.startsWith(`${candidate.href}/`),
    );
    if (item) return item.label;
  }
  return 'Início';
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

function subscribeToWideDesktop(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia('(min-width: 1024px)');
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

function getWideDesktopSnapshot() {
  return window.matchMedia('(min-width: 1024px)').matches;
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

function navigationTone() {
  return 'bg-primary/10 text-primary';
}
