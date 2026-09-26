-- Team operating model and minimum production-line foundations.
-- This migration is intentionally additive so existing task RPC signatures remain valid.

begin;

create type public.team_member_role as enum ('lead', 'member');
create type public.task_approval_decision as enum (
  'pending',
  'approved',
  'changes_requested',
  'rejected',
  'cancelled'
);
create type public.task_handoff_status as enum (
  'pending',
  'accepted',
  'declined',
  'cancelled'
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  color text not null default 'blue',
  is_default boolean not null default false,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid,
  version integer not null default 1,
  unique (workspace_id, id),
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, archived_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint teams_name_length check (char_length(btrim(name)) between 2 and 100),
  constraint teams_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint teams_description_length check (
    description is null or char_length(description) <= 1000
  ),
  constraint teams_color_format check (color ~ '^[a-z][a-z0-9-]{1,31}$'),
  constraint teams_archive_consistent check (
    (archived_at is null and archived_by is null)
    or (archived_at is not null and archived_by is not null)
  ),
  constraint teams_version_positive check (version > 0)
);

create unique index teams_active_slug_unique
  on public.teams (workspace_id, lower(slug))
  where archived_at is null;
create unique index teams_one_active_default
  on public.teams (workspace_id)
  where is_default and archived_at is null;
create index teams_workspace_active_position
  on public.teams (workspace_id, lower(name), id)
  where archived_at is null;

create table public.team_members (
  workspace_id uuid not null,
  team_id uuid not null,
  user_id uuid not null,
  role public.team_member_role not null default 'member',
  is_primary boolean not null default false,
  added_by uuid not null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid,
  version integer not null default 1,
  primary key (workspace_id, team_id, user_id),
  foreign key (workspace_id, team_id)
    references public.teams(workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, added_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, removed_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint team_members_removal_consistent check (
    (removed_at is null and removed_by is null)
    or (removed_at is not null and removed_by is not null and not is_primary)
  ),
  constraint team_members_version_positive check (version > 0)
);

create unique index team_members_one_active_primary
  on public.team_members (workspace_id, user_id)
  where is_primary and removed_at is null;
create index team_members_team_active
  on public.team_members (workspace_id, team_id, role, joined_at)
  where removed_at is null;
create index team_members_user_active
  on public.team_members (workspace_id, user_id, team_id)
  where removed_at is null;

create table public.job_functions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  system_key text,
  name text not null,
  category text not null,
  description text,
  position integer not null default 0,
  is_system boolean not null default false,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid,
  version integer not null default 1,
  unique (workspace_id, id),
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, archived_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint job_functions_system_key_format check (
    system_key is null or system_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
  ),
  constraint job_functions_system_consistent check (
    (is_system and system_key is not null) or (not is_system and system_key is null)
  ),
  constraint job_functions_name_length check (char_length(btrim(name)) between 2 and 100),
  constraint job_functions_category_length check (
    char_length(btrim(category)) between 2 and 80
  ),
  constraint job_functions_description_length check (
    description is null or char_length(description) <= 1000
  ),
  constraint job_functions_position_valid check (position >= 0),
  constraint job_functions_archive_consistent check (
    (archived_at is null and archived_by is null)
    or (archived_at is not null and archived_by is not null)
  ),
  constraint job_functions_version_positive check (version > 0)
);

create unique index job_functions_active_name_unique
  on public.job_functions (workspace_id, lower(name))
  where archived_at is null;
create unique index job_functions_system_key_unique
  on public.job_functions (workspace_id, system_key)
  where system_key is not null;
create index job_functions_workspace_active
  on public.job_functions (workspace_id, position, lower(name), id)
  where archived_at is null;

create table public.team_member_functions (
  workspace_id uuid not null,
  team_id uuid not null,
  user_id uuid not null,
  job_function_id uuid not null,
  is_primary boolean not null default false,
  assigned_by uuid not null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid,
  version integer not null default 1,
  primary key (workspace_id, team_id, user_id, job_function_id),
  foreign key (workspace_id, team_id, user_id)
    references public.team_members(workspace_id, team_id, user_id) on delete cascade,
  foreign key (workspace_id, job_function_id)
    references public.job_functions(workspace_id, id) on delete restrict,
  foreign key (workspace_id, assigned_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, archived_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint team_member_functions_archive_consistent check (
    (archived_at is null and archived_by is null)
    or (archived_at is not null and archived_by is not null and not is_primary)
  ),
  constraint team_member_functions_version_positive check (version > 0)
);

create unique index team_member_functions_one_active_primary
  on public.team_member_functions (workspace_id, team_id, user_id)
  where is_primary and archived_at is null;
create index team_member_functions_function_active
  on public.team_member_functions (workspace_id, job_function_id, team_id, user_id)
  where archived_at is null;

alter table public.tasks
  add column team_id uuid,
  add column requester_id uuid;

alter table public.tasks
  add constraint tasks_team_workspace_fk
    foreign key (workspace_id, team_id)
    references public.teams(workspace_id, id) on delete restrict,
  add constraint tasks_requester_workspace_fk
    foreign key (workspace_id, requester_id)
    references public.workspace_members(workspace_id, user_id) on delete restrict;

create index tasks_workspace_team_active
  on public.tasks (workspace_id, team_id, updated_at desc)
  where archived_at is null;
create index tasks_workspace_requester_active
  on public.tasks (workspace_id, requester_id, created_at desc)
  where archived_at is null;

create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  blocking_task_id uuid not null,
  blocked_task_id uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid,
  version integer not null default 1,
  unique (workspace_id, id),
  unique (workspace_id, blocking_task_id, blocked_task_id),
  foreign key (workspace_id, blocking_task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, blocked_task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, archived_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint task_dependencies_distinct_tasks check (blocking_task_id <> blocked_task_id),
  constraint task_dependencies_archive_consistent check (
    (archived_at is null and archived_by is null)
    or (archived_at is not null and archived_by is not null)
  ),
  constraint task_dependencies_version_positive check (version > 0)
);

create index task_dependencies_blocking_active
  on public.task_dependencies (workspace_id, blocking_task_id, blocked_task_id)
  where archived_at is null;
create index task_dependencies_blocked_active
  on public.task_dependencies (workspace_id, blocked_task_id, blocking_task_id)
  where archived_at is null;

create table public.task_approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null,
  approval_round integer not null,
  task_version integer not null,
  requested_by uuid not null,
  approver_id uuid not null,
  decision public.task_approval_decision not null default 'pending',
  decision_comment text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (workspace_id, id),
  unique (workspace_id, task_id, approval_round, approver_id),
  foreign key (workspace_id, task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, requested_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, approver_id)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, decided_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint task_approvals_round_positive check (approval_round > 0),
  constraint task_approvals_task_version_positive check (task_version > 0),
  constraint task_approvals_distinct_participants check (requested_by <> approver_id),
  constraint task_approvals_comment_length check (
    decision_comment is null or char_length(decision_comment) <= 4000
  ),
  constraint task_approvals_decision_consistent check (
    (
      decision = 'pending'::public.task_approval_decision
      and decided_at is null
      and decided_by is null
    ) or (
      decision <> 'pending'::public.task_approval_decision
      and decided_at is not null
      and decided_by is not null
    )
  ),
  constraint task_approvals_version_positive check (version > 0)
);

create unique index task_approval_requests_one_pending_per_approver
  on public.task_approval_requests (workspace_id, task_id, approver_id)
  where decision = 'pending'::public.task_approval_decision;
create index task_approval_requests_task_round
  on public.task_approval_requests (workspace_id, task_id, approval_round desc, requested_at desc);
create index task_approval_requests_approver_pending
  on public.task_approval_requests (workspace_id, approver_id, requested_at)
  where decision = 'pending'::public.task_approval_decision;

create table public.task_handoffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_task_id uuid not null,
  target_task_id uuid not null,
  from_team_id uuid not null,
  to_team_id uuid not null,
  target_assignee_id uuid,
  status public.task_handoff_status not null default 'pending',
  note text,
  initiated_by uuid not null,
  initiated_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (workspace_id, id),
  foreign key (workspace_id, source_task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, target_task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, from_team_id)
    references public.teams(workspace_id, id) on delete restrict,
  foreign key (workspace_id, to_team_id)
    references public.teams(workspace_id, id) on delete restrict,
  foreign key (workspace_id, target_assignee_id)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, initiated_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, resolved_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint task_handoffs_distinct_tasks check (source_task_id <> target_task_id),
  constraint task_handoffs_distinct_teams check (from_team_id <> to_team_id),
  constraint task_handoffs_note_length check (note is null or char_length(note) <= 4000),
  constraint task_handoffs_resolution_consistent check (
    (
      status = 'pending'::public.task_handoff_status
      and resolved_at is null
      and resolved_by is null
    ) or (
      status <> 'pending'::public.task_handoff_status
      and resolved_at is not null
      and resolved_by is not null
    )
  ),
  constraint task_handoffs_version_positive check (version > 0)
);

create unique index task_handoffs_one_pending_pair
  on public.task_handoffs (workspace_id, source_task_id, target_task_id)
  where status = 'pending'::public.task_handoff_status;
create index task_handoffs_source_timeline
  on public.task_handoffs (workspace_id, source_task_id, initiated_at desc);
create index task_handoffs_target_pending
  on public.task_handoffs (workspace_id, to_team_id, initiated_at)
  where status = 'pending'::public.task_handoff_status;

-- Backfill one default team and the standard professional function catalogue.
insert into public.teams (
  workspace_id,
  name,
  slug,
  description,
  color,
  is_default,
  created_by
)
select
  workspace.id,
  'Operação',
  'operacao',
  'Equipe principal do workspace.',
  'blue',
  true,
  seed_member.user_id
from public.workspaces workspace
join lateral (
  select member.user_id
  from public.workspace_members member
  where member.workspace_id = workspace.id
  order by
    case
      when member.role = 'owner'::public.workspace_role
        and member.status = 'active'::public.membership_status
        and member.removed_at is null then 0
      when member.status = 'active'::public.membership_status
        and member.removed_at is null then 1
      else 2
    end,
    member.joined_at,
    member.user_id
  limit 1
) seed_member on true
where not exists (
  select 1
  from public.teams team
  where team.workspace_id = workspace.id
    and team.is_default
    and team.archived_at is null
);

with standard_function(system_key, name, category, description, position) as (
  values
    ('marketing_head', 'Head de Marketing ou Growth', 'Liderança e estratégia', 'Define objetivos, orçamento, prioridades e decisões de alto risco.', 10),
    ('operations_lead', 'Líder de Operação ou Campanha', 'Liderança e estratégia', 'Conduz triagem, sequência, prazos, capacidade e escalonamentos.', 20),
    ('strategist', 'Estrategista', 'Liderança e estratégia', 'Consolida público, oferta, canais, hipótese e briefing.', 30),
    ('copywriter', 'Copywriter', 'Conteúdo e criação', 'Produz mensagens, anúncios, páginas e roteiros.', 100),
    ('designer', 'Designer', 'Conteúdo e criação', 'Produz peças visuais e adaptações de formato.', 110),
    ('motion_designer', 'Motion ou Vídeo', 'Conteúdo e criação', 'Produz peças animadas, edição e acabamento audiovisual.', 120),
    ('media_buyer', 'Gestor de Tráfego', 'Aquisição e conversão', 'Planeja mídia, configura campanhas, publica e otimiza.', 200),
    ('web_designer', 'Web Designer ou Desenvolvedor', 'Web, automação e dados', 'Entrega páginas, formulários, responsividade e publicação web.', 300),
    ('crm_specialist', 'CRM ou Lifecycle', 'Web, automação e dados', 'Opera e-mail, WhatsApp, automações e segmentação.', 310),
    ('content_manager', 'Conteúdo ou Social', 'Conteúdo e criação', 'Organiza calendário editorial, publicação e comunidade.', 130),
    ('data_analyst', 'Dados ou Analytics', 'Web, automação e dados', 'Valida tracking, UTMs, eventos e leitura de performance.', 320),
    ('quality_reviewer', 'QA ou Revisor', 'Qualidade e aprovação', 'Confere marca, links, tracking, formatos e critérios de aceite.', 400)
)
insert into public.job_functions (
  workspace_id,
  system_key,
  name,
  category,
  description,
  position,
  is_system,
  created_by
)
select
  workspace.id,
  standard_function.system_key,
  standard_function.name,
  standard_function.category,
  standard_function.description,
  standard_function.position,
  true,
  seed_member.user_id
from public.workspaces workspace
join lateral (
  select member.user_id
  from public.workspace_members member
  where member.workspace_id = workspace.id
  order by
    case
      when member.role = 'owner'::public.workspace_role
        and member.status = 'active'::public.membership_status
        and member.removed_at is null then 0
      when member.status = 'active'::public.membership_status
        and member.removed_at is null then 1
      else 2
    end,
    member.joined_at,
    member.user_id
  limit 1
) seed_member on true
cross join standard_function
on conflict do nothing;

insert into public.team_members (
  workspace_id,
  team_id,
  user_id,
  role,
  is_primary,
  added_by,
  joined_at
)
select
  member.workspace_id,
  team.id,
  member.user_id,
  case
    when member.role in ('owner'::public.workspace_role, 'admin'::public.workspace_role)
      then 'lead'::public.team_member_role
    else 'member'::public.team_member_role
  end,
  true,
  seed_member.user_id,
  member.joined_at
from public.workspace_members member
join public.teams team
  on team.workspace_id = member.workspace_id
  and team.is_default
  and team.archived_at is null
join lateral (
  select seed.user_id
  from public.workspace_members seed
  where seed.workspace_id = member.workspace_id
  order by
    case
      when seed.role = 'owner'::public.workspace_role
        and seed.status = 'active'::public.membership_status
        and seed.removed_at is null then 0
      when seed.status = 'active'::public.membership_status
        and seed.removed_at is null then 1
      else 2
    end,
    seed.joined_at,
    seed.user_id
  limit 1
) seed_member on true
join public.profiles profile
  on profile.id = member.user_id
  and profile.is_active
where member.status = 'active'::public.membership_status
  and member.removed_at is null
on conflict do nothing;

update public.tasks task
set
  team_id = team.id,
  requester_id = task.created_by
from public.teams team
where team.workspace_id = task.workspace_id
  and team.is_default
  and team.archived_at is null
  and (task.team_id is null or task.requester_id is null);

alter table public.tasks
  alter column team_id set not null,
  alter column requester_id set not null;

create or replace function private.teams_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.workspace_id is distinct from old.workspace_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.is_default is distinct from old.is_default then
    raise exception using errcode = '22023', message = 'PTA_TEAM_IDENTITY_IMMUTABLE';
  end if;

  new.name := btrim(new.name);
  new.slug := lower(btrim(new.slug));
  new.description := nullif(btrim(new.description), '');
  new.color := lower(btrim(new.color));
  new.updated_at := statement_timestamp();
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger teams_before_update
  before update on public.teams
  for each row execute function private.teams_before_update();

create or replace function private.team_members_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.team_id is distinct from old.team_id
     or new.user_id is distinct from old.user_id
     or new.added_by is distinct from old.added_by
     or new.joined_at is distinct from old.joined_at then
    raise exception using errcode = '22023', message = 'PTA_TEAM_MEMBERSHIP_IDENTITY_IMMUTABLE';
  end if;

  new.updated_at := statement_timestamp();
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger team_members_before_update
  before update on public.team_members
  for each row execute function private.team_members_before_update();

create or replace function private.job_functions_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.workspace_id is distinct from old.workspace_id
     or new.system_key is distinct from old.system_key
     or new.is_system is distinct from old.is_system
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '22023', message = 'PTA_JOB_FUNCTION_IDENTITY_IMMUTABLE';
  end if;

  new.name := btrim(new.name);
  new.category := btrim(new.category);
  new.description := nullif(btrim(new.description), '');
  new.updated_at := statement_timestamp();
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger job_functions_before_update
  before update on public.job_functions
  for each row execute function private.job_functions_before_update();

create or replace function private.team_member_functions_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.team_id is distinct from old.team_id
     or new.user_id is distinct from old.user_id
     or new.job_function_id is distinct from old.job_function_id
     or new.assigned_by is distinct from old.assigned_by
     or new.assigned_at is distinct from old.assigned_at then
    raise exception using errcode = '22023', message = 'PTA_MEMBER_FUNCTION_IDENTITY_IMMUTABLE';
  end if;

  new.updated_at := statement_timestamp();
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger team_member_functions_before_update
  before update on public.team_member_functions
  for each row execute function private.team_member_functions_before_update();

create or replace function private.task_dependencies_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle boolean;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.workspace_id is distinct from old.workspace_id
       or new.blocking_task_id is distinct from old.blocking_task_id
       or new.blocked_task_id is distinct from old.blocked_task_id
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception using errcode = '22023', message = 'PTA_TASK_DEPENDENCY_IDENTITY_IMMUTABLE';
    end if;
    new.updated_at := statement_timestamp();
    new.version := old.version + 1;
  end if;

  -- Serialize the graph read and write per workspace. Without this lock, two
  -- concurrent transactions could both miss the opposite edge and commit a
  -- cycle such as A -> B and B -> A.
  perform pg_advisory_xact_lock(
    hashtextextended('pta:task-dependencies:' || new.workspace_id::text, 0)
  );

  if new.archived_at is null then
    if exists (
      select 1
      from public.tasks task
      where task.workspace_id = new.workspace_id
        and task.id in (new.blocking_task_id, new.blocked_task_id)
        and task.archived_at is not null
    ) then
      raise exception using errcode = '23514', message = 'PTA_DEPENDENCY_TASK_ARCHIVED';
    end if;

    with recursive downstream(task_id) as (
      select dependency.blocked_task_id
      from public.task_dependencies dependency
      where dependency.workspace_id = new.workspace_id
        and dependency.blocking_task_id = new.blocked_task_id
        and dependency.archived_at is null
        and dependency.id <> new.id
      union
      select dependency.blocked_task_id
      from public.task_dependencies dependency
      join downstream path on path.task_id = dependency.blocking_task_id
      where dependency.workspace_id = new.workspace_id
        and dependency.archived_at is null
        and dependency.id <> new.id
    )
    select exists (
      select 1 from downstream where task_id = new.blocking_task_id
    ) into v_cycle;

    if v_cycle then
      raise exception using errcode = '23514', message = 'PTA_TASK_DEPENDENCY_CYCLE';
    end if;
  end if;

  return new;
end;
$$;

create trigger task_dependencies_before_write
  before insert or update on public.task_dependencies
  for each row execute function private.task_dependencies_before_write();

create or replace function private.task_approval_requests_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_task_version integer;
begin
  if tg_op = 'UPDATE' then
    if old.decision <> 'pending'::public.task_approval_decision then
      raise exception using errcode = '23514', message = 'PTA_APPROVAL_TERMINAL_IMMUTABLE';
    end if;

    if new.id is distinct from old.id
       or new.workspace_id is distinct from old.workspace_id
       or new.task_id is distinct from old.task_id
       or new.approval_round is distinct from old.approval_round
       or new.task_version is distinct from old.task_version
       or new.requested_by is distinct from old.requested_by
       or new.approver_id is distinct from old.approver_id
       or new.requested_at is distinct from old.requested_at then
      raise exception using errcode = '22023', message = 'PTA_APPROVAL_IDENTITY_IMMUTABLE';
    end if;
    new.updated_at := statement_timestamp();
    new.version := old.version + 1;

    if new.decision <> 'pending'::public.task_approval_decision then
      select task.version
      into v_current_task_version
      from public.tasks task
      where task.workspace_id = old.workspace_id
        and task.id = old.task_id
        and task.archived_at is null
      for update;

      if v_current_task_version is null then
        raise exception using errcode = '23514', message = 'PTA_APPROVAL_TASK_NOT_ACTIVE';
      end if;
      if old.task_version <> v_current_task_version then
        raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
      end if;
    end if;
  else
    if new.decision <> 'pending'::public.task_approval_decision then
      raise exception using errcode = '23514', message = 'PTA_APPROVAL_INSERT_MUST_BE_PENDING';
    end if;

    select task.version
    into v_current_task_version
    from public.tasks task
    where task.workspace_id = new.workspace_id
      and task.id = new.task_id
      and task.archived_at is null
    for update;

    if v_current_task_version is null then
      raise exception using errcode = '23514', message = 'PTA_APPROVAL_TASK_NOT_ACTIVE';
    end if;
    if new.task_version <> v_current_task_version then
      raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
    end if;
    if not exists (
      select 1
      from public.workspace_members member
      join public.profiles profile on profile.id = member.user_id and profile.is_active
      where member.workspace_id = new.workspace_id
        and member.user_id = new.approver_id
        and member.status = 'active'::public.membership_status
        and member.removed_at is null
        and member.role <> 'viewer'::public.workspace_role
    ) then
      raise exception using errcode = '23514', message = 'PTA_APPROVER_NOT_ACTIVE_MEMBER';
    end if;
  end if;

  if new.decision <> 'pending'::public.task_approval_decision
     and new.decided_by <> new.approver_id
     and new.decision <> 'cancelled'::public.task_approval_decision then
    raise exception using errcode = '42501', message = 'PTA_APPROVAL_DECIDER_MISMATCH';
  end if;

  return new;
end;
$$;

create trigger task_approval_requests_before_write
  before insert or update on public.task_approval_requests
  for each row execute function private.task_approval_requests_before_write();

create or replace function private.task_handoffs_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_team_id uuid;
  v_target_team_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.workspace_id is distinct from old.workspace_id
       or new.source_task_id is distinct from old.source_task_id
       or new.target_task_id is distinct from old.target_task_id
       or new.from_team_id is distinct from old.from_team_id
       or new.to_team_id is distinct from old.to_team_id
       or new.initiated_by is distinct from old.initiated_by
       or new.initiated_at is distinct from old.initiated_at then
      raise exception using errcode = '22023', message = 'PTA_HANDOFF_IDENTITY_IMMUTABLE';
    end if;
    new.updated_at := statement_timestamp();
    new.version := old.version + 1;
  end if;

  select task.team_id
  into v_source_team_id
  from public.tasks task
  where task.workspace_id = new.workspace_id
    and task.id = new.source_task_id
    and task.archived_at is null;

  select task.team_id
  into v_target_team_id
  from public.tasks task
  where task.workspace_id = new.workspace_id
    and task.id = new.target_task_id
    and task.archived_at is null;

  if v_source_team_id is null or v_target_team_id is null then
    raise exception using errcode = '23514', message = 'PTA_HANDOFF_TASK_NOT_ACTIVE';
  end if;
  if v_source_team_id <> new.from_team_id or v_target_team_id <> new.to_team_id then
    raise exception using errcode = '23514', message = 'PTA_HANDOFF_TEAM_MISMATCH';
  end if;

  if new.target_assignee_id is not null and not exists (
    select 1
    from public.team_members member
    join public.workspace_members workspace_member
      on workspace_member.workspace_id = member.workspace_id
      and workspace_member.user_id = member.user_id
      and workspace_member.status = 'active'::public.membership_status
      and workspace_member.removed_at is null
    where member.workspace_id = new.workspace_id
      and member.team_id = new.to_team_id
      and member.user_id = new.target_assignee_id
      and member.removed_at is null
  ) then
    raise exception using errcode = '23514', message = 'PTA_HANDOFF_ASSIGNEE_NOT_IN_TEAM';
  end if;

  return new;
end;
$$;

create trigger task_handoffs_before_write
  before insert or update on public.task_handoffs
  for each row execute function private.task_handoffs_before_write();

-- Existing task RPCs omit the new fields. This guard provides compatible defaults.
create or replace function private.tasks_operating_model_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.team_id is null then
      select team.id
      into new.team_id
      from public.teams team
      where team.workspace_id = new.workspace_id
        and team.is_default
        and team.archived_at is null
      order by team.created_at, team.id
      limit 1;
    end if;
    new.requester_id := coalesce(new.requester_id, new.created_by, auth.uid());
  end if;

  if tg_op = 'INSERT'
     or new.team_id is distinct from old.team_id then
    if not exists (
      select 1
      from public.teams team
      where team.workspace_id = new.workspace_id
        and team.id = new.team_id
        and team.archived_at is null
    ) then
      raise exception using errcode = '23514', message = 'PTA_TASK_TEAM_NOT_ACTIVE';
    end if;

    if tg_op = 'UPDATE' and exists (
      select 1
      from public.task_assignees assignee
      where assignee.workspace_id = new.workspace_id
        and assignee.task_id = new.id
        and not exists (
          select 1
          from public.team_members team_member
          where team_member.workspace_id = new.workspace_id
            and team_member.team_id = new.team_id
            and team_member.user_id = assignee.user_id
            and team_member.removed_at is null
        )
    ) then
      raise exception using errcode = '23514', message = 'PTA_TASK_ASSIGNEE_TEAM_MISMATCH';
    end if;
  end if;

  if tg_op = 'INSERT'
     or new.requester_id is distinct from old.requester_id then
    if not exists (
      select 1
      from public.workspace_members member
      join public.profiles profile on profile.id = member.user_id and profile.is_active
      where member.workspace_id = new.workspace_id
        and member.user_id = new.requester_id
        and member.status = 'active'::public.membership_status
        and member.removed_at is null
    ) then
      raise exception using errcode = '23514', message = 'PTA_TASK_REQUESTER_NOT_ACTIVE';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger names sort alphabetically, so this runs after the existing tasks_before_write trigger.
create trigger zz_tasks_operating_model_guard
  before insert or update on public.tasks
  for each row execute function private.tasks_operating_model_guard();

create or replace function private.task_assignees_team_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  select task.team_id
  into v_team_id
  from public.tasks task
  where task.workspace_id = new.workspace_id
    and task.id = new.task_id
    and task.archived_at is null;

  if v_team_id is null or not exists (
    select 1
    from public.team_members team_member
    join public.workspace_members workspace_member
      on workspace_member.workspace_id = team_member.workspace_id
      and workspace_member.user_id = team_member.user_id
      and workspace_member.status = 'active'::public.membership_status
      and workspace_member.removed_at is null
    where team_member.workspace_id = new.workspace_id
      and team_member.team_id = v_team_id
      and team_member.user_id = new.user_id
      and team_member.removed_at is null
  ) then
    raise exception using errcode = '23514', message = 'PTA_ASSIGNEE_NOT_IN_TASK_TEAM';
  end if;

  return new;
end;
$$;

create trigger zz_task_assignees_team_guard
  before insert or update on public.task_assignees
  for each row execute function private.task_assignees_team_guard();

-- New or reactivated workspace members always receive the default team.
create or replace function private.ensure_workspace_operating_model()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_default_team_id uuid;
begin
  if new.status <> 'active'::public.membership_status
     or new.removed_at is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:operating-model:' || new.workspace_id::text, 0)
  );

  -- A workspace viewer may remain associated with a team for visibility, but
  -- must never retain a stale operational lead role after a role downgrade.
  if new.role = 'viewer'::public.workspace_role then
    update public.team_members team_member
    set role = 'member'::public.team_member_role
    where team_member.workspace_id = new.workspace_id
      and team_member.user_id = new.user_id
      and team_member.role = 'lead'::public.team_member_role
      and team_member.removed_at is null;
  end if;

  select team.id
  into v_default_team_id
  from public.teams team
  where team.workspace_id = new.workspace_id
    and team.is_default
    and team.archived_at is null
  order by team.created_at, team.id
  limit 1;

  if v_default_team_id is null then
    insert into public.teams (
      workspace_id,
      name,
      slug,
      description,
      color,
      is_default,
      created_by
    ) values (
      new.workspace_id,
      'Operação',
      'operacao',
      'Equipe principal do workspace.',
      'blue',
      true,
      new.user_id
    )
    returning id into v_default_team_id;
  end if;

  insert into public.team_members (
    workspace_id,
    team_id,
    user_id,
    role,
    is_primary,
    added_by,
    joined_at
  ) values (
    new.workspace_id,
    v_default_team_id,
    new.user_id,
    case
      when new.role in ('owner'::public.workspace_role, 'admin'::public.workspace_role)
        then 'lead'::public.team_member_role
      else 'member'::public.team_member_role
    end,
    not exists (
      select 1
      from public.team_members existing
      where existing.workspace_id = new.workspace_id
        and existing.user_id = new.user_id
        and existing.removed_at is null
    ),
    new.user_id,
    new.joined_at
  )
  on conflict (workspace_id, team_id, user_id) do update
  set
    removed_at = null,
    removed_by = null,
    is_primary = case
      when exists (
        select 1
        from public.team_members existing
        where existing.workspace_id = excluded.workspace_id
          and existing.user_id = excluded.user_id
          and existing.team_id <> excluded.team_id
          and existing.is_primary
          and existing.removed_at is null
      ) then team_members.is_primary
      else true
    end;

  with standard_function(system_key, name, category, description, position) as (
    values
      ('marketing_head', 'Head de Marketing ou Growth', 'Liderança e estratégia', 'Define objetivos, orçamento, prioridades e decisões de alto risco.', 10),
      ('operations_lead', 'Líder de Operação ou Campanha', 'Liderança e estratégia', 'Conduz triagem, sequência, prazos, capacidade e escalonamentos.', 20),
      ('strategist', 'Estrategista', 'Liderança e estratégia', 'Consolida público, oferta, canais, hipótese e briefing.', 30),
      ('copywriter', 'Copywriter', 'Conteúdo e criação', 'Produz mensagens, anúncios, páginas e roteiros.', 100),
      ('designer', 'Designer', 'Conteúdo e criação', 'Produz peças visuais e adaptações de formato.', 110),
      ('motion_designer', 'Motion ou Vídeo', 'Conteúdo e criação', 'Produz peças animadas, edição e acabamento audiovisual.', 120),
      ('media_buyer', 'Gestor de Tráfego', 'Aquisição e conversão', 'Planeja mídia, configura campanhas, publica e otimiza.', 200),
      ('web_designer', 'Web Designer ou Desenvolvedor', 'Web, automação e dados', 'Entrega páginas, formulários, responsividade e publicação web.', 300),
      ('crm_specialist', 'CRM ou Lifecycle', 'Web, automação e dados', 'Opera e-mail, WhatsApp, automações e segmentação.', 310),
      ('content_manager', 'Conteúdo ou Social', 'Conteúdo e criação', 'Organiza calendário editorial, publicação e comunidade.', 130),
      ('data_analyst', 'Dados ou Analytics', 'Web, automação e dados', 'Valida tracking, UTMs, eventos e leitura de performance.', 320),
      ('quality_reviewer', 'QA ou Revisor', 'Qualidade e aprovação', 'Confere marca, links, tracking, formatos e critérios de aceite.', 400)
  )
  insert into public.job_functions (
    workspace_id,
    system_key,
    name,
    category,
    description,
    position,
    is_system,
    created_by
  )
  select
    new.workspace_id,
    standard_function.system_key,
    standard_function.name,
    standard_function.category,
    standard_function.description,
    standard_function.position,
    true,
    new.user_id
  from standard_function
  on conflict do nothing;

  return new;
end;
$$;

create trigger workspace_members_ensure_operating_model
  after insert or update of role, status, removed_at on public.workspace_members
  for each row execute function private.ensure_workspace_operating_model();

alter function private.teams_before_update() owner to postgres;
alter function private.team_members_before_update() owner to postgres;
alter function private.job_functions_before_update() owner to postgres;
alter function private.team_member_functions_before_update() owner to postgres;
alter function private.task_dependencies_before_write() owner to postgres;
alter function private.task_approval_requests_before_write() owner to postgres;
alter function private.task_handoffs_before_write() owner to postgres;
alter function private.tasks_operating_model_guard() owner to postgres;
alter function private.task_assignees_team_guard() owner to postgres;
alter function private.ensure_workspace_operating_model() owner to postgres;

revoke all on function private.teams_before_update() from public, anon, authenticated;
revoke all on function private.team_members_before_update() from public, anon, authenticated;
revoke all on function private.job_functions_before_update() from public, anon, authenticated;
revoke all on function private.team_member_functions_before_update() from public, anon, authenticated;
revoke all on function private.task_dependencies_before_write() from public, anon, authenticated;
revoke all on function private.task_approval_requests_before_write() from public, anon, authenticated;
revoke all on function private.task_handoffs_before_write() from public, anon, authenticated;
revoke all on function private.tasks_operating_model_guard() from public, anon, authenticated;
revoke all on function private.task_assignees_team_guard() from public, anon, authenticated;
revoke all on function private.ensure_workspace_operating_model() from public, anon, authenticated;

create or replace function private.current_team_role(
  p_team_id uuid,
  p_user_id uuid default null
)
returns public.team_member_role
language sql
stable
security definer
set search_path = ''
as $$
  select team_member.role
  from public.team_members team_member
  join public.teams team
    on team.workspace_id = team_member.workspace_id
    and team.id = team_member.team_id
    and team.archived_at is null
  join public.workspace_members workspace_member
    on workspace_member.workspace_id = team_member.workspace_id
    and workspace_member.user_id = team_member.user_id
    and workspace_member.status = 'active'::public.membership_status
    and workspace_member.removed_at is null
    and workspace_member.role <> 'viewer'::public.workspace_role
  join public.profiles profile
    on profile.id = workspace_member.user_id
    and profile.is_active
  where team_member.team_id = p_team_id
    and team_member.user_id = coalesce(p_user_id, (select auth.uid()))
    and team_member.removed_at is null
  limit 1;
$$;

create or replace function private.can_manage_operating_model(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_workspace_role(p_workspace_id) in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'manager'::public.workspace_role
    ),
    false
  );
$$;

create or replace function private.can_manage_team_members(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teams team
    where team.id = p_team_id
      and team.archived_at is null
      and private.current_workspace_role(team.workspace_id) in (
        'owner'::public.workspace_role,
        'admin'::public.workspace_role,
        'manager'::public.workspace_role,
        'member'::public.workspace_role
      )
      and (
        private.can_manage_operating_model(team.workspace_id)
        or private.current_team_role(team.id) = 'lead'::public.team_member_role
      )
  );
$$;

create or replace function private.is_current_user_team_lead(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_team_role(p_team_id, (select auth.uid())) = 'lead'::public.team_member_role,
    false
  );
$$;

alter function private.current_team_role(uuid, uuid) owner to postgres;
alter function private.can_manage_operating_model(uuid) owner to postgres;
alter function private.can_manage_team_members(uuid) owner to postgres;
alter function private.is_current_user_team_lead(uuid) owner to postgres;
revoke all on function private.current_team_role(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_manage_operating_model(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_team_members(uuid) from public, anon, authenticated;
revoke all on function private.is_current_user_team_lead(uuid) from public, anon, authenticated;
grant execute on function private.is_current_user_team_lead(uuid) to authenticated;

create or replace function public.list_workspace_operating_model(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_can_manage_all boolean;
  v_teams jsonb;
  v_functions jsonb;
  v_members jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;

  v_role := private.current_workspace_role(p_workspace_id);
  if v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;
  if v_role = 'viewer'::public.workspace_role then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;

  v_can_manage_all := private.can_manage_operating_model(p_workspace_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', team.id,
        'name', team.name,
        'slug', team.slug,
        'description', team.description,
        'color', team.color,
        'is_default', team.is_default,
        'version', team.version,
        'created_at', team.created_at,
        'updated_at', team.updated_at,
        'member_count', (
          select count(*)
          from public.team_members counted_member
          where counted_member.workspace_id = team.workspace_id
            and counted_member.team_id = team.id
            and counted_member.removed_at is null
        ),
        'can_manage_members', (
          v_can_manage_all
          or private.current_team_role(team.id, v_actor) = 'lead'::public.team_member_role
        ),
        'members', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'user_id', team_member.user_id,
                'full_name', profile.full_name,
                'initials', coalesce(
                  nullif(btrim(profile.initials), ''),
                  upper(left(btrim(profile.full_name), 1))
                ),
                'avatar_path', profile.avatar_path,
                'workspace_role', workspace_member.role,
                'team_role', team_member.role,
                'is_primary_team', team_member.is_primary,
                'version', team_member.version,
                'functions', (
                  select coalesce(
                    jsonb_agg(
                      jsonb_build_object(
                        'id', job_function.id,
                        'name', job_function.name,
                        'category', job_function.category,
                        'is_primary', member_function.is_primary,
                        'assignment_version', member_function.version
                      )
                      order by member_function.is_primary desc,
                        job_function.position,
                        lower(job_function.name),
                        job_function.id
                    ),
                    '[]'::jsonb
                  )
                  from public.team_member_functions member_function
                  join public.job_functions job_function
                    on job_function.workspace_id = member_function.workspace_id
                    and job_function.id = member_function.job_function_id
                    and job_function.archived_at is null
                  where member_function.workspace_id = team_member.workspace_id
                    and member_function.team_id = team_member.team_id
                    and member_function.user_id = team_member.user_id
                    and member_function.archived_at is null
                )
              )
              order by
                case team_member.role
                  when 'lead'::public.team_member_role then 0
                  else 1
                end,
                lower(profile.full_name),
                team_member.user_id
            ),
            '[]'::jsonb
          )
          from public.team_members team_member
          join public.workspace_members workspace_member
            on workspace_member.workspace_id = team_member.workspace_id
            and workspace_member.user_id = team_member.user_id
            and workspace_member.status = 'active'::public.membership_status
            and workspace_member.removed_at is null
          join public.profiles profile
            on profile.id = team_member.user_id
            and profile.is_active
          where team_member.workspace_id = team.workspace_id
            and team_member.team_id = team.id
            and team_member.removed_at is null
            and (
              v_can_manage_all
              or team_member.user_id = v_actor
              or private.current_team_role(team.id, v_actor) = 'lead'::public.team_member_role
            )
        )
      )
      order by team.is_default desc, lower(team.name), team.id
    ),
    '[]'::jsonb
  )
  into v_teams
  from public.teams team
  where team.workspace_id = p_workspace_id
    and team.archived_at is null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', job_function.id,
        'system_key', job_function.system_key,
        'name', job_function.name,
        'category', job_function.category,
        'description', job_function.description,
        'position', job_function.position,
        'is_system', job_function.is_system,
        'version', job_function.version
      )
      order by job_function.position, lower(job_function.name), job_function.id
    ),
    '[]'::jsonb
  )
  into v_functions
  from public.job_functions job_function
  where job_function.workspace_id = p_workspace_id
    and job_function.archived_at is null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', workspace_member.user_id,
        'full_name', profile.full_name,
        'initials', coalesce(
          nullif(btrim(profile.initials), ''),
          upper(left(btrim(profile.full_name), 1))
        ),
        'avatar_path', profile.avatar_path,
        'workspace_role', workspace_member.role,
        'workspace_member_version', workspace_member.version,
        'primary_team_id', (
          select team_member.team_id
          from public.team_members team_member
          where team_member.workspace_id = workspace_member.workspace_id
            and team_member.user_id = workspace_member.user_id
            and team_member.is_primary
            and team_member.removed_at is null
          limit 1
        )
      )
      order by lower(profile.full_name), workspace_member.user_id
    ),
    '[]'::jsonb
  )
  into v_members
  from public.workspace_members workspace_member
  join public.profiles profile
    on profile.id = workspace_member.user_id
    and profile.is_active
  where workspace_member.workspace_id = p_workspace_id
    and workspace_member.status = 'active'::public.membership_status
    and workspace_member.removed_at is null
    and (
      v_can_manage_all
      or workspace_member.user_id = v_actor
      or exists (
        select 1
        from public.team_members actor_team
        join public.team_members visible_team
          on visible_team.workspace_id = actor_team.workspace_id
          and visible_team.team_id = actor_team.team_id
          and visible_team.user_id = workspace_member.user_id
          and visible_team.removed_at is null
        where actor_team.workspace_id = p_workspace_id
          and actor_team.user_id = v_actor
          and actor_team.role = 'lead'::public.team_member_role
          and actor_team.removed_at is null
      )
    );

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'workspace_role', v_role,
    'teams', v_teams,
    'job_functions', v_functions,
    'members', v_members,
    'permissions', jsonb_build_object(
      'can_manage_teams', v_can_manage_all,
      'can_manage_job_functions', v_can_manage_all,
      'can_manage_all_team_members', v_can_manage_all
    )
  );
end;
$$;

create or replace function public.create_operating_team(
  p_workspace_id uuid,
  p_name text,
  p_slug text,
  p_description text default null,
  p_color text default 'blue'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_team public.teams%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  if not private.can_manage_operating_model(p_workspace_id) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 100 then
    raise exception using errcode = '22023', message = 'PTA_TEAM_NAME_INVALID';
  end if;
  if p_slug is null or lower(btrim(p_slug)) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'PTA_TEAM_SLUG_INVALID';
  end if;
  if p_color is null or lower(btrim(p_color)) !~ '^[a-z][a-z0-9-]{1,31}$' then
    raise exception using errcode = '22023', message = 'PTA_TEAM_COLOR_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:operating-model:' || p_workspace_id::text, 0)
  );

  insert into public.teams (
    workspace_id,
    name,
    slug,
    description,
    color,
    created_by
  ) values (
    p_workspace_id,
    btrim(p_name),
    lower(btrim(p_slug)),
    nullif(btrim(p_description), ''),
    lower(btrim(p_color)),
    v_actor
  )
  returning * into v_team;

  insert into public.team_members (
    workspace_id,
    team_id,
    user_id,
    role,
    is_primary,
    added_by
  ) values (
    p_workspace_id,
    v_team.id,
    v_actor,
    'lead'::public.team_member_role,
    false,
    v_actor
  );

  insert into public.activity_logs (
    workspace_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata_json
  ) values (
    p_workspace_id,
    v_actor,
    'team',
    v_team.id,
    'team.created',
    jsonb_build_object('name', v_team.name, 'slug', v_team.slug)
  );

  return jsonb_build_object(
    'id', v_team.id,
    'workspace_id', v_team.workspace_id,
    'name', v_team.name,
    'slug', v_team.slug,
    'description', v_team.description,
    'color', v_team.color,
    'is_default', v_team.is_default,
    'version', v_team.version
  );
end;
$$;

create or replace function public.update_operating_team(
  p_team_id uuid,
  p_expected_version integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_team public.teams%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception using errcode = '22023', message = 'PTA_PATCH_MUST_BE_OBJECT';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_patch) as patch_key(key_name)
    where patch_key.key_name <> all (array['name', 'slug', 'description', 'color']::text[])
  ) then
    raise exception using errcode = '22023', message = 'PTA_PATCH_HAS_UNSUPPORTED_FIELDS';
  end if;

  select team.*
  into v_team
  from public.teams team
  where team.id = p_team_id
  for update;

  if not found or v_team.archived_at is not null then
    raise exception using errcode = 'P0002', message = 'PTA_TEAM_NOT_FOUND';
  end if;
  if not private.can_manage_operating_model(v_team.workspace_id) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;
  if v_team.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  update public.teams team
  set
    name = case when p_patch ? 'name' then p_patch ->> 'name' else team.name end,
    slug = case when p_patch ? 'slug' then p_patch ->> 'slug' else team.slug end,
    description = case when p_patch ? 'description' then p_patch ->> 'description' else team.description end,
    color = case when p_patch ? 'color' then p_patch ->> 'color' else team.color end
  where team.id = p_team_id
  returning team.* into v_team;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    v_team.workspace_id,
    v_actor,
    'team',
    v_team.id,
    'team.updated',
    jsonb_build_object(
      'fields', (
        select jsonb_agg(patch_key.key_name)
        from jsonb_object_keys(p_patch) as patch_key(key_name)
      )
    )
  );

  return to_jsonb(v_team) - 'archived_by';
end;
$$;

create or replace function public.archive_operating_team(
  p_team_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_team public.teams%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;

  select team.*
  into v_team
  from public.teams team
  where team.id = p_team_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_TEAM_NOT_FOUND';
  end if;
  if not private.can_manage_operating_model(v_team.workspace_id) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:operating-model:' || v_team.workspace_id::text, 0)
  );

  if v_team.archived_at is not null then
    return jsonb_build_object('id', v_team.id, 'version', v_team.version, 'archived_at', v_team.archived_at);
  end if;
  if v_team.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if v_team.is_default then
    raise exception using errcode = '23514', message = 'PTA_DEFAULT_TEAM_REQUIRED';
  end if;
  if exists (
    select 1 from public.tasks task
    where task.workspace_id = v_team.workspace_id
      and task.team_id = v_team.id
      and task.archived_at is null
  ) then
    raise exception using errcode = '23514', message = 'PTA_TEAM_HAS_ACTIVE_TASKS';
  end if;
  if exists (
    select 1
    from public.team_members member
    where member.workspace_id = v_team.workspace_id
      and member.team_id = v_team.id
      and member.removed_at is null
      and not exists (
        select 1
        from public.team_members other_membership
        join public.teams other_team
          on other_team.workspace_id = other_membership.workspace_id
          and other_team.id = other_membership.team_id
          and other_team.archived_at is null
        where other_membership.workspace_id = member.workspace_id
          and other_membership.user_id = member.user_id
          and other_membership.team_id <> member.team_id
          and other_membership.removed_at is null
      )
  ) then
    raise exception using errcode = '23514', message = 'PTA_MEMBER_REQUIRES_ACTIVE_TEAM';
  end if;

  update public.team_member_functions assignment
  set
    is_primary = false,
    archived_at = statement_timestamp(),
    archived_by = v_actor
  where assignment.workspace_id = v_team.workspace_id
    and assignment.team_id = v_team.id
    and assignment.archived_at is null;

  update public.team_members member
  set
    is_primary = false,
    removed_at = statement_timestamp(),
    removed_by = v_actor
  where member.workspace_id = v_team.workspace_id
    and member.team_id = v_team.id
    and member.removed_at is null;

  update public.team_members replacement
  set is_primary = true
  where replacement.workspace_id = v_team.workspace_id
    and replacement.removed_at is null
    and exists (
      select 1
      from public.team_members removed_membership
      where removed_membership.workspace_id = replacement.workspace_id
        and removed_membership.team_id = v_team.id
        and removed_membership.user_id = replacement.user_id
        and removed_membership.removed_at is not null
    )
    and not exists (
      select 1
      from public.team_members current_primary
      where current_primary.workspace_id = replacement.workspace_id
        and current_primary.user_id = replacement.user_id
        and current_primary.is_primary
        and current_primary.removed_at is null
    )
    and replacement.team_id = (
      select candidate.team_id
      from public.team_members candidate
      join public.teams candidate_team
        on candidate_team.workspace_id = candidate.workspace_id
        and candidate_team.id = candidate.team_id
        and candidate_team.archived_at is null
      where candidate.workspace_id = replacement.workspace_id
        and candidate.user_id = replacement.user_id
        and candidate.removed_at is null
      order by candidate_team.is_default desc, candidate.joined_at, candidate.team_id
      limit 1
    );

  update public.teams team
  set archived_at = statement_timestamp(), archived_by = v_actor
  where team.id = v_team.id
  returning team.* into v_team;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action
  ) values (
    v_team.workspace_id, v_actor, 'team', v_team.id, 'team.archived'
  );

  return jsonb_build_object('id', v_team.id, 'version', v_team.version, 'archived_at', v_team.archived_at);
end;
$$;

create or replace function public.upsert_team_member(
  p_team_id uuid,
  p_user_id uuid,
  p_role public.team_member_role default 'member',
  p_is_primary boolean default false,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_team public.teams%rowtype;
  v_actor_workspace_role public.workspace_role;
  v_existing public.team_members%rowtype;
  v_member public.team_members%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;

  select team.* into v_team
  from public.teams team
  where team.id = p_team_id
    and team.archived_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_TEAM_NOT_FOUND';
  end if;
  if not private.can_manage_team_members(v_team.id) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:operating-model:' || v_team.workspace_id::text, 0)
  );

  if not exists (
    select 1
    from public.workspace_members member
    join public.profiles profile on profile.id = member.user_id and profile.is_active
    where member.workspace_id = v_team.workspace_id
      and member.user_id = p_user_id
      and member.status = 'active'::public.membership_status
      and member.removed_at is null
      and member.role <> 'viewer'::public.workspace_role
  ) then
    raise exception using errcode = '23514', message = 'PTA_MEMBER_NOT_ACTIVE';
  end if;

  v_actor_workspace_role := private.current_workspace_role(v_team.workspace_id);
  if v_actor_workspace_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  ) and p_role = 'lead'::public.team_member_role then
    raise exception using errcode = '42501', message = 'PTA_TEAM_LEAD_GRANT_FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'pta:team-member:' || v_team.workspace_id::text || ':' || p_user_id::text,
      0
    )
  );

  if coalesce(p_is_primary, false) then
    update public.team_members other_membership
    set is_primary = false
    where other_membership.workspace_id = v_team.workspace_id
      and other_membership.user_id = p_user_id
      and other_membership.team_id <> v_team.id
      and other_membership.is_primary
      and other_membership.removed_at is null;
  end if;

  select member.* into v_existing
  from public.team_members member
  where member.workspace_id = v_team.workspace_id
    and member.team_id = v_team.id
    and member.user_id = p_user_id
  for update;

  if found then
    if p_expected_version is null or v_existing.version <> p_expected_version then
      raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
    end if;
    if v_actor_workspace_role not in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'manager'::public.workspace_role
    ) and v_existing.role = 'lead'::public.team_member_role then
      raise exception using errcode = '42501', message = 'PTA_TEAM_LEAD_CHANGE_FORBIDDEN';
    end if;

    update public.team_members member
    set
      role = p_role,
      is_primary = coalesce(p_is_primary, false),
      removed_at = null,
      removed_by = null
    where member.workspace_id = v_team.workspace_id
      and member.team_id = v_team.id
      and member.user_id = p_user_id
    returning member.* into v_member;
  else
    if p_expected_version is not null then
      raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
    end if;
    insert into public.team_members (
      workspace_id, team_id, user_id, role, is_primary, added_by
    ) values (
      v_team.workspace_id,
      v_team.id,
      p_user_id,
      p_role,
      coalesce(p_is_primary, false),
      v_actor
    )
    returning * into v_member;
  end if;

  if v_member.is_primary then
    update public.team_members other_membership
    set is_primary = false
    where other_membership.workspace_id = v_member.workspace_id
      and other_membership.user_id = v_member.user_id
      and other_membership.team_id <> v_member.team_id
      and other_membership.is_primary
      and other_membership.removed_at is null;
  elsif not exists (
    select 1
    from public.team_members primary_membership
    where primary_membership.workspace_id = v_member.workspace_id
      and primary_membership.user_id = v_member.user_id
      and primary_membership.is_primary
      and primary_membership.removed_at is null
  ) then
    update public.team_members member
    set is_primary = true
    where member.workspace_id = v_member.workspace_id
      and member.team_id = v_member.team_id
      and member.user_id = v_member.user_id
    returning member.* into v_member;
  end if;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    v_member.workspace_id,
    v_actor,
    'team_member',
    v_member.team_id,
    'team.member_saved',
    jsonb_build_object(
      'user_id', v_member.user_id,
      'team_role', v_member.role,
      'is_primary', v_member.is_primary
    )
  );

  return jsonb_build_object(
    'workspace_id', v_member.workspace_id,
    'team_id', v_member.team_id,
    'user_id', v_member.user_id,
    'role', v_member.role,
    'is_primary', v_member.is_primary,
    'version', v_member.version
  );
end;
$$;

create or replace function public.remove_team_member(
  p_team_id uuid,
  p_user_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_team public.teams%rowtype;
  v_actor_workspace_role public.workspace_role;
  v_member public.team_members%rowtype;
  v_new_primary_team_id uuid;
  v_was_primary boolean;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;

  select team.* into v_team
  from public.teams team
  where team.id = p_team_id
    and team.archived_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_TEAM_NOT_FOUND';
  end if;
  if not private.can_manage_team_members(v_team.id) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:operating-model:' || v_team.workspace_id::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended(
      'pta:team-member:' || v_team.workspace_id::text || ':' || p_user_id::text,
      0
    )
  );

  v_actor_workspace_role := private.current_workspace_role(v_team.workspace_id);
  select member.* into v_member
  from public.team_members member
  where member.workspace_id = v_team.workspace_id
    and member.team_id = v_team.id
    and member.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_TEAM_MEMBER_NOT_FOUND';
  end if;
  if v_member.removed_at is not null then
    return jsonb_build_object(
      'team_id', v_member.team_id,
      'user_id', v_member.user_id,
      'version', v_member.version,
      'removed_at', v_member.removed_at
    );
  end if;
  if v_member.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  v_was_primary := v_member.is_primary;
  if v_actor_workspace_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  ) and v_member.role = 'lead'::public.team_member_role then
    raise exception using errcode = '42501', message = 'PTA_TEAM_LEAD_CHANGE_FORBIDDEN';
  end if;
  if exists (
    select 1
    from public.task_assignees assignee
    join public.tasks task
      on task.workspace_id = assignee.workspace_id
      and task.id = assignee.task_id
      and task.team_id = v_member.team_id
      and task.archived_at is null
    where assignee.workspace_id = v_member.workspace_id
      and assignee.user_id = v_member.user_id
  ) then
    raise exception using errcode = '23514', message = 'PTA_TEAM_MEMBER_HAS_ACTIVE_TASKS';
  end if;

  select other_membership.team_id
  into v_new_primary_team_id
  from public.team_members other_membership
  join public.teams other_team
    on other_team.workspace_id = other_membership.workspace_id
    and other_team.id = other_membership.team_id
    and other_team.archived_at is null
  where other_membership.workspace_id = v_member.workspace_id
    and other_membership.user_id = v_member.user_id
    and other_membership.team_id <> v_member.team_id
    and other_membership.removed_at is null
  order by other_team.is_default desc, other_membership.joined_at, other_membership.team_id
  limit 1;

  if v_new_primary_team_id is null then
    raise exception using errcode = '23514', message = 'PTA_MEMBER_REQUIRES_ACTIVE_TEAM';
  end if;

  update public.team_member_functions assignment
  set
    is_primary = false,
    archived_at = statement_timestamp(),
    archived_by = v_actor
  where assignment.workspace_id = v_member.workspace_id
    and assignment.team_id = v_member.team_id
    and assignment.user_id = v_member.user_id
    and assignment.archived_at is null;

  update public.team_members member
  set
    is_primary = false,
    removed_at = statement_timestamp(),
    removed_by = v_actor
  where member.workspace_id = v_member.workspace_id
    and member.team_id = v_member.team_id
    and member.user_id = v_member.user_id
  returning member.* into v_member;

  if v_was_primary then
    update public.team_members member
    set is_primary = true
    where member.workspace_id = v_member.workspace_id
      and member.team_id = v_new_primary_team_id
      and member.user_id = v_member.user_id;
  end if;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    v_member.workspace_id,
    v_actor,
    'team_member',
    v_member.team_id,
    'team.member_removed',
    jsonb_build_object('user_id', v_member.user_id)
  );

  return jsonb_build_object(
    'team_id', v_member.team_id,
    'user_id', v_member.user_id,
    'version', v_member.version,
    'removed_at', v_member.removed_at
  );
end;
$$;

create or replace function public.save_job_function(
  p_workspace_id uuid,
  p_job_function_id uuid,
  p_expected_version integer,
  p_name text,
  p_category text,
  p_description text default null,
  p_position integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_function public.job_functions%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  if not private.can_manage_operating_model(p_workspace_id) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 100 then
    raise exception using errcode = '22023', message = 'PTA_JOB_FUNCTION_NAME_INVALID';
  end if;
  if p_category is null or char_length(btrim(p_category)) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'PTA_JOB_FUNCTION_CATEGORY_INVALID';
  end if;
  if p_description is not null and char_length(p_description) > 1000 then
    raise exception using errcode = '22023', message = 'PTA_JOB_FUNCTION_DESCRIPTION_TOO_LONG';
  end if;
  if p_position is null or p_position < 0 then
    raise exception using errcode = '22023', message = 'PTA_JOB_FUNCTION_POSITION_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pta:operating-model:' || p_workspace_id::text, 0)
  );

  if p_job_function_id is null then
    if p_expected_version is not null then
      raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
    end if;

    insert into public.job_functions (
      workspace_id,
      name,
      category,
      description,
      position,
      is_system,
      created_by
    ) values (
      p_workspace_id,
      btrim(p_name),
      btrim(p_category),
      nullif(btrim(p_description), ''),
      p_position,
      false,
      v_actor
    )
    returning * into v_function;
  else
    if p_expected_version is null or p_expected_version < 1 then
      raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
    end if;

    select job_function.*
    into v_function
    from public.job_functions job_function
    where job_function.workspace_id = p_workspace_id
      and job_function.id = p_job_function_id
    for update;

    if not found or v_function.archived_at is not null then
      raise exception using errcode = 'P0002', message = 'PTA_JOB_FUNCTION_NOT_FOUND';
    end if;
    if v_function.version <> p_expected_version then
      raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
    end if;
    if v_function.is_system and (
      btrim(p_name) <> v_function.name
      or btrim(p_category) <> v_function.category
      or nullif(btrim(p_description), '') is distinct from v_function.description
    ) then
      raise exception using errcode = '23514', message = 'PTA_SYSTEM_JOB_FUNCTION_IMMUTABLE';
    end if;

    update public.job_functions job_function
    set
      name = btrim(p_name),
      category = btrim(p_category),
      description = nullif(btrim(p_description), ''),
      position = p_position
    where job_function.workspace_id = p_workspace_id
      and job_function.id = p_job_function_id
    returning job_function.* into v_function;
  end if;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    p_workspace_id,
    v_actor,
    'job_function',
    v_function.id,
    case when p_job_function_id is null then 'job_function.created' else 'job_function.updated' end,
    jsonb_build_object(
      'name', v_function.name,
      'category', v_function.category,
      'is_system', v_function.is_system
    )
  );

  return jsonb_build_object(
    'id', v_function.id,
    'workspace_id', v_function.workspace_id,
    'system_key', v_function.system_key,
    'name', v_function.name,
    'category', v_function.category,
    'description', v_function.description,
    'position', v_function.position,
    'is_system', v_function.is_system,
    'version', v_function.version
  );
end;
$$;

create or replace function public.archive_job_function(
  p_job_function_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_function public.job_functions%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;

  select job_function.*
  into v_function
  from public.job_functions job_function
  where job_function.id = p_job_function_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_JOB_FUNCTION_NOT_FOUND';
  end if;
  if not private.can_manage_operating_model(v_function.workspace_id) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;
  if v_function.archived_at is not null then
    return jsonb_build_object(
      'id', v_function.id,
      'version', v_function.version,
      'archived_at', v_function.archived_at
    );
  end if;
  if v_function.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;
  if v_function.is_system then
    raise exception using errcode = '23514', message = 'PTA_SYSTEM_JOB_FUNCTION_REQUIRED';
  end if;

  update public.team_member_functions assignment
  set
    is_primary = false,
    archived_at = statement_timestamp(),
    archived_by = v_actor
  where assignment.workspace_id = v_function.workspace_id
    and assignment.job_function_id = v_function.id
    and assignment.archived_at is null;

  update public.job_functions job_function
  set archived_at = statement_timestamp(), archived_by = v_actor
  where job_function.id = v_function.id
  returning job_function.* into v_function;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action
  ) values (
    v_function.workspace_id,
    v_actor,
    'job_function',
    v_function.id,
    'job_function.archived'
  );

  return jsonb_build_object(
    'id', v_function.id,
    'version', v_function.version,
    'archived_at', v_function.archived_at
  );
end;
$$;

create or replace function public.set_team_member_functions(
  p_team_id uuid,
  p_user_id uuid,
  p_job_function_ids uuid[],
  p_primary_job_function_id uuid,
  p_expected_team_member_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_team public.teams%rowtype;
  v_member public.team_members%rowtype;
  v_function_ids uuid[] := coalesce(p_job_function_ids, '{}'::uuid[]);
  v_functions jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'PTA_AUTH_REQUIRED';
  end if;
  if p_expected_team_member_version is null or p_expected_team_member_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;
  if exists (select 1 from unnest(v_function_ids) function_id where function_id is null) then
    raise exception using errcode = '22023', message = 'PTA_JOB_FUNCTION_LIST_INVALID';
  end if;
  if cardinality(v_function_ids) <> (
    select count(distinct function_id) from unnest(v_function_ids) function_id
  ) then
    raise exception using errcode = '22023', message = 'PTA_JOB_FUNCTION_LIST_DUPLICATED';
  end if;
  if p_primary_job_function_id is not null
     and not p_primary_job_function_id = any(v_function_ids) then
    raise exception using errcode = '22023', message = 'PTA_PRIMARY_JOB_FUNCTION_NOT_SELECTED';
  end if;

  select team.* into v_team
  from public.teams team
  where team.id = p_team_id
    and team.archived_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_TEAM_NOT_FOUND';
  end if;
  if not private.can_manage_team_members(v_team.id) then
    raise exception using errcode = '42501', message = 'PTA_TEAM_FORBIDDEN';
  end if;
  if (
    select count(*)
    from public.job_functions job_function
    where job_function.workspace_id = v_team.workspace_id
      and job_function.id = any(v_function_ids)
      and job_function.archived_at is null
  ) <> cardinality(v_function_ids) then
    raise exception using errcode = '23514', message = 'PTA_JOB_FUNCTION_NOT_ACTIVE';
  end if;

  select member.* into v_member
  from public.team_members member
  where member.workspace_id = v_team.workspace_id
    and member.team_id = v_team.id
    and member.user_id = p_user_id
    and member.removed_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_TEAM_MEMBER_NOT_FOUND';
  end if;
  if v_member.version <> p_expected_team_member_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  update public.team_members member
  set role = member.role
  where member.workspace_id = v_member.workspace_id
    and member.team_id = v_member.team_id
    and member.user_id = v_member.user_id
  returning member.* into v_member;

  update public.team_member_functions assignment
  set is_primary = false
  where assignment.workspace_id = v_member.workspace_id
    and assignment.team_id = v_member.team_id
    and assignment.user_id = v_member.user_id
    and assignment.is_primary
    and assignment.archived_at is null;

  update public.team_member_functions assignment
  set
    is_primary = false,
    archived_at = statement_timestamp(),
    archived_by = v_actor
  where assignment.workspace_id = v_member.workspace_id
    and assignment.team_id = v_member.team_id
    and assignment.user_id = v_member.user_id
    and assignment.archived_at is null
    and not assignment.job_function_id = any(v_function_ids);

  insert into public.team_member_functions (
    workspace_id,
    team_id,
    user_id,
    job_function_id,
    is_primary,
    assigned_by
  )
  select
    v_member.workspace_id,
    v_member.team_id,
    v_member.user_id,
    selected.function_id,
    selected.function_id = p_primary_job_function_id,
    v_actor
  from unnest(v_function_ids) selected(function_id)
  on conflict (workspace_id, team_id, user_id, job_function_id) do update
  set
    is_primary = excluded.is_primary,
    archived_at = null,
    archived_by = null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', job_function.id,
        'system_key', job_function.system_key,
        'name', job_function.name,
        'is_primary', assignment.is_primary,
        'assignment_version', assignment.version
      )
      order by assignment.is_primary desc, job_function.position, job_function.id
    ),
    '[]'::jsonb
  )
  into v_functions
  from public.team_member_functions assignment
  join public.job_functions job_function
    on job_function.workspace_id = assignment.workspace_id
    and job_function.id = assignment.job_function_id
  where assignment.workspace_id = v_member.workspace_id
    and assignment.team_id = v_member.team_id
    and assignment.user_id = v_member.user_id
    and assignment.archived_at is null;

  insert into public.activity_logs (
    workspace_id, actor_id, entity_type, entity_id, action, metadata_json
  ) values (
    v_member.workspace_id,
    v_actor,
    'team_member',
    v_member.team_id,
    'team.member_functions_changed',
    jsonb_build_object(
      'user_id', v_member.user_id,
      'job_function_ids', to_jsonb(v_function_ids),
      'primary_job_function_id', p_primary_job_function_id
    )
  );

  return jsonb_build_object(
    'workspace_id', v_member.workspace_id,
    'team_id', v_member.team_id,
    'user_id', v_member.user_id,
    'team_member_version', v_member.version,
    'functions', v_functions
  );
end;
$$;

alter table public.teams enable row level security;
alter table public.teams force row level security;
alter table public.team_members enable row level security;
alter table public.team_members force row level security;
alter table public.job_functions enable row level security;
alter table public.job_functions force row level security;
alter table public.team_member_functions enable row level security;
alter table public.team_member_functions force row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_dependencies force row level security;
alter table public.task_approval_requests enable row level security;
alter table public.task_approval_requests force row level security;
alter table public.task_handoffs enable row level security;
alter table public.task_handoffs force row level security;

create policy teams_select_workspace_member
on public.teams
for select
to authenticated
using (private.is_active_workspace_member(workspace_id));

create policy team_members_select_scoped
on public.team_members
for select
to authenticated
using (
  private.current_workspace_role(workspace_id) in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  )
  or user_id = (select auth.uid())
  or private.is_current_user_team_lead(team_id)
);

create policy job_functions_select_workspace_member
on public.job_functions
for select
to authenticated
using (private.is_active_workspace_member(workspace_id));

create policy team_member_functions_select_scoped
on public.team_member_functions
for select
to authenticated
using (
  private.current_workspace_role(workspace_id) in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  )
  or user_id = (select auth.uid())
  or private.is_current_user_team_lead(team_id)
);

create policy task_dependencies_select_workspace_member
on public.task_dependencies
for select
to authenticated
using (private.is_active_workspace_member(workspace_id));

create policy task_approval_requests_select_workspace_member
on public.task_approval_requests
for select
to authenticated
using (private.is_active_workspace_member(workspace_id));

create policy task_handoffs_select_workspace_member
on public.task_handoffs
for select
to authenticated
using (private.is_active_workspace_member(workspace_id));

revoke all on table
  public.teams,
  public.team_members,
  public.job_functions,
  public.team_member_functions,
  public.task_dependencies,
  public.task_approval_requests,
  public.task_handoffs
from public, anon, authenticated;

grant select on table
  public.teams,
  public.team_members,
  public.job_functions,
  public.team_member_functions,
  public.task_dependencies,
  public.task_approval_requests,
  public.task_handoffs
to authenticated;

alter function public.list_workspace_operating_model(uuid) owner to postgres;
alter function public.create_operating_team(uuid, text, text, text, text) owner to postgres;
alter function public.update_operating_team(uuid, integer, jsonb) owner to postgres;
alter function public.archive_operating_team(uuid, integer) owner to postgres;
alter function public.upsert_team_member(uuid, uuid, public.team_member_role, boolean, integer) owner to postgres;
alter function public.remove_team_member(uuid, uuid, integer) owner to postgres;
alter function public.save_job_function(uuid, uuid, integer, text, text, text, integer) owner to postgres;
alter function public.archive_job_function(uuid, integer) owner to postgres;
alter function public.set_team_member_functions(uuid, uuid, uuid[], uuid, integer) owner to postgres;

revoke all on function public.list_workspace_operating_model(uuid) from public, anon, authenticated;
revoke all on function public.create_operating_team(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.update_operating_team(uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.archive_operating_team(uuid, integer) from public, anon, authenticated;
revoke all on function public.upsert_team_member(uuid, uuid, public.team_member_role, boolean, integer) from public, anon, authenticated;
revoke all on function public.remove_team_member(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.save_job_function(uuid, uuid, integer, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.archive_job_function(uuid, integer) from public, anon, authenticated;
revoke all on function public.set_team_member_functions(uuid, uuid, uuid[], uuid, integer) from public, anon, authenticated;

grant execute on function public.list_workspace_operating_model(uuid) to authenticated;
grant execute on function public.create_operating_team(uuid, text, text, text, text) to authenticated;
grant execute on function public.update_operating_team(uuid, integer, jsonb) to authenticated;
grant execute on function public.archive_operating_team(uuid, integer) to authenticated;
grant execute on function public.upsert_team_member(uuid, uuid, public.team_member_role, boolean, integer) to authenticated;
grant execute on function public.remove_team_member(uuid, uuid, integer) to authenticated;
grant execute on function public.save_job_function(uuid, uuid, integer, text, text, text, integer) to authenticated;
grant execute on function public.archive_job_function(uuid, integer) to authenticated;
grant execute on function public.set_team_member_functions(uuid, uuid, uuid[], uuid, integer) to authenticated;

comment on table public.teams is
  'Persistent work queues inside one workspace. Workspace remains the hard tenancy boundary.';
comment on table public.team_members is
  'Team-scoped operational role, deliberately separate from workspace authorization and professional function.';
comment on table public.job_functions is
  'Workspace catalogue of professional functions. System keys match the application operating model contract.';
comment on table public.team_member_functions is
  'Professional functions performed by one person in one team, with at most one primary active function.';
comment on table public.task_dependencies is
  'Directed blocking relationships between tasks, protected from direct and indirect cycles.';
comment on table public.task_approval_requests is
  'Version-aware explicit approval decisions, separate from task status and comments.';
comment on table public.task_handoffs is
  'Auditable transfer between source and target tasks owned by different teams.';
comment on function public.list_workspace_operating_model(uuid) is
  'Returns teams, professional functions and scoped active memberships without exposing member email addresses.';
comment on function public.upsert_team_member(uuid, uuid, public.team_member_role, boolean, integer) is
  'Creates or version-updates one team membership. Team leads cannot grant or alter the lead role.';
comment on function public.set_team_member_functions(uuid, uuid, uuid[], uuid, integer) is
  'Atomically replaces one team member professional function set using the membership version as concurrency token.';

commit;
