'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type TaskBoardConfiguration,
  useManageTaskBoardColumn,
  useConnectWeekBoardColumn,
  useDeleteWeekBoardColumn,
} from './board-configuration';
import type { TaskWeekLane } from './types';

function mutationMessage(error: unknown) {
  const message = String((error as { message?: string })?.message ?? error);
  if (message.includes('VERSION_CONFLICT'))
    return 'O quadro mudou em outra sessão. Feche esta janela e tente novamente.';
  if (message.includes('23505') || message.includes('duplicate key'))
    return 'Já existe uma coluna com esse nome. Escolha outro nome.';
  if (message.includes('ALREADY_CONNECTED'))
    return 'Essa coluna já tem outra conexão. Remova a conexão anterior primeiro.';
  return 'Não foi possível salvar. Atualize o quadro e tente novamente.';
}

export function WeekColumnDeleteDialog({
  configuration,
  lane,
  onClose,
}: {
  configuration: TaskBoardConfiguration;
  lane: TaskWeekLane;
  onClose: () => void;
}) {
  const mutation = useDeleteWeekBoardColumn(configuration.workspace_id);
  const [destination, setDestination] = useState<TaskWeekLane | ''>('');
  const [error, setError] = useState('');
  const column = configuration.week_board.columns.find(
    (item) => item.key === lane,
  );
  const destinations = configuration.week_board.columns.filter(
    (item) =>
      item.is_active &&
      item.key !== lane &&
      item.key !== 'scheduled' &&
      !configuration.links.some(
        (link) =>
          link.week_lane_key === item.key &&
          configuration.status_board.columns.some(
            (status) =>
              status.id === link.status_id && status.category === 'blocked',
          ),
      ),
  );
  async function remove() {
    if (!destination) return;
    setError('');
    try {
      await mutation.mutateAsync({
        lane,
        destination,
        version: configuration.week_board.version,
      });
      onClose();
    } catch (failure) {
      setError(mutationMessage(failure));
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir coluna {column?.name}</DialogTitle>
          <DialogDescription>
            Todos os cards desta coluna, inclusive de outras semanas e pessoas,
            serão movidos para o destino escolhido. Projetos e prazos serão
            preservados. A conexão da coluna excluída será removida; as regras
            do destino serão aplicadas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Label htmlFor="week-delete-destination">Mover os cards para</Label>
          <Select
            value={destination}
            onValueChange={(value) => setDestination(value as TaskWeekLane)}
            disabled={mutation.isPending}
          >
            <SelectTrigger id="week-delete-destination">
              <SelectValue placeholder="Escolha uma coluna" />
            </SelectTrigger>
            <SelectContent>
              {destinations.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Novas tarefas que usariam a coluna removida também irão para esse
            destino.
          </p>
          {!destinations.length && (
            <p role="status">
              É necessário manter pelo menos uma coluna de planejamento com
              destino disponível.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!destination || mutation.isPending}
            onClick={() => void remove()}
          >
            {mutation.isPending ? 'Excluindo…' : 'Mover cards e excluir coluna'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ColumnLifecycleDialog({
  configuration,
  columnId,
  onClose,
}: {
  configuration: TaskBoardConfiguration;
  columnId: string | null;
  onClose: () => void;
}) {
  const mutation = useManageTaskBoardColumn(configuration.workspace_id);
  const [name, setName] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [error, setError] = useState('');
  const deleting = Boolean(columnId);
  const column = configuration.status_board.columns.find(
    (item) => item.id === columnId,
  );
  const destinations = configuration.status_board.columns.filter(
    (item) =>
      item.is_active && item.id !== columnId && item.category !== 'blocked',
  );
  async function save() {
    setError('');
    try {
      await mutation.mutateAsync({
        action: deleting ? 'delete' : 'create',
        version: configuration.status_board.version,
        name: name.trim(),
        columnId: columnId ?? undefined,
        destinationId: destinationId || undefined,
      });
      onClose();
    } catch (failure) {
      setError(mutationMessage(failure));
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {deleting
              ? `Excluir coluna ${column?.name ?? ''}`
              : 'Adicionar coluna'}
          </DialogTitle>
          <DialogDescription>
            {deleting
              ? 'A coluna será removida do Quadro e dos quadros dos projetos deste workspace. Todos os cards serão movidos para o destino escolhido, sem perder seus projetos. A conexão desta coluna com a Semana será removida.'
              : 'A nova coluna aparecerá no final do Quadro e nos quadros dos projetos deste workspace. Ela começa como uma etapa de tarefas a fazer.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {deleting ? (
            <div className="space-y-2">
              <Label htmlFor="column-destination">Mover os cards para</Label>
              <Select
                value={destinationId}
                onValueChange={setDestinationId}
                disabled={mutation.isPending}
              >
                <SelectTrigger id="column-destination">
                  <SelectValue placeholder="Escolha uma coluna" />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                O status dos cards mudará para a coluna escolhida, inclusive em
                outros projetos. As regras dessa coluna serão aplicadas.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="new-column-name">Nome da coluna</Label>
              <Input
                id="new-column-name"
                autoFocus
                maxLength={80}
                value={name}
                disabled={mutation.isPending}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Aguardando aprovação"
              />
            </div>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={mutation.isPending}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={deleting ? 'destructive' : 'default'}
              disabled={
                mutation.isPending || (deleting ? !destinationId : !name.trim())
              }
            >
              {mutation.isPending
                ? 'Salvando…'
                : deleting
                  ? 'Mover cards e excluir coluna'
                  : 'Adicionar coluna'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WeekConnectionDialog({
  configuration,
  lane,
  onClose,
}: {
  configuration: TaskBoardConfiguration;
  lane: TaskWeekLane;
  onClose: () => void;
}) {
  const existing = configuration.links.find(
    (item) => item.week_lane_key === lane,
  );
  const [statusId, setStatusId] = useState(existing?.status_id ?? 'none');
  const [error, setError] = useState('');
  const mutation = useConnectWeekBoardColumn(configuration.workspace_id);
  const laneName =
    configuration.week_board.columns.find((item) => item.key === lane)?.name ??
    lane;
  const selected = configuration.status_board.columns.find(
    (item) => item.id === statusId,
  );
  async function save() {
    setError('');
    try {
      await mutation.mutateAsync({
        statusId: statusId === 'none' ? null : statusId,
        lane,
        version: configuration.status_board.version,
      });
      onClose();
    } catch (failure) {
      setError(mutationMessage(failure));
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar {laneName} ao Quadro</DialogTitle>
          <DialogDescription>
            Escolha onde a tarefa deve aparecer quando você a mover para esta
            coluna da Semana.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="week-connected-status">Coluna do Quadro</Label>
          <Select
            value={statusId}
            onValueChange={setStatusId}
            disabled={mutation.isPending}
          >
            <SelectTrigger id="week-connected-status">
              <SelectValue placeholder="Escolha uma coluna" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem conexão</SelectItem>
              {configuration.status_board.columns
                .filter((item) => item.is_active)
                .map((item) => {
                  const otherLink = configuration.links.find(
                    (link) =>
                      link.status_id === item.id && link.week_lane_key !== lane,
                  );
                  return (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      disabled={Boolean(otherLink)}
                    >
                      {item.name}
                      {otherLink ? ' — já conectada' : ''}
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        </div>
        <p className="rounded-lg bg-muted p-3 text-sm">
          {selected
            ? `Ao mover uma tarefa para “${laneName}” na Semana, ela irá para “${selected.name}” no Quadro. Ao mover para “${selected.name}” no Quadro, ela irá para “${laneName}” na Semana. Vale para os próximos movimentos: é a mesma tarefa, sem cópias.`
            : 'Sem conexão, mover uma tarefa nesta coluna não escolhe uma coluna personalizada no Quadro. As regras normais de conclusão e planejamento continuam valendo.'}
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button disabled={mutation.isPending} onClick={() => void save()}>
            {mutation.isPending
              ? 'Salvando…'
              : statusId === 'none' && existing
                ? 'Remover conexão'
                : 'Salvar conexão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
