'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { selectActiveWorkspace } from './actions';
import type { AvailableWorkspace, WorkspaceRole } from './types';

export function WorkspaceSwitcher({
  currentWorkspaceId,
  workspaces,
  collapsed,
  mobile,
  onNavigate,
}: {
  currentWorkspaceId: string;
  workspaces: AvailableWorkspace[];
  collapsed: boolean;
  mobile: boolean;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const current =
    workspaces.find((workspace) => workspace.id === currentWorkspaceId) ??
    workspaces[0];

  if (!current) return null;

  const content = (
    <WorkspaceIdentity
      name={current.name}
      collapsed={collapsed}
      busy={pending}
      switchable={workspaces.length > 1}
    />
  );

  if (workspaces.length < 2) {
    return (
      <div
        title={collapsed ? current.name : undefined}
        className={workspaceTriggerClass(collapsed, mobile)}
      >
        {content}
      </div>
    );
  }

  function selectWorkspace(workspaceId: string) {
    if (workspaceId === currentWorkspaceId || pending) return;

    startTransition(async () => {
      const result = await selectActiveWorkspace(workspaceId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      queryClient.clear();
      onNavigate();
      router.replace('/inicio');
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          aria-label={
            collapsed ? `${current.name}, trocar workspace` : 'Trocar workspace'
          }
          className={workspaceTriggerClass(collapsed, mobile)}
        >
          {content}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={collapsed && !mobile ? 'right' : 'bottom'}
        className="w-72"
      >
        <DropdownMenuLabel>Workspaces disponíveis</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            disabled={pending}
            onSelect={() => selectWorkspace(workspace.id)}
            className="min-h-11 gap-3 px-2.5 py-2"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-xs font-bold text-accent-foreground">
              {initials(workspace.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">
                {workspace.name}
              </span>
              <span className="block text-[13px] text-muted-foreground">
                {roleLabel(workspace.role)}
              </span>
            </span>
            {workspace.id === currentWorkspaceId ? (
              <Check aria-hidden="true" className="size-4 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceIdentity({
  name,
  collapsed,
  busy,
  switchable,
}: {
  name: string;
  collapsed: boolean;
  busy: boolean;
  switchable: boolean;
}) {
  return (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20 transition-[background-color,box-shadow] group-hover:bg-primary/15 group-hover:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_8%,transparent)]">
        {busy ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          initials(name)
        )}
      </span>
      {collapsed ? null : (
        <>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="mt-0.5 block text-xs text-sidebar-muted">
              Workspace
            </span>
          </span>
          {switchable ? (
            <ChevronsUpDown
              aria-hidden="true"
              className="size-4 shrink-0 text-sidebar-muted"
            />
          ) : null}
        </>
      )}
    </>
  );
}

function workspaceTriggerClass(collapsed: boolean, mobile: boolean) {
  return cn(
    'group mx-3 mt-3 flex min-h-12 w-[calc(100%-1.5rem)] items-center gap-2 rounded-xl p-2.5 text-left outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
    mobile && 'min-h-14',
    collapsed && 'mx-2 w-[calc(100%-1rem)] justify-center px-1.5',
    !collapsed && 'hover:bg-sidebar-accent',
  );
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function roleLabel(role: WorkspaceRole) {
  return {
    owner: 'Proprietário',
    admin: 'Administrador',
    manager: 'Gestor',
    member: 'Membro',
    viewer: 'Visualizador',
  }[role];
}
