'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Save,
  UserRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import {
  initialsFor,
  profileFormSchema,
  profileResponseSchema,
  type ProfileFormInput,
} from './schemas';
import type { ProfileData } from './types';

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState(profile.updatedAt);
  const form = useForm<ProfileFormInput>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: formValues(profile),
  });
  const watchedName = useWatch({ control: form.control, name: 'fullName' });
  const watchedAvatar = useWatch({ control: form.control, name: 'avatarUrl' });
  const watchedJobTitle = useWatch({
    control: form.control,
    name: 'jobTitle',
  });
  const watchedBio = useWatch({ control: form.control, name: 'bio' });
  const previewName = watchedName.trim() || profile.fullName;

  async function onSubmit(values: ProfileFormInput) {
    if (!profile.canEdit) return;
    const result = await createClient().rpc('update_own_profile', {
      p_avatar_path: emptyToNull(values.avatarUrl),
      p_bio: emptyToNull(values.bio),
      p_department: emptyToNull(values.department),
      p_expected_updated_at: updatedAt,
      p_full_name: values.fullName.trim(),
      p_job_title: emptyToNull(values.jobTitle),
      p_pronouns: emptyToNull(values.pronouns),
    });

    if (result.error) {
      if (result.error.message.includes('PTA_VERSION_CONFLICT')) {
        toast.error(
          'Seu perfil mudou em outra aba. Atualize a página e revise.',
        );
        return;
      }
      if (
        result.error.message.includes('update_own_profile') ||
        result.error.code === 'PGRST202'
      ) {
        toast.error(
          'A atualização de perfil ainda não foi publicada no backend.',
        );
        return;
      }
      toast.error('Não foi possível salvar seu perfil. Tente novamente.');
      return;
    }

    const parsed = profileResponseSchema.safeParse(result.data);
    if (!parsed.success) {
      toast.error(
        'O perfil foi salvo, mas a resposta não pôde ser confirmada.',
      );
      router.refresh();
      return;
    }

    setUpdatedAt(parsed.data.updatedAt);
    form.reset(formValues({ ...parsed.data, canEdit: true }));
    toast.success('Perfil atualizado.');
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,720px)] lg:gap-12">
      <aside
        className="self-start lg:sticky lg:top-20"
        aria-label="Resumo do perfil"
      >
        <div className="flex items-center gap-4 lg:flex-col lg:items-start">
          <Avatar
            className="size-20 shadow-sm ring-1 ring-border"
            aria-label={previewName}
          >
            {watchedAvatar ? <AvatarImage src={watchedAvatar} alt="" /> : null}
            <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
              {initialsFor(previewName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-[-0.02em]">
              {previewName}
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {watchedJobTitle.trim() || 'Seu perfil profissional'}
            </p>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          Estas informações ajudam a equipe a reconhecer você nas tarefas,
          projetos e conversas.
        </p>
      </aside>

      <form
        className="min-w-0 space-y-10"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        {!profile.canEdit ? (
          <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/[0.055] px-4 py-3 text-sm leading-6">
            <LockKeyhole
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-primary"
            />
            <p>
              Seu perfil está disponível para consulta. A edição será liberada
              assim que a atualização de perfil for publicada no backend.
            </p>
          </div>
        ) : null}

        <ProfileSection
          icon={UserRound}
          title="Identidade"
          description="Como você aparece para as pessoas dos seus workspaces."
        >
          <Field
            label="Nome"
            htmlFor="profile-full-name"
            error={form.formState.errors.fullName?.message}
            required
          >
            <Input
              id="profile-full-name"
              autoComplete="name"
              disabled={!profile.canEdit}
              {...form.register('fullName')}
              aria-invalid={Boolean(form.formState.errors.fullName)}
              aria-describedby={errorId(
                'full-name',
                form.formState.errors.fullName?.message,
              )}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Pronomes"
              htmlFor="profile-pronouns"
              hint="Opcional · exemplo: ela/dela"
              error={form.formState.errors.pronouns?.message}
            >
              <Input
                id="profile-pronouns"
                placeholder="ela/dela"
                disabled={!profile.canEdit}
                {...form.register('pronouns')}
                aria-invalid={Boolean(form.formState.errors.pronouns)}
                aria-describedby={errorId(
                  'pronouns',
                  form.formState.errors.pronouns?.message,
                )}
              />
            </Field>
            <Field
              label="Imagem do perfil"
              htmlFor="profile-avatar"
              hint="URL HTTPS de uma imagem compartilhável"
              error={form.formState.errors.avatarUrl?.message}
            >
              <div className="relative">
                <Link2
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="profile-avatar"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://…"
                  className="pl-9"
                  disabled={!profile.canEdit}
                  {...form.register('avatarUrl')}
                  aria-invalid={Boolean(form.formState.errors.avatarUrl)}
                  aria-describedby={errorId(
                    'avatar',
                    form.formState.errors.avatarUrl?.message,
                  )}
                />
              </div>
            </Field>
          </div>
        </ProfileSection>

        <ProfileSection
          icon={BriefcaseBusiness}
          title="Contexto profissional"
          description="Informações úteis para distribuir e revisar o trabalho."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Cargo ou função"
              htmlFor="profile-job-title"
              error={form.formState.errors.jobTitle?.message}
            >
              <div className="relative">
                <BriefcaseBusiness
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="profile-job-title"
                  placeholder="Ex.: Web designer"
                  className="pl-9"
                  disabled={!profile.canEdit}
                  {...form.register('jobTitle')}
                  aria-invalid={Boolean(form.formState.errors.jobTitle)}
                  aria-describedby={errorId(
                    'job-title',
                    form.formState.errors.jobTitle?.message,
                  )}
                />
              </div>
            </Field>
            <Field
              label="Área ou time"
              htmlFor="profile-department"
              error={form.formState.errors.department?.message}
            >
              <div className="relative">
                <Building2
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="profile-department"
                  placeholder="Ex.: Criação"
                  className="pl-9"
                  disabled={!profile.canEdit}
                  {...form.register('department')}
                  aria-invalid={Boolean(form.formState.errors.department)}
                  aria-describedby={errorId(
                    'department',
                    form.formState.errors.department?.message,
                  )}
                />
              </div>
            </Field>
          </div>
          <Field
            label="Sobre você"
            htmlFor="profile-bio"
            hint={`${watchedBio.length}/500`}
            error={form.formState.errors.bio?.message}
          >
            <Textarea
              id="profile-bio"
              rows={4}
              placeholder="Conte à equipe em que você trabalha e como prefere colaborar."
              className="min-h-28 resize-y"
              disabled={!profile.canEdit}
              {...form.register('bio')}
              aria-invalid={Boolean(form.formState.errors.bio)}
              aria-describedby={errorId(
                'bio',
                form.formState.errors.bio?.message,
              )}
            />
          </Field>
        </ProfileSection>

        <ProfileSection
          icon={LockKeyhole}
          title="Conta"
          description="Dados de autenticação administrados pelo seu acesso ao PTA OS."
        >
          <div className="flex min-h-16 items-center gap-3 rounded-xl border bg-muted/30 px-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-muted-foreground ring-1 ring-border">
              <Mail aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">
                E-mail
              </p>
              <p className="truncate text-sm font-medium">{profile.email}</p>
            </div>
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <BadgeCheck
                aria-hidden="true"
                className="size-4 text-pta-success"
              />
              Conta autenticada
            </span>
          </div>
        </ProfileSection>

        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-4 border-t bg-background/92 px-4 py-4 backdrop-blur-xl sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          <p
            className={cn(
              'text-sm text-muted-foreground transition-opacity',
              form.formState.isDirty ? 'opacity-100' : 'opacity-0',
            )}
            aria-live="polite"
          >
            Alterações não salvas
          </p>
          <Button
            type="submit"
            size="lg"
            disabled={
              !profile.canEdit ||
              !form.formState.isDirty ||
              form.formState.isSubmitting
            }
          >
            {form.formState.isSubmitting ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Save aria-hidden="true" />
            )}
            {form.formState.isSubmitting ? 'Salvando…' : 'Salvar perfil'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ProfileSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t pt-7 first:border-t-0 first:pt-0">
      <div className="mb-6 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.8} />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.015em]">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const id = `${htmlFor.replace('profile-', '')}-error`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={htmlFor}>
          {label}
          {required ? <span className="sr-only"> (obrigatório)</span> : null}
        </Label>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p id={id} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function formValues(profile: ProfileData): ProfileFormInput {
  return {
    fullName: profile.fullName,
    pronouns: profile.pronouns ?? '',
    jobTitle: profile.jobTitle ?? '',
    department: profile.department ?? '',
    bio: profile.bio ?? '',
    avatarUrl: profile.avatarUrl ?? '',
  };
}

function emptyToNull(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function errorId(field: string, error?: string) {
  return error ? `${field}-error` : undefined;
}
