export const WORKSPACE_ACCESS_ROLES = [
  'owner',
  'admin',
  'manager',
  'member',
  'viewer',
] as const;

export type WorkspaceAccessRole = (typeof WORKSPACE_ACCESS_ROLES)[number];

export const TASK_ASSIGNMENT_TARGETS = [
  'self',
  'own_team_queue',
  'workflow_next_owner',
  'workspace_member',
] as const;

export type TaskAssignmentTarget = (typeof TASK_ASSIGNMENT_TARGETS)[number];

export type AccessRolePolicy = {
  label: string;
  canCreateTask: boolean;
  assignmentTargets: readonly TaskAssignmentTarget[];
  canConfirmPriority: boolean;
  canDecideAssignedGate: boolean;
  canConfigureOperatingModel: boolean;
  canManageMemberships: boolean;
};

export const ACCESS_ROLE_POLICIES = {
  owner: {
    label: 'Proprietário',
    canCreateTask: true,
    assignmentTargets: TASK_ASSIGNMENT_TARGETS,
    canConfirmPriority: true,
    canDecideAssignedGate: true,
    canConfigureOperatingModel: true,
    canManageMemberships: true,
  },
  admin: {
    label: 'Administrador',
    canCreateTask: true,
    assignmentTargets: TASK_ASSIGNMENT_TARGETS,
    canConfirmPriority: true,
    canDecideAssignedGate: true,
    canConfigureOperatingModel: true,
    canManageMemberships: true,
  },
  manager: {
    label: 'Coordenador',
    canCreateTask: true,
    assignmentTargets: TASK_ASSIGNMENT_TARGETS,
    canConfirmPriority: true,
    canDecideAssignedGate: true,
    canConfigureOperatingModel: true,
    canManageMemberships: false,
  },
  member: {
    label: 'Colaborador',
    canCreateTask: true,
    assignmentTargets: ['self', 'own_team_queue', 'workflow_next_owner'],
    canConfirmPriority: false,
    canDecideAssignedGate: true,
    canConfigureOperatingModel: false,
    canManageMemberships: false,
  },
  viewer: {
    label: 'Observador',
    canCreateTask: false,
    assignmentTargets: [],
    canConfirmPriority: false,
    canDecideAssignedGate: false,
    canConfigureOperatingModel: false,
    canManageMemberships: false,
  },
} as const satisfies Record<WorkspaceAccessRole, AccessRolePolicy>;

export const FUNCTIONAL_ROLE_KEYS = [
  'marketing_head',
  'operations_lead',
  'strategist',
  'copywriter',
  'designer',
  'motion_designer',
  'media_buyer',
  'web_designer',
  'crm_specialist',
  'content_manager',
  'data_analyst',
  'quality_reviewer',
] as const;

export type FunctionalRoleKey = (typeof FUNCTIONAL_ROLE_KEYS)[number];

export type FunctionalRoleDefinition = {
  key: FunctionalRoleKey;
  label: string;
  purpose: string;
};

export const STANDARD_FUNCTIONAL_ROLES = [
  {
    key: 'marketing_head',
    label: 'Head de Marketing ou Growth',
    purpose:
      'Define objetivos, orçamento, prioridades e decisões de alto risco.',
  },
  {
    key: 'operations_lead',
    label: 'Líder de Operação ou Campanha',
    purpose: 'Conduz triagem, sequência, prazos, capacidade e escalonamentos.',
  },
  {
    key: 'strategist',
    label: 'Estrategista',
    purpose: 'Consolida público, oferta, canais, hipótese e briefing.',
  },
  {
    key: 'copywriter',
    label: 'Copywriter',
    purpose: 'Produz mensagens, anúncios, páginas e roteiros.',
  },
  {
    key: 'designer',
    label: 'Designer',
    purpose: 'Produz peças visuais e adaptações de formato.',
  },
  {
    key: 'motion_designer',
    label: 'Motion ou Vídeo',
    purpose: 'Produz peças animadas, edição e acabamento audiovisual.',
  },
  {
    key: 'media_buyer',
    label: 'Gestor de Tráfego',
    purpose: 'Planeja mídia, configura campanhas, publica e otimiza.',
  },
  {
    key: 'web_designer',
    label: 'Web Designer ou Desenvolvedor',
    purpose: 'Entrega páginas, formulários, responsividade e publicação web.',
  },
  {
    key: 'crm_specialist',
    label: 'CRM ou Lifecycle',
    purpose: 'Opera e-mail, WhatsApp, automações e segmentação.',
  },
  {
    key: 'content_manager',
    label: 'Conteúdo ou Social',
    purpose: 'Organiza calendário editorial, publicação e comunidade.',
  },
  {
    key: 'data_analyst',
    label: 'Dados ou Analytics',
    purpose: 'Valida tracking, UTMs, eventos e leitura de performance.',
  },
  {
    key: 'quality_reviewer',
    label: 'QA ou Revisor',
    purpose: 'Confere marca, links, tracking, formatos e critérios de aceite.',
  },
] as const satisfies readonly FunctionalRoleDefinition[];

export const WORKFLOW_STEP_KEYS = [
  'intake',
  'briefing',
  'copy',
  'copy_review',
  'design',
  'web',
  'media_plan',
  'creative_review',
  'campaign_setup',
  'quality_assurance',
  'final_approval',
  'publication',
  'monitoring',
] as const;

export type WorkflowStepKey = (typeof WORKFLOW_STEP_KEYS)[number];
export type WorkflowStepKind = 'work' | 'review' | 'approval' | 'release';

export type WorkflowStepDefinition = {
  key: WorkflowStepKey;
  label: string;
  kind: WorkflowStepKind;
  ownerRole: FunctionalRoleKey;
  alternateOwnerRoles: readonly FunctionalRoleKey[];
  dependsOn: readonly WorkflowStepKey[];
  targetBusinessHours: number;
  completionEvidence: readonly string[];
};

export const DEFAULT_MARKETING_WORKFLOW = {
  key: 'paid_campaign',
  label: 'Lançamento de campanha paga',
  version: 1,
  steps: [
    {
      key: 'intake',
      label: 'Entrada e triagem',
      kind: 'work',
      ownerRole: 'operations_lead',
      alternateOwnerRoles: ['marketing_head'],
      dependsOn: [],
      targetBusinessHours: 4,
      completionEvidence: ['Objetivo', 'Solicitante', 'Contexto operacional'],
    },
    {
      key: 'briefing',
      label: 'Briefing estratégico',
      kind: 'work',
      ownerRole: 'strategist',
      alternateOwnerRoles: ['marketing_head', 'operations_lead'],
      dependsOn: ['intake'],
      targetBusinessHours: 8,
      completionEvidence: ['Público', 'Oferta', 'Canal', 'Critério de sucesso'],
    },
    {
      key: 'copy',
      label: 'Copy',
      kind: 'work',
      ownerRole: 'copywriter',
      alternateOwnerRoles: ['strategist'],
      dependsOn: ['briefing'],
      targetBusinessHours: 16,
      completionEvidence: ['Texto final', 'Variações exigidas', 'CTA'],
    },
    {
      key: 'copy_review',
      label: 'Revisão de copy',
      kind: 'review',
      ownerRole: 'operations_lead',
      alternateOwnerRoles: ['marketing_head', 'strategist'],
      dependsOn: ['copy'],
      targetBusinessHours: 4,
      completionEvidence: ['Decisão', 'Feedback quando houver ajuste'],
    },
    {
      key: 'design',
      label: 'Produção de design',
      kind: 'work',
      ownerRole: 'designer',
      alternateOwnerRoles: ['motion_designer'],
      dependsOn: ['copy_review'],
      targetBusinessHours: 16,
      completionEvidence: ['Arquivos finais', 'Formatos previstos'],
    },
    {
      key: 'web',
      label: 'Produção web',
      kind: 'work',
      ownerRole: 'web_designer',
      alternateOwnerRoles: [],
      dependsOn: ['copy_review'],
      targetBusinessHours: 32,
      completionEvidence: ['URL de homologação', 'Formulário validado'],
    },
    {
      key: 'media_plan',
      label: 'Plano de mídia',
      kind: 'work',
      ownerRole: 'media_buyer',
      alternateOwnerRoles: ['marketing_head'],
      dependsOn: ['briefing'],
      targetBusinessHours: 8,
      completionEvidence: ['Canais', 'Orçamento', 'Segmentação', 'Métricas'],
    },
    {
      key: 'creative_review',
      label: 'Revisão criativa',
      kind: 'review',
      ownerRole: 'quality_reviewer',
      alternateOwnerRoles: ['marketing_head', 'operations_lead'],
      dependsOn: ['design'],
      targetBusinessHours: 4,
      completionEvidence: ['Decisão', 'Checklist de marca e formatos'],
    },
    {
      key: 'campaign_setup',
      label: 'Configuração de campanha',
      kind: 'work',
      ownerRole: 'media_buyer',
      alternateOwnerRoles: [],
      dependsOn: ['creative_review', 'web', 'media_plan'],
      targetBusinessHours: 8,
      completionEvidence: ['Campanha configurada', 'Orçamento conferido'],
    },
    {
      key: 'quality_assurance',
      label: 'QA de publicação',
      kind: 'review',
      ownerRole: 'quality_reviewer',
      alternateOwnerRoles: ['data_analyst', 'operations_lead'],
      dependsOn: ['campaign_setup'],
      targetBusinessHours: 4,
      completionEvidence: ['Links', 'UTMs', 'Eventos', 'Formatos', 'Orçamento'],
    },
    {
      key: 'final_approval',
      label: 'Aprovação final',
      kind: 'approval',
      ownerRole: 'marketing_head',
      alternateOwnerRoles: ['operations_lead'],
      dependsOn: ['quality_assurance'],
      targetBusinessHours: 4,
      completionEvidence: ['Decisão', 'Motivo obrigatório em caso de recusa'],
    },
    {
      key: 'publication',
      label: 'Publicação',
      kind: 'release',
      ownerRole: 'media_buyer',
      alternateOwnerRoles: ['operations_lead'],
      dependsOn: ['final_approval'],
      targetBusinessHours: 4,
      completionEvidence: [
        'URL ou identificador publicado',
        'Horário da publicação',
      ],
    },
    {
      key: 'monitoring',
      label: 'Monitoramento inicial',
      kind: 'work',
      ownerRole: 'media_buyer',
      alternateOwnerRoles: ['data_analyst'],
      dependsOn: ['publication'],
      targetBusinessHours: 8,
      completionEvidence: ['Saúde inicial', 'Anomalias', 'Próxima ação'],
    },
  ],
} as const satisfies {
  key: string;
  label: string;
  version: number;
  steps: readonly WorkflowStepDefinition[];
};

export const OPERATING_DEFAULTS = {
  softWipLimitPerContributor: 2,
  riskWarningPercent: 75,
  handoffAcceptanceBusinessHours: 4,
  simpleReviewBusinessHours: 4,
  simpleRevisionBusinessHours: 8,
} as const;

export const BLOCKER_REASONS = [
  'awaiting_information',
  'awaiting_approval',
  'missing_asset',
  'technical_dependency',
  'team_capacity',
  'external_party',
  'scope_change',
] as const;

export type BlockerReason = (typeof BLOCKER_REASONS)[number];

export const STANDARD_WORKFLOW_TEMPLATE_KEYS = [
  'paid_campaign',
  'static_creative',
  'motion_video',
  'landing_page',
  'crm_sequence',
  'organic_publication',
] as const;

export function canCreateTask(role: WorkspaceAccessRole) {
  return ACCESS_ROLE_POLICIES[role].canCreateTask;
}

export function canAssignTaskTo(
  role: WorkspaceAccessRole,
  target: TaskAssignmentTarget,
) {
  const allowedTargets = ACCESS_ROLE_POLICIES[role]
    .assignmentTargets as readonly TaskAssignmentTarget[];

  return allowedTargets.includes(target);
}

export function getDependencySatisfiedWorkflowSteps(
  completedStepKeys: readonly WorkflowStepKey[],
) {
  const completed = new Set(completedStepKeys);

  return DEFAULT_MARKETING_WORKFLOW.steps.filter(
    (step) =>
      !completed.has(step.key) &&
      step.dependsOn.every((dependency) => completed.has(dependency)),
  );
}
