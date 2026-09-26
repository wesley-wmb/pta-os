import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Layers3,
  LockKeyhole,
  Route,
  Send,
  ShieldCheck,
  UserRoundCog,
  UsersRound,
} from 'lucide-react';

import {
  ACCESS_ROLE_POLICIES,
  DEFAULT_MARKETING_WORKFLOW,
  OPERATING_DEFAULTS,
  STANDARD_FUNCTIONAL_ROLES,
  WORKSPACE_ACCESS_ROLES,
  type FunctionalRoleKey,
  type TaskAssignmentTarget,
  type WorkflowStepKind,
} from './operating-model';

const ASSIGNMENT_TARGET_LABEL: Record<TaskAssignmentTarget, string> = {
  self: 'Para si',
  own_team_queue: 'À fila da própria equipe',
  workflow_next_owner: 'Ao próximo responsável do fluxo',
  workspace_member: 'A qualquer colaborador ativo',
};

const STEP_KIND_LABEL: Record<WorkflowStepKind, string> = {
  work: 'Produção',
  review: 'Revisão',
  approval: 'Decisão',
  release: 'Publicação',
};

const CURRENT_TASK_RULES = [
  {
    role: 'Proprietário, administrador e coordenador',
    rule: 'Criam demandas, editam qualquer demanda e atribuem pessoas ativas.',
  },
  {
    role: 'Colaborador',
    rule: 'Cria demandas, atribui a si mesmo e edita o que criou ou recebeu.',
  },
  {
    role: 'Observador',
    rule: 'Consulta o trabalho sem criar, atribuir ou editar.',
  },
] as const;

const NEXT_DELIVERIES = [
  {
    title: 'Publicar equipes e funções',
    description:
      'Levar a fundação local ao Supabase hospedado e validar as permissões antes de liberar os controles.',
  },
  {
    title: 'Fila da equipe e handoff',
    description:
      'Enviar uma demanda para uma equipe, permitir que alguém assuma e registrar cada passagem.',
  },
  {
    title: 'Fluxos e aprovações',
    description:
      'Ativar modelos reutilizáveis, revisões, pedidos de ajuste e aprovação final com histórico.',
  },
] as const;

const functionalRoleByKey = new Map<FunctionalRoleKey, string>(
  STANDARD_FUNCTIONAL_ROLES.map((role) => [role.key, role.label]),
);

const workflowStepByKey = new Map(
  DEFAULT_MARKETING_WORKFLOW.steps.map((step) => [step.key, step.label]),
);

export function TeamOperatingModelView() {
  return (
    <div className="space-y-14 pb-4">
      <section
        className="border-y border-primary/20 bg-primary/[0.045] px-4 py-5 sm:px-6"
        aria-labelledby="operating-model-status-title"
      >
        <div className="flex items-start gap-3">
          <Route
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-primary"
          />
          <div className="max-w-3xl">
            <p
              id="operating-model-status-title"
              className="font-semibold text-foreground"
            >
              Modelo definido, ativação em etapas
            </p>
            <p className="mt-1 text-[15px] leading-6 text-muted-foreground">
              Pessoas, convites e níveis de acesso já funcionam. A fundação de
              equipes, funções e handoffs está pronta localmente e aguarda
              publicação no Supabase. Esta visão explica a regra antes de
              liberar os controles.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="workspace-structure-title">
        <SectionHeading
          id="workspace-structure-title"
          icon={Layers3}
          title="Uma operação por workspace"
          description="O workspace protege dados, contexto e permissões. As equipes organizam o trabalho dentro dele."
        />

        <div className="mt-6 grid border-y lg:grid-cols-2">
          <article className="py-6 pr-0 lg:pr-8">
            <p className="text-sm font-semibold text-primary">Workspace</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
              Limite de segurança e contexto
            </h3>
            <p className="mt-3 max-w-xl text-[15px] leading-6 text-muted-foreground">
              Deve representar uma empresa, cliente ou operação que precisa de
              dados isolados. Produtos, eventos, recursos, demandas e histórico
              continuam pertencendo ao mesmo workspace.
            </p>
            <p className="mt-4 flex items-start gap-2 text-sm leading-6">
              <CheckCircle2
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-primary"
              />
              Uma pessoa pode participar de vários workspaces e ter um nível de
              acesso diferente em cada um.
            </p>
          </article>

          <article className="border-t py-6 lg:border-l lg:border-t-0 lg:pl-8">
            <p className="text-sm font-semibold text-primary">
              Equipes internas
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
              Células que recebem e entregam trabalho
            </h3>
            <p className="mt-3 max-w-xl text-[15px] leading-6 text-muted-foreground">
              Design, Copy, Mídia, Web e CRM ficam dentro do mesmo workspace.
              Cada equipe terá líderes, membros, capacidade e uma fila própria,
              sem duplicar produtos ou perder o histórico da demanda.
            </p>
            <p className="mt-4 flex items-start gap-2 text-sm leading-6">
              <CheckCircle2
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-primary"
              />
              Uma pessoa poderá fazer parte de mais de uma equipe no mesmo
              workspace quando a operação exigir.
            </p>
          </article>
        </div>
      </section>

      <section aria-labelledby="access-function-title">
        <SectionHeading
          id="access-function-title"
          icon={ShieldCheck}
          title="Acesso não é cargo"
          description="O nível de acesso controla o que a pessoa pode fazer. A função descreve o trabalho que ela executa."
        />

        <div className="mt-6 overflow-x-auto border-y">
          <table className="w-full min-w-[680px] text-left">
            <caption className="sr-only">
              Permissões previstas para criação e encaminhamento de demandas
            </caption>
            <thead className="border-b bg-muted/35 text-xs font-medium text-muted-foreground">
              <tr>
                <th scope="col" className="w-44 px-4 py-3 font-medium">
                  Nível de acesso
                </th>
                <th scope="col" className="w-36 px-4 py-3 font-medium">
                  Cria demanda
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Pode encaminhar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {WORKSPACE_ACCESS_ROLES.map((role) => {
                const policy = ACCESS_ROLE_POLICIES[role];
                return (
                  <tr key={role}>
                    <th scope="row" className="px-4 py-4 font-semibold">
                      {policy.label}
                    </th>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {policy.canCreateTask ? 'Sim' : 'Não'}
                    </td>
                    <td className="px-4 py-4 text-sm leading-6 text-muted-foreground">
                      {policy.assignmentTargets.length
                        ? policy.assignmentTargets
                            .map((target) => ASSIGNMENT_TARGET_LABEL[target])
                            .join(', ')
                        : 'Nenhum destino'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Esta tabela descreve a regra alvo. Fila da equipe e próximo
          responsável do fluxo ainda não estão ativos.
        </p>

        <div className="mt-8">
          <h3 className="text-lg font-semibold tracking-[-0.02em]">
            Funções padrão da operação
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            As funções poderão ser combinadas. Head e líder continuam sendo
            funções de trabalho, não novos níveis de acesso.
          </p>
          <ul className="mt-4 grid border-y lg:grid-cols-2">
            {STANDARD_FUNCTIONAL_ROLES.map((role, index) => (
              <li
                key={role.key}
                className={`px-4 py-4 ${index > 0 ? 'border-t' : ''} ${
                  index === 1 ? 'lg:border-t-0' : ''
                } ${index % 2 === 1 ? 'lg:border-l' : ''}`}
              >
                <p className="text-sm font-semibold">{role.label}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {role.purpose}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="current-rules-title">
        <SectionHeading
          id="current-rules-title"
          icon={LockKeyhole}
          title="Quem pode criar e atribuir hoje"
          description="Estas são as regras efetivamente protegidas pelo Supabase neste momento."
        />
        <ul className="mt-6 divide-y border-y">
          {CURRENT_TASK_RULES.map((item) => (
            <li
              key={item.role}
              className="grid gap-1 px-4 py-4 sm:grid-cols-[260px_minmax(0,1fr)] sm:gap-6"
            >
              <span className="font-semibold">{item.role}</span>
              <span className="text-sm leading-6 text-muted-foreground">
                {item.rule}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="workflow-title">
        <SectionHeading
          id="workflow-title"
          icon={Route}
          title={DEFAULT_MARKETING_WORKFLOW.label}
          description="Fluxo padrão para conectar briefing, produção, revisão, publicação e monitoramento sem perder contexto."
        />

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-y bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Clock3 aria-hidden="true" className="size-4 text-primary" />
            Aceite do handoff em até{' '}
            {OPERATING_DEFAULTS.handoffAcceptanceBusinessHours} horas úteis
          </span>
          <span className="flex items-center gap-2">
            <UsersRound aria-hidden="true" className="size-4 text-primary" />
            Limite recomendado de{' '}
            {OPERATING_DEFAULTS.softWipLimitPerContributor} entregas em
            andamento
          </span>
        </div>

        <ol className="divide-y border-b">
          {DEFAULT_MARKETING_WORKFLOW.steps.map((step, index) => {
            const owner =
              functionalRoleByKey.get(step.ownerRole) ?? step.ownerRole;
            const dependencies = step.dependsOn
              .map((key) => workflowStepByKey.get(key) ?? key)
              .join(', ');
            const alternateOwners = step.alternateOwnerRoles
              .map((key) => functionalRoleByKey.get(key) ?? key)
              .join(', ');
            return (
              <li
                key={step.key}
                className="grid gap-3 px-4 py-4 sm:grid-cols-[40px_minmax(0,1fr)_210px_100px] sm:items-center sm:gap-5"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {index + 1}
                </span>
                <div>
                  <p className="font-semibold">{step.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {dependencies
                      ? `Liberada após ${dependencies}`
                      : 'Ponto de entrada do fluxo'}
                  </p>
                  <details className="group mt-2 text-xs text-muted-foreground">
                    <summary className="w-fit cursor-pointer rounded-sm font-medium text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
                      Critérios do handoff
                    </summary>
                    <div className="mt-2 space-y-2 border-l border-primary/25 pl-3 leading-5">
                      <p>Evidências: {step.completionEvidence.join(', ')}.</p>
                      <p>
                        Substitutos:{' '}
                        {alternateOwners || 'somente a função principal'}.
                      </p>
                    </div>
                  </details>
                </div>
                <div className="text-sm">
                  <p className="font-medium">{owner}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {STEP_KIND_LABEL[step.kind]}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground sm:text-right">
                  {step.targetBusinessHours}h úteis
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="handoff-title">
        <SectionHeading
          id="handoff-title"
          icon={Send}
          title="Como uma entrega passa para a próxima pessoa"
          description="O handoff precisa transferir contexto e responsabilidade, não apenas mudar um nome no cartão."
        />
        <ol className="mt-6 grid border-y md:grid-cols-4">
          {[
            [
              'Concluir',
              'A pessoa atual anexa ou registra a evidência exigida.',
            ],
            [
              'Enviar',
              'A demanda entra na fila do próximo time definido pelo fluxo.',
            ],
            [
              'Assumir',
              'Um membro elegível aceita a etapa e passa a responder pelo prazo.',
            ],
            [
              'Revisar',
              'O revisor aprova ou devolve com motivo e nova ação clara.',
            ],
          ].map(([title, description], index) => (
            <li
              key={title}
              className={`relative px-4 py-5 ${
                index > 0 ? 'border-t md:border-l md:border-t-0' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-primary">
                  {index + 1}. {title}
                </span>
                {index < 3 ? (
                  <ArrowRight
                    aria-hidden="true"
                    className="hidden size-4 text-primary/60 md:block"
                  />
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="next-deliveries-title">
        <SectionHeading
          id="next-deliveries-title"
          icon={UserRoundCog}
          title="Próximas entregas do modelo"
          description="A implementação será liberada em partes para manter as permissões confiáveis e a interface simples."
        />
        <ol className="mt-6 divide-y border-y">
          {NEXT_DELIVERIES.map((delivery, index) => (
            <li
              key={delivery.title}
              className="grid gap-2 px-4 py-5 sm:grid-cols-[44px_230px_minmax(0,1fr)] sm:items-start sm:gap-5"
            >
              <span className="text-sm font-semibold text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="font-semibold">{delivery.title}</span>
              <span className="text-sm leading-6 text-muted-foreground">
                {delivery.description}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Até a camada de banco ser publicada, a área Pessoas continua sendo a
          fonte real para convites, acesso, capacidade e carga atribuída.
        </p>
      </section>
    </div>
  );
}

function SectionHeading({
  id,
  icon: Icon,
  title,
  description,
}: {
  id: string;
  icon: typeof Layers3;
  title: string;
  description: string;
}) {
  return (
    <div className="flex max-w-3xl items-start gap-3">
      <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
      <div>
        <h2
          id={id}
          className="text-[1.45rem] font-semibold leading-7 tracking-[-0.025em]"
        >
          {title}
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
