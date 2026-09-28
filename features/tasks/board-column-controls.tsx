'use client';

import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock3,
  Eye,
  Inbox,
  Lightbulb,
  Link2,
  MoreHorizontal,
  Pencil,
  Trash2,
  RotateCcw,
  Sparkles,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type BoardColumnDirection = 'left' | 'right';

export type BoardColumnColor =
  'stone' | 'blue' | 'violet' | 'amber' | 'red' | 'green' | 'teal' | 'pink';

export type BoardColumnIcon =
  | 'circle'
  | 'inbox'
  | 'clock'
  | 'eye'
  | 'alert'
  | 'check'
  | 'cancel'
  | 'zap'
  | 'rotate'
  | 'link'
  | 'idea'
  | 'archive';

export type BoardColumnWeekLink =
  | 'none'
  | 'backlog'
  | 'emergency'
  | 'important'
  | 'delivered'
  | 'revision'
  | 'ideas'
  | 'discarded';

export type BoardColumnEditableValues = {
  name: string;
  coverUrl?: string | null;
  color: BoardColumnColor;
  icon: BoardColumnIcon;
  weekLink: BoardColumnWeekLink;
};

export type BoardColumnControlsProps = {
  onDelete?: () => void;
  columnId: string;
  value: BoardColumnEditableValues;
  disabled?: boolean;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  automationCount?: number;
  showWeekLink?: boolean;
  weekLinkOptions?: ReadonlyArray<{
    value: BoardColumnWeekLink;
    label: string;
  }>;
  onUpdate: (
    columnId: string,
    value: BoardColumnEditableValues,
  ) => void | Promise<void>;
  onOpenAutomations: (columnId: string) => void;
  onMove: (
    columnId: string,
    direction: BoardColumnDirection,
  ) => void | Promise<void>;
};

const COLOR_OPTIONS: ReadonlyArray<{
  value: BoardColumnColor;
  label: string;
  swatch: string;
}> = [
  { value: 'stone', label: 'Neutro', swatch: 'bg-stone-500' },
  { value: 'blue', label: 'Azul', swatch: 'bg-blue-500' },
  { value: 'violet', label: 'Violeta', swatch: 'bg-violet-500' },
  { value: 'amber', label: 'Âmbar', swatch: 'bg-amber-500' },
  { value: 'red', label: 'Vermelho', swatch: 'bg-red-500' },
  { value: 'green', label: 'Verde', swatch: 'bg-emerald-500' },
  { value: 'teal', label: 'Turquesa', swatch: 'bg-teal-500' },
  { value: 'pink', label: 'Rosa', swatch: 'bg-pink-500' },
];

const ICON_OPTIONS: ReadonlyArray<{
  value: BoardColumnIcon;
  label: string;
  icon: LucideIcon;
}> = [
  { value: 'circle', label: 'Círculo', icon: Circle },
  { value: 'inbox', label: 'Caixa de entrada', icon: Inbox },
  { value: 'clock', label: 'Relógio', icon: Clock3 },
  { value: 'eye', label: 'Revisão', icon: Eye },
  { value: 'alert', label: 'Alerta', icon: AlertCircle },
  { value: 'check', label: 'Concluído', icon: CheckCircle2 },
  { value: 'cancel', label: 'Cancelado', icon: XCircle },
  { value: 'zap', label: 'Emergência', icon: Zap },
  { value: 'rotate', label: 'Alterações', icon: RotateCcw },
  { value: 'link', label: 'Link', icon: Link2 },
  { value: 'idea', label: 'Ideia', icon: Lightbulb },
  { value: 'archive', label: 'Arquivo', icon: Archive },
];

const WEEK_LINK_OPTIONS: ReadonlyArray<{
  value: BoardColumnWeekLink;
  label: string;
}> = [
  { value: 'none', label: 'Sem vínculo' },
  { value: 'emergency', label: 'Emergência' },
  { value: 'important', label: 'Links importantes' },
  { value: 'backlog', label: 'Para planejar' },
  { value: 'delivered', label: 'Concluídos' },
  { value: 'revision', label: 'Alterações' },
  { value: 'ideas', label: 'Ideias criativas' },
  { value: 'discarded', label: 'Arquivados' },
];

export function BoardColumnControls({
  columnId,
  value,
  disabled = false,
  canMoveLeft = true,
  canMoveRight = true,
  automationCount = 0,
  showWeekLink = true,
  weekLinkOptions = WEEK_LINK_OPTIONS,
  onUpdate,
  onOpenAutomations,
  onMove,
  onDelete,
}: BoardColumnControlsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  function openEditor() {
    setDraft(value);
    setError(undefined);
    setEditOpen(true);
  }

  async function save() {
    const name = draft.name.trim();
    if (!name) {
      setError('Informe um nome para a coluna.');
      return;
    }

    if (draft.coverUrl) {
      try {
        const url = new URL(draft.coverUrl);
        if (
          url.protocol !== 'https:' ||
          url.username ||
          url.password ||
          draft.coverUrl.length > 2048
        )
          throw new Error();
      } catch {
        setError('Use um link HTTPS válido para a imagem de capa.');
        return;
      }
    }
    setSaving(true);
    setError(undefined);
    try {
      await onUpdate(columnId, { ...draft, name });
      setEditOpen(false);
    } catch (error) {
      setError(
        String((error as { message?: string })?.message ?? error).includes(
          'PTA_BOARD_LANE_ALREADY_CONNECTED',
        )
          ? 'Essa faixa da Semana já está conectada a outra coluna. Desconecte a regra anterior ou escolha outra faixa.'
          : 'Não foi possível salvar a coluna. Atualize o quadro e tente novamente.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Ações da coluna ${value.name}`}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={openEditor}>
            <Pencil aria-hidden="true" />
            Editar coluna
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (showWeekLink) openEditor();
              else onOpenAutomations(columnId);
            }}
          >
            <Sparkles aria-hidden="true" />
            Automações
            {automationCount > 0 ? (
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {automationCount}
              </span>
            ) : null}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!canMoveLeft}
            onSelect={() => void onMove(columnId, 'left')}
          >
            <ArrowLeft aria-hidden="true" />
            Mover para a esquerda
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canMoveRight}
            onSelect={() => void onMove(columnId, 'right')}
          >
            <ArrowRight aria-hidden="true" />
            Mover para a direita
          </DropdownMenuItem>
          {onDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onSelect={onDelete}
              >
                <Trash2 />
                Excluir coluna
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => !saving && setEditOpen(open)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar coluna</DialogTitle>
            <DialogDescription>
              Ajuste a aparência e o vínculo operacional desta coluna.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`board-column-name-${columnId}`}>Nome</Label>
              <Input
                id={`board-column-name-${columnId}`}
                value={draft.name}
                maxLength={80}
                disabled={saving}
                aria-invalid={Boolean(error && !draft.name.trim())}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`board-column-color-${columnId}`}>Cor</Label>
                <Select
                  value={draft.color}
                  disabled={saving}
                  onValueChange={(color) =>
                    setDraft((current) => ({
                      ...current,
                      color: color as BoardColumnColor,
                    }))
                  }
                >
                  <SelectTrigger
                    id={`board-column-color-${columnId}`}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span
                          className={cn('size-2.5 rounded-full', option.swatch)}
                          aria-hidden="true"
                        />
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`board-column-icon-${columnId}`}>Ícone</Label>
                <Select
                  value={draft.icon}
                  disabled={saving}
                  onValueChange={(icon) =>
                    setDraft((current) => ({
                      ...current,
                      icon: icon as BoardColumnIcon,
                    }))
                  }
                >
                  <SelectTrigger
                    id={`board-column-icon-${columnId}`}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <Icon aria-hidden="true" />
                          {option.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`board-column-cover-${columnId}`}>
                Imagem de capa
              </Label>
              <Input
                id={`board-column-cover-${columnId}`}
                type="url"
                placeholder="https://…"
                value={draft.coverUrl ?? ''}
                disabled={saving}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    coverUrl: event.target.value.trim() || null,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Cole o link HTTPS de uma imagem. Deixe vazio para remover a
                capa.
              </p>
            </div>
            {showWeekLink ? (
              <div className="space-y-2">
                <Label htmlFor={`board-column-week-${columnId}`}>
                  Conectar com a Semana
                </Label>
                <Select
                  value={draft.weekLink}
                  disabled={saving}
                  onValueChange={(weekLink) =>
                    setDraft((current) => ({
                      ...current,
                      weekLink: weekLink as BoardColumnWeekLink,
                    }))
                  }
                >
                  <SelectTrigger
                    id={`board-column-week-${columnId}`}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {weekLinkOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-5 text-muted-foreground">
                  {draft.weekLink === 'none'
                    ? 'Sem regra automática. Mover um card aqui não altera a faixa da Semana.'
                    : `Quando um card entrar em “${draft.name || value.name}”, ele também irá para “${weekLinkOptions.find((option) => option.value === draft.weekLink)?.label}” na Semana. O caminho inverso também funciona. É a mesma tarefa, sem cópias. A regra vale para os próximos movimentos.`}
                </p>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <DialogFooter className="mt-5">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !draft.name.trim()}>
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BoardColumnIconGlyph({
  icon,
  className,
}: {
  icon: BoardColumnIcon;
  className?: string;
}) {
  const Icon =
    ICON_OPTIONS.find((option) => option.value === icon)?.icon ?? Circle;
  return <Icon aria-hidden="true" className={className} />;
}
