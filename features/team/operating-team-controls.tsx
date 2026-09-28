'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import type { WorkspaceMember } from '@/features/workspace/types';

const selectClass =
  'h-10 min-w-0 rounded-lg border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary';
function message(error: unknown) {
  const code =
    typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : '';
  if (code.includes('CONFLICT'))
    return 'Os dados mudaram em outra sessão. Atualizamos a página; tente novamente.';
  if (code.includes('ACTIVE_PROJECTS'))
    return 'Mova os projetos ativos para outra equipe antes de arquivar.';
  if (code.includes('ACTIVE_TASKS'))
    return 'Existem tarefas vinculadas. Reorganize essas tarefas antes de continuar.';
  if (code.includes('DEFAULT_TEAM'))
    return 'A equipe padrão não pode ser arquivada.';
  if (code.includes('REQUIRES_ACTIVE_TEAM'))
    return 'Cada pessoa precisa continuar em pelo menos uma equipe ativa.';
  if (code.includes('FORBIDDEN'))
    return 'Seu acesso não permite esta alteração.';
  if (code.includes('NOT_ACTIVE'))
    return 'Selecione uma pessoa ativa com acesso operacional ao workspace.';
  return 'Não foi possível salvar. Tente novamente.';
}

type OperatingTeam = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  version: number;
};
export function TeamEditorButton({
  workspaceId,
  team,
  compact = false,
}: {
  workspaceId: string;
  team?: OperatingTeam;
  compact?: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(team?.name ?? '');
  const [description, setDescription] = useState(team?.description ?? '');
  const [color, setColor] = useState(team?.color ?? 'blue');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  async function save(archive = false) {
    setBusy(true);
    setError('');
    try {
      const client = createClient();
      const result =
        archive && team
          ? await client.rpc('archive_team_workspace', {
              p_team_id: team.id,
              p_expected_version: team.version,
            })
          : team
            ? await client.rpc('update_operating_team', {
                p_team_id: team.id,
                p_expected_version: team.version,
                p_patch: {
                  name: name.trim(),
                  description: description.trim() || null,
                  color,
                },
              })
            : await client.rpc('create_operating_team_workspace', {
                p_workspace_id: workspaceId,
                p_name: name.trim(),
                p_description: description.trim(),
                p_color: color,
                p_slug: `${
                  name
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                    .slice(0, 65) || 'equipe'
                }-${crypto.randomUUID().slice(0, 8)}`,
              });
      if (result.error) throw result.error;
      toast.success(
        archive
          ? 'Equipe arquivada.'
          : team
            ? 'Equipe atualizada.'
            : 'Equipe criada.',
      );
      setOpen(false);
      if (archive) router.push('/equipes');
      else if (
        !team &&
        result.data &&
        typeof result.data === 'object' &&
        !Array.isArray(result.data)
      ) {
        const created = result.data.team;
        if (
          created &&
          typeof created === 'object' &&
          !Array.isArray(created) &&
          typeof created.id === 'string'
        )
          router.push(`/equipes/${created.id}`);
      }
      router.refresh();
    } catch (cause) {
      setError(message(cause));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant={team ? 'outline' : 'default'}
        size={compact ? 'sm' : 'default'}
        onClick={() => {
          setName(team?.name ?? '');
          setDescription(team?.description ?? '');
          setColor(team?.color ?? 'blue');
          setError('');
          setConfirmArchive(false);
          setOpen(true);
        }}
      >
        {team ? <Pencil aria-hidden /> : <Plus aria-hidden />}
        {team ? 'Editar equipe' : 'Nova equipe'}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{team ? 'Editar equipe' : 'Nova equipe'}</DialogTitle>
            <DialogDescription>
              Organize os projetos e as pessoas de uma área de trabalho.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid min-w-0 gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor={`${id}-name`}>Nome da equipe</Label>
              <Input
                id={`${id}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={100}
                disabled={busy}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-description`}>Descrição</Label>
              <Textarea
                id={`${id}-description`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                disabled={busy}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-color`}>Cor</Label>
              <select
                id={`${id}-color`}
                className={selectClass}
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={busy}
              >
                {[
                  ['blue', 'Azul'],
                  ['green', 'Verde'],
                  ['purple', 'Roxo'],
                  ['orange', 'Laranja'],
                  ['pink', 'Rosa'],
                  ['red', 'Vermelho'],
                  ['gray', 'Cinza'],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {confirmArchive && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-sm text-muted-foreground">
                  Arquivar esta equipe? O histórico será preservado. Projetos e
                  tarefas ativos precisam ser reorganizados antes.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void save(true)}
                >
                  Confirmar arquivamento
                </Button>
              </div>
            )}
            <DialogFooter className="flex-wrap gap-2">
              {team && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirmArchive(!confirmArchive)}
                >
                  Arquivar equipe
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={busy || name.trim().length < 2}>
                {busy
                  ? 'Salvando…'
                  : team
                    ? 'Salvar alterações'
                    : 'Criar equipe'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

type TeamMember = {
  user_id: string;
  full_name: string;
  team_role: 'lead' | 'member';
  version: number;
  is_primary_team: boolean;
};
export function TeamMembersPanel({
  workspaceId,
  teamId,
  members,
  currentMembers,
  canManage,
}: {
  workspaceId: string;
  teamId: string;
  members: WorkspaceMember[];
  currentMembers: TeamMember[];
  canManage: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [person, setPerson] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  async function mutate(
    userId: string,
    existing?: TeamMember,
    role: 'lead' | 'member' = 'member',
    remove = false,
  ) {
    setBusy(true);
    setError('');
    try {
      const client = createClient();
      let version = existing?.version;
      if (!existing) {
        const previous = await client
          .from('team_members')
          .select('version')
          .eq('workspace_id', workspaceId)
          .eq('team_id', teamId)
          .eq('user_id', userId)
          .maybeSingle();
        if (previous.error) throw previous.error;
        version = previous.data?.version;
      }
      const result =
        remove && existing
          ? await client.rpc('remove_team_member', {
              p_team_id: teamId,
              p_user_id: userId,
              p_expected_version: existing.version,
            })
          : await client.rpc('upsert_team_member', {
              p_team_id: teamId,
              p_user_id: userId,
              p_role: role,
              p_is_primary: existing?.is_primary_team ?? false,
              ...(version ? { p_expected_version: version } : {}),
            });
      if (result.error) throw result.error;
      setPerson('');
      setRemoving(null);
      toast.success(
        remove ? 'Pessoa removida da equipe.' : 'Participação atualizada.',
      );
      router.refresh();
    } catch (cause) {
      setError(message(cause));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Pessoas da equipe" className="space-y-4">
      <h2 className="text-lg font-semibold">
        Pessoas da equipe{' '}
        <span className="text-sm font-normal text-muted-foreground">
          {currentMembers.length}
        </span>
      </h2>
      {canManage && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (person) void mutate(person);
          }}
        >
          <div className="grid min-w-48 flex-1 gap-2">
            <Label htmlFor={id}>Adicionar pessoa do workspace</Label>
            <select
              id={id}
              className={selectClass}
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              disabled={busy}
            >
              <option value="">Selecione uma pessoa</option>
              {members
                .filter((m) => !currentMembers.some((c) => c.user_id === m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
            </select>
          </div>
          <Button disabled={busy || !person}>Adicionar</Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="divide-y border-y">
        {currentMembers.length === 0 && (
          <p className="py-5 text-sm text-muted-foreground">
            Nenhuma pessoa nesta equipe.
          </p>
        )}
        {currentMembers.map((m) => (
          <div
            key={m.user_id}
            className="flex flex-wrap items-center gap-3 py-3"
          >
            <span className="min-w-0 flex-1 text-sm font-medium">
              {m.full_name}
              {m.is_primary_team && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Equipe principal
                </span>
              )}
            </span>
            {canManage ? (
              <>
                <select
                  aria-label={`Papel de ${m.full_name}`}
                  className={selectClass}
                  value={m.team_role}
                  disabled={busy}
                  onChange={(e) =>
                    void mutate(
                      m.user_id,
                      m,
                      e.target.value as 'lead' | 'member',
                    )
                  }
                >
                  <option value="member">Integrante</option>
                  <option value="lead">Líder</option>
                </select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${m.full_name} da equipe`}
                  disabled={busy}
                  onClick={() => setRemoving(m)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                {m.team_role === 'lead' ? 'Líder' : 'Integrante'}
              </span>
            )}
          </div>
        ))}
      </div>
      <Dialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open && !busy) setRemoving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover da equipe?</DialogTitle>
            <DialogDescription>
              {removing?.full_name} continuará no workspace. Seu acesso aos
              projetos seguirá as permissões atuais.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (removing)
                  void mutate(
                    removing.user_id,
                    removing,
                    removing.team_role,
                    true,
                  );
              }}
            >
              {busy ? 'Removendo…' : 'Remover da equipe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
