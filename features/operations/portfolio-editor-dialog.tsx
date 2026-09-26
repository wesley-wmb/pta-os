'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { WorkspaceMember } from '@/features/workspace/types';
import { createClient } from '@/lib/supabase/client';

import {
  eventFormSchema,
  portfolioMutationSchema,
  productFormSchema,
} from './portfolio-schemas';
import { portfolioKeys } from './portfolio-queries';
import type { EventDetail, ProductDetail, ProductSummary } from './types';

type CommonProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  members: WorkspaceMember[];
  onSaved: (id: string) => void;
};

export function ProductEditorDialog({
  open,
  onOpenChange,
  workspaceId,
  members,
  detail = null,
  onSaved,
}: CommonProps & { detail?: ProductDetail | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(detail?.product.name ?? '');
  const [status, setStatus] = useState(detail?.product.status ?? 'active');
  const [description, setDescription] = useState(
    detail?.product.description ?? '',
  );
  const [ownerId, setOwnerId] = useState(detail?.product.ownerId ?? 'none');
  const [teamIds, setTeamIds] = useState(
    () => new Set(detail?.team.map((member) => member.id) ?? []),
  );
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const parsed = productFormSchema.safeParse({
      name,
      status,
      description,
      ownerId,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revise os campos.');
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const result = detail
      ? await supabase.rpc('update_product_operational', {
          p_product_id: detail.product.id,
          p_expected_version: detail.product.version,
          p_patch: {
            name: parsed.data.name,
            status: parsed.data.status,
            description: parsed.data.description,
            owner_id:
              parsed.data.ownerId === 'none' ? null : parsed.data.ownerId,
          },
          p_member_ids: [...teamIds],
        })
      : await supabase.rpc('create_product_operational', {
          p_workspace_id: workspaceId,
          p_name: parsed.data.name,
          p_status: parsed.data.status,
          p_description: parsed.data.description,
          p_owner_id:
            parsed.data.ownerId === 'none' ? undefined : parsed.data.ownerId,
          p_member_ids: [...teamIds],
        });
    setPending(false);
    if (result.error) {
      setError(
        result.error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Este produto mudou em outra sessão. Feche e abra novamente.'
          : 'Não foi possível salvar o produto.',
      );
      return;
    }
    const response = portfolioMutationSchema.safeParse(result.data);
    if (!response.success) {
      setError('O produto foi salvo, mas a resposta não pôde ser validada.');
      router.refresh();
      return;
    }
    toast.success(detail ? 'Produto atualizado.' : 'Produto criado.');
    await queryClient.invalidateQueries({
      queryKey: portfolioKeys.product(workspaceId, response.data.id),
    });
    onOpenChange(false);
    onSaved(response.data.id);
    router.refresh();
  }

  return (
    <PortfolioDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={detail ? 'Editar produto' : 'Novo produto'}
      description="Organize o trabalho contínuo, as pessoas e os projetos relacionados."
      pending={pending}
      error={error}
      onSubmit={submit}
    >
      <Field label="Nome" id="product-name">
        <Input
          id="product-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          maxLength={180}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" id="product-status">
          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(value as 'planning' | 'active' | 'paused' | 'completed')
            }
          >
            <SelectTrigger id="product-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planning">Planejamento</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="paused">Pausado</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <OwnerField
          members={members}
          ownerId={ownerId}
          setOwnerId={setOwnerId}
          id="product-owner"
        />
      </div>
      <Field label="Descrição" id="product-description">
        <Textarea
          id="product-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          maxLength={4000}
        />
      </Field>
      <TeamField
        members={members}
        selected={teamIds}
        setSelected={setTeamIds}
        prefix="product"
      />
    </PortfolioDialogFrame>
  );
}

export function EventEditorDialog({
  open,
  onOpenChange,
  workspaceId,
  members,
  products,
  detail = null,
  onSaved,
}: CommonProps & {
  products: ProductSummary[];
  detail?: EventDetail | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(detail?.event.name ?? '');
  const [status, setStatus] = useState(detail?.event.status ?? 'planning');
  const [healthOverride, setHealthOverride] = useState(
    detail?.event.healthOverride ?? 'auto',
  );
  const [productId, setProductId] = useState(detail?.event.productId ?? 'none');
  const [ownerId, setOwnerId] = useState(detail?.event.ownerId ?? 'none');
  const [startDate, setStartDate] = useState(detail?.event.startDate ?? '');
  const [endDate, setEndDate] = useState(detail?.event.endDate ?? '');
  const [summary, setSummary] = useState(detail?.event.summary ?? '');
  const [objective, setObjective] = useState(detail?.event.objective ?? '');
  const [successMetric, setSuccessMetric] = useState(
    detail?.event.successMetric ?? '',
  );
  const [teamIds, setTeamIds] = useState(
    () => new Set(detail?.team.map((member) => member.id) ?? []),
  );
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const parsed = eventFormSchema.safeParse({
      name,
      status,
      healthOverride,
      productId,
      ownerId,
      startDate,
      endDate,
      summary,
      objective,
      successMetric,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revise os campos.');
      return;
    }
    setPending(true);
    setError(null);
    const values = parsed.data;
    const supabase = createClient();
    const result = detail
      ? await supabase.rpc('update_event_operational', {
          p_event_id: detail.event.id,
          p_expected_version: detail.event.version,
          p_patch: {
            name: values.name,
            status: values.status,
            health_override:
              values.healthOverride === 'auto' ? null : values.healthOverride,
            product_id: values.productId === 'none' ? null : values.productId,
            owner_id: values.ownerId === 'none' ? null : values.ownerId,
            start_date: values.startDate || null,
            end_date: values.endDate || null,
            summary: values.summary,
            objective: values.objective,
            success_metric: values.successMetric,
          },
          p_member_ids: [...teamIds],
        })
      : await supabase.rpc('create_event_operational', {
          p_workspace_id: workspaceId,
          p_name: values.name,
          p_status: values.status,
          p_product_id:
            values.productId === 'none' ? undefined : values.productId,
          p_owner_id: values.ownerId === 'none' ? undefined : values.ownerId,
          p_start_date: values.startDate || undefined,
          p_end_date: values.endDate || undefined,
          p_summary: values.summary,
          p_objective: values.objective,
          p_success_metric: values.successMetric,
          p_member_ids: [...teamIds],
        });
    setPending(false);
    if (result.error) {
      setError(
        result.error.message.includes('PTA_VERSION_CONFLICT')
          ? 'Este projeto mudou em outra sessão. Feche e abra novamente.'
          : 'Não foi possível salvar o projeto.',
      );
      return;
    }
    const response = portfolioMutationSchema.safeParse(result.data);
    if (!response.success) {
      setError('O projeto foi salvo, mas a resposta não pôde ser validada.');
      router.refresh();
      return;
    }
    toast.success(detail ? 'Projeto atualizado.' : 'Projeto criado.');
    await queryClient.invalidateQueries({
      queryKey: portfolioKeys.event(workspaceId, response.data.id),
    });
    onOpenChange(false);
    onSaved(response.data.id);
    router.refresh();
  }

  return (
    <PortfolioDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={detail ? 'Editar projeto' : 'Novo projeto'}
      description="Defina propósito, período e equipe. As tarefas criadas aqui também aparecem na área pessoal de cada responsável."
      pending={pending}
      error={error}
      onSubmit={submit}
    >
      <Field label="Nome" id="event-name">
        <Input
          id="event-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          maxLength={180}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" id="event-status">
          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(
                value as 'planning' | 'active' | 'completed' | 'cancelled',
              )
            }
          >
            <SelectTrigger id="event-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planning">Planejamento</SelectItem>
              <SelectItem value="active">Em curso</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {detail ? (
          <Field label="Saúde" id="event-health">
            <Select
              value={healthOverride}
              onValueChange={(value) =>
                setHealthOverride(value as typeof healthOverride)
              }
            >
              <SelectTrigger id="event-health" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Calculada automaticamente</SelectItem>
                <SelectItem value="healthy">Saudável</SelectItem>
                <SelectItem value="attention">Atenção</SelectItem>
                <SelectItem value="risk">Em risco</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field label="Produto" id="event-product">
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="event-product" className="w-full">
                <SelectValue placeholder="Sem produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem produto</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
      {detail ? (
        <Field label="Produto" id="event-product">
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger id="event-product" className="w-full">
              <SelectValue placeholder="Sem produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem produto</SelectItem>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <OwnerField
        members={members}
        ownerId={ownerId}
        setOwnerId={setOwnerId}
        id="event-owner"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Início" id="event-start">
          <Input
            id="event-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </Field>
        <Field label="Fim" id="event-end">
          <Input
            id="event-end"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </Field>
      </div>
      <Field label="Resumo" id="event-summary">
        <Textarea
          id="event-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={3}
          maxLength={4000}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Objetivo" id="event-objective">
          <Textarea
            id="event-objective"
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            rows={3}
            maxLength={1000}
          />
        </Field>
        <Field label="Métrica de sucesso" id="event-metric">
          <Textarea
            id="event-metric"
            value={successMetric}
            onChange={(event) => setSuccessMetric(event.target.value)}
            rows={3}
            maxLength={500}
          />
        </Field>
      </div>
      <TeamField
        members={members}
        selected={teamIds}
        setSelected={setTeamIds}
        prefix="event"
      />
    </PortfolioDialogFrame>
  );
}

function PortfolioDialogFrame({
  open,
  onOpenChange,
  title,
  description,
  pending,
  error,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  pending: boolean;
  error: string | null;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-24px)] gap-0 overflow-y-auto p-0 sm:max-w-[720px]">
        <DialogHeader className="border-b px-5 py-5 text-left sm:px-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5 px-5 py-6 sm:px-6"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
        >
          {children}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter className="border-t pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function OwnerField({
  members,
  ownerId,
  setOwnerId,
  id,
}: {
  members: WorkspaceMember[];
  ownerId: string;
  setOwnerId: (id: string) => void;
  id: string;
}) {
  return (
    <Field label="Responsável" id={id}>
      <Select value={ownerId} onValueChange={setOwnerId}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Sem responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sem responsável</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function TeamField({
  members,
  selected,
  setSelected,
  prefix,
}: {
  members: WorkspaceMember[];
  selected: Set<string>;
  setSelected: (value: Set<string>) => void;
  prefix: string;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Equipe</legend>
      <div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
        {members.map((member) => {
          const id = `${prefix}-team-${member.id}`;
          return (
            <label
              key={member.id}
              htmlFor={id}
              className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted"
            >
              <Checkbox
                id={id}
                checked={selected.has(member.id)}
                onCheckedChange={(checked) => {
                  const next = new Set(selected);
                  if (checked) next.add(member.id);
                  else next.delete(member.id);
                  setSelected(next);
                }}
              />
              <span className="min-w-0 truncate">{member.fullName}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
