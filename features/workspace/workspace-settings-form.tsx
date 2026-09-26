'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BellRing,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  Hash,
  LoaderCircle,
  MapPin,
  Save,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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

import { updateWorkspaceSettings } from './workspace-settings-actions';
import {
  workspaceSettingsFormSchema,
  type WorkspaceSettings,
  type WorkspaceSettingsFormInput,
  type WorkspaceSettingsFormValues,
} from './workspace-settings-schema';

const weekDays = [
  { value: 0, short: 'Dom', label: 'Domingo' },
  { value: 1, short: 'Seg', label: 'Segunda-feira' },
  { value: 2, short: 'Ter', label: 'Terça-feira' },
  { value: 3, short: 'Qua', label: 'Quarta-feira' },
  { value: 4, short: 'Qui', label: 'Quinta-feira' },
  { value: 5, short: 'Sex', label: 'Sexta-feira' },
  { value: 6, short: 'Sáb', label: 'Sábado' },
] as const;

const timezoneOptions = [
  { value: 'America/Sao_Paulo', label: 'Brasília · São Paulo' },
  { value: 'America/Fortaleza', label: 'Fortaleza' },
  { value: 'America/Manaus', label: 'Manaus' },
  { value: 'America/Rio_Branco', label: 'Rio Branco' },
  { value: 'America/Noronha', label: 'Fernando de Noronha' },
  { value: 'UTC', label: 'UTC' },
] as const;

const accentOptions = [
  '#0066CC',
  '#5E5CE6',
  '#AF52DE',
  '#FF375F',
  '#FF9F0A',
  '#30D158',
] as const;

const roleLabels = {
  owner: 'Proprietário',
  admin: 'Administradores',
  manager: 'Coordenadores',
  member: 'Colaboradores',
  viewer: 'Observadores',
} as const;

export function WorkspaceSettingsForm({
  initialSettings,
}: {
  initialSettings: WorkspaceSettings;
}) {
  const router = useRouter();
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const form = useForm<
    WorkspaceSettingsFormInput,
    unknown,
    WorkspaceSettingsFormValues
  >({
    resolver: zodResolver(workspaceSettingsFormSchema),
    defaultValues: settingsToFormValues(initialSettings),
  });
  const previewName = useWatch({ control: form.control, name: 'name' });
  const accentColor = useWatch({ control: form.control, name: 'accentColor' });
  const workingDays = useWatch({ control: form.control, name: 'workingDays' });
  const canEdit =
    savedSettings.permissions.canEdit && savedSettings.backendAvailable;
  const totalMembers = Object.values(savedSettings.roleCounts).reduce(
    (total, count) => total + count,
    0,
  );

  async function onSubmit(values: WorkspaceSettingsFormValues) {
    const result = await updateWorkspaceSettings(values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setSavedSettings(result.settings);
    form.reset(settingsToFormValues(result.settings));
    toast.success('Workspace atualizado.');
    router.refresh();
  }

  function toggleWorkingDay(day: number) {
    const selected = workingDays ?? [];
    const next = selected.includes(day)
      ? selected.filter((candidate) => candidate !== day)
      : [...selected, day].sort((a, b) => a - b);
    form.setValue('workingDays', next, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,760px)] lg:gap-12">
      <aside className="self-start lg:sticky lg:top-20">
        <div className="flex items-center gap-3">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-[14px] text-white shadow-sm transition-colors duration-[var(--motion-duration-base)]"
            style={{
              backgroundColor: accentColor || savedSettings.accentColor,
            }}
            aria-hidden="true"
          >
            <Building2 className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-[-0.02em]">
              {previewName?.trim() || savedSettings.name}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {roleLabels[savedSettings.role]}
            </p>
          </div>
        </div>

        <div className="mt-7 border-y py-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Pessoas ativas
            </span>
            <strong className="text-lg font-semibold tabular-nums">
              {totalMembers}
            </strong>
          </div>
          <dl className="mt-4 space-y-2.5">
            {Object.entries(savedSettings.roleCounts).map(([role, count]) => (
              <div
                key={role}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <dt className="text-muted-foreground">
                  {roleLabels[role as keyof typeof roleLabels]}
                </dt>
                <dd className="font-medium tabular-nums">{count}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Button asChild variant="ghost" className="mt-3 w-full justify-start">
          <Link href="/equipe">
            <UsersRound aria-hidden="true" />
            Pessoas e permissões
          </Link>
        </Button>
      </aside>

      <form
        className="min-w-0 space-y-10"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        {!savedSettings.backendAvailable ? (
          <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/[0.055] px-4 py-3 text-sm leading-6">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-primary"
            />
            <p>
              Estas configurações estão disponíveis para consulta. A edição será
              liberada assim que a atualização do workspace for publicada no
              backend.
            </p>
          </div>
        ) : !canEdit ? (
          <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/[0.055] px-4 py-3 text-sm leading-6">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-primary"
            />
            <p>
              Você pode consultar estas definições. Somente proprietários e
              administradores podem alterá-las.
            </p>
          </div>
        ) : null}

        <WorkspaceSection
          icon={Building2}
          title="Identidade"
          description="O nome e a cor ajudam a reconhecer este ambiente ao alternar entre workspaces."
        >
          <Field
            label="Nome do workspace"
            htmlFor="workspace-name"
            error={form.formState.errors.name?.message}
          >
            <Input
              id="workspace-name"
              autoComplete="organization"
              disabled={!canEdit}
              {...form.register('name')}
              aria-invalid={Boolean(form.formState.errors.name)}
              aria-describedby={fieldErrorId(
                'workspace-name',
                form.formState.errors.name?.message,
              )}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Prefixo das tarefas"
              htmlFor="workspace-prefix"
              hint="Usado em referências como PTA-000123."
              error={form.formState.errors.taskPrefix?.message}
            >
              <div className="relative">
                <Hash
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="workspace-prefix"
                  className="pl-9 uppercase"
                  maxLength={8}
                  disabled={!canEdit}
                  {...form.register('taskPrefix', {
                    onChange: (event) => {
                      event.target.value = event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '');
                    },
                  })}
                  aria-invalid={Boolean(form.formState.errors.taskPrefix)}
                  aria-describedby={fieldErrorId(
                    'workspace-prefix',
                    form.formState.errors.taskPrefix?.message,
                  )}
                />
              </div>
            </Field>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Cor de identificação
              </legend>
              <div className="flex min-h-10 flex-wrap items-center gap-2">
                {accentOptions.map((color) => {
                  const selected = accentColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        'grid size-10 place-items-center rounded-full border-2 border-background shadow-[0_0_0_1px_var(--border)] transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55',
                        selected && 'shadow-[0_0_0_2px_var(--ring)]',
                      )}
                      style={{ backgroundColor: color }}
                      disabled={!canEdit}
                      aria-label={`Usar a cor ${color}`}
                      aria-pressed={selected}
                      onClick={() =>
                        form.setValue('accentColor', color, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      {selected ? (
                        <Check
                          className="size-4 text-white"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          icon={CalendarDays}
          title="Calendário de trabalho"
          description="Estas regras organizam a semana e calculam horários no contexto correto."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Fuso horário" htmlFor="workspace-timezone">
              <Controller
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    disabled={!canEdit}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="workspace-timezone" className="w-full">
                      <MapPin aria-hidden="true" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezoneOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="A semana começa em" htmlFor="workspace-week-start">
              <Controller
                control={form.control}
                name="weekStartsOn"
                render={({ field }) => (
                  <Select
                    value={String(field.value)}
                    disabled={!canEdit}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger id="workspace-week-start" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekDays.map((day) => (
                        <SelectItem key={day.value} value={String(day.value)}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Dias de trabalho</legend>
            <p className="text-sm leading-5 text-muted-foreground">
              A semana operacional e futuros cálculos de SLA usam estes dias.
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {weekDays.map((day) => {
                const selected = workingDays?.includes(day.value) ?? false;
                return (
                  <button
                    key={day.value}
                    type="button"
                    disabled={!canEdit}
                    aria-pressed={selected}
                    aria-label={day.label}
                    onClick={() => toggleWorkingDay(day.value)}
                    className={cn(
                      'min-h-11 rounded-xl border px-2 text-sm font-medium transition-[background-color,border-color,color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55',
                      selected
                        ? 'border-primary/45 bg-primary/10 text-primary'
                        : 'bg-card text-muted-foreground hover:border-interactive-border hover:bg-interactive/55',
                    )}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
            {form.formState.errors.workingDays?.message ? (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.workingDays.message}
              </p>
            ) : null}
          </fieldset>

          <Field
            label="Horário padrão de entrega"
            htmlFor="workspace-due-time"
            hint="Usado quando uma tarefa tem data e precisa de um horário padrão."
            error={form.formState.errors.defaultDueTime?.message}
          >
            <div className="relative max-w-52">
              <Clock3
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="workspace-due-time"
                type="time"
                className="pl-9"
                disabled={!canEdit}
                {...form.register('defaultDueTime')}
                aria-invalid={Boolean(form.formState.errors.defaultDueTime)}
                aria-describedby={fieldErrorId(
                  'workspace-due-time',
                  form.formState.errors.defaultDueTime?.message,
                )}
              />
            </div>
          </Field>
        </WorkspaceSection>

        <WorkspaceSection
          icon={BellRing}
          title="Rotina da equipe"
          description="Defina padrões compartilhados que reduzem ajustes repetidos."
        >
          <Controller
            control={form.control}
            name="notificationDigest"
            render={({ field }) => (
              <div className="flex min-h-16 items-center gap-4 rounded-xl bg-muted/45 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Label
                    htmlFor="workspace-digest"
                    className="text-sm font-medium"
                  >
                    Resumo de notificações
                  </Label>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    Mantém o resumo periódico habilitado como padrão do
                    workspace.
                  </p>
                </div>
                <button
                  id="workspace-digest"
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  disabled={!canEdit}
                  onClick={() => field.onChange(!field.value)}
                  className={cn(
                    'relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55',
                    field.value ? 'bg-primary' : 'bg-input',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-[var(--motion-duration-base)]',
                      field.value ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
              </div>
            )}
          />
        </WorkspaceSection>

        <section
          className="border-t pt-6"
          aria-labelledby="workspace-access-title"
        >
          <div className="flex items-start gap-3">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-primary"
            />
            <div>
              <h2 id="workspace-access-title" className="font-semibold">
                Limites administrativos
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Proprietários e administradores configuram o workspace.
                Coordenadores operam fluxos e catálogos; colaboradores executam
                o trabalho; observadores consultam. Transferir propriedade é uma
                ação exclusiva do proprietário em Pessoas e permissões.
              </p>
            </div>
          </div>
        </section>

        {canEdit ? (
          <div className="sticky bottom-4 z-10 flex justify-end rounded-2xl border bg-card/90 p-3 shadow-lg backdrop-blur-xl">
            <Button
              type="submit"
              size="lg"
              disabled={!form.formState.isDirty || form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {form.formState.isSubmitting ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  );
}

function WorkspaceSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const id = `workspace-section-${title.toLocaleLowerCase('pt-BR').replace(/\W+/g, '-')}`;
  return (
    <section
      className="border-t pt-7 first:border-t-0 first:pt-0"
      aria-labelledby={id}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <div>
          <h2 id={id} className="text-xl font-semibold tracking-[-0.025em]">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-5 sm:pl-12">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function fieldErrorId(field: string, error?: string) {
  return error ? `${field}-error` : undefined;
}

function settingsToFormValues(
  settings: WorkspaceSettings,
): WorkspaceSettingsFormInput {
  return {
    workspaceId: settings.workspaceId,
    expectedVersion: settings.version,
    name: settings.name,
    taskPrefix: settings.taskPrefix,
    accentColor: settings.accentColor,
    timezone: settings.timezone,
    weekStartsOn: settings.weekStartsOn,
    workingDays: settings.workingDays,
    defaultDueTime: settings.defaultDueTime,
    notificationDigest: settings.notificationDigest,
  };
}
