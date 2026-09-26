begin;

create table public.task_checklists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  title text not null,
  position numeric(20, 10) not null default 1000,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, task_id, id),
  foreign key (workspace_id, task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint task_checklists_title_valid check (
    title = btrim(title)
    and char_length(title) between 1 and 200
  ),
  constraint task_checklists_position_valid check (position >= 0)
);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  checklist_id uuid not null,
  content text not null,
  position numeric(20, 10) not null default 1000,
  is_completed boolean not null default false,
  completed_by uuid,
  completed_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, task_id, checklist_id)
    references public.task_checklists(workspace_id, task_id, id) on delete cascade,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, completed_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint task_checklist_items_content_valid check (
    content = btrim(content)
    and char_length(content) between 1 and 500
  ),
  constraint task_checklist_items_position_valid check (position >= 0),
  constraint task_checklist_items_completion_consistent check (
    (is_completed and completed_by is not null and completed_at is not null)
    or (not is_completed and completed_by is null and completed_at is null)
  )
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  body text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  deleted_by uuid,
  deleted_at timestamptz,
  foreign key (workspace_id, task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, deleted_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint task_comments_body_valid check (
    (
      deleted_at is null
      and deleted_by is null
      and body is not null
      and body = btrim(body)
      and char_length(body) between 1 and 10000
    )
    or (
      deleted_at is not null
      and deleted_by is not null
      and body is null
    )
  )
);

create table public.task_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  url text not null,
  label text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, task_id, url),
  foreign key (workspace_id, task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint task_links_url_valid check (
    url = btrim(url)
    and char_length(url) between 8 and 2048
    and url ~* '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
    and url !~* '%0d|%0a'
  ),
  constraint task_links_label_valid check (
    label is null
    or (
      label = btrim(label)
      and char_length(label) between 1 and 200
    )
  )
);

create index task_checklists_task_order
  on public.task_checklists (workspace_id, task_id, position, created_at, id);
create index task_checklist_items_checklist_order
  on public.task_checklist_items (workspace_id, task_id, checklist_id, position, created_at, id);
create index task_comments_task_created
  on public.task_comments (workspace_id, task_id, created_at desc, id);
create index task_links_task_created
  on public.task_links (workspace_id, task_id, created_at, id);

create or replace function private.preserve_task_collaboration_authorship()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.workspace_id := old.workspace_id;
  new.task_id := old.task_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger task_checklists_preserve_authorship
before update on public.task_checklists
for each row execute function private.preserve_task_collaboration_authorship();

create trigger task_checklist_items_preserve_authorship
before update on public.task_checklist_items
for each row execute function private.preserve_task_collaboration_authorship();

create trigger task_comments_preserve_authorship
before update on public.task_comments
for each row execute function private.preserve_task_collaboration_authorship();

create trigger task_links_preserve_authorship
before update on public.task_links
for each row execute function private.preserve_task_collaboration_authorship();

alter function private.preserve_task_collaboration_authorship() owner to postgres;
revoke all on function private.preserve_task_collaboration_authorship()
from public, anon, authenticated;

alter table public.task_checklists enable row level security;
alter table public.task_checklists force row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_checklist_items force row level security;
alter table public.task_comments enable row level security;
alter table public.task_comments force row level security;
alter table public.task_links enable row level security;
alter table public.task_links force row level security;

create policy task_checklists_select_member
on public.task_checklists
for select
to authenticated
using (private.is_active_workspace_member(workspace_id));

create policy task_checklist_items_select_member
on public.task_checklist_items
for select
to authenticated
using (private.is_active_workspace_member(workspace_id));

create policy task_comments_select_member
on public.task_comments
for select
to authenticated
using (private.is_active_workspace_member(workspace_id));

create policy task_links_select_member
on public.task_links
for select
to authenticated
using (private.is_active_workspace_member(workspace_id));

revoke all on table
  public.task_checklists,
  public.task_checklist_items,
  public.task_comments,
  public.task_links
from public, anon, authenticated;

grant select on table
  public.task_checklists,
  public.task_checklist_items,
  public.task_comments,
  public.task_links
to authenticated;

create or replace function private.task_collaboration_role(p_task_id uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = ''
as $$
  select wm.role
  from public.tasks task
  join public.workspaces workspace
    on workspace.id = task.workspace_id
    and workspace.archived_at is null
  join public.workspace_members wm
    on wm.workspace_id = task.workspace_id
    and wm.user_id = (select auth.uid())
    and wm.status = 'active'::public.membership_status
  join public.profiles profile
    on profile.id = wm.user_id
    and profile.is_active
  where task.id = p_task_id
    and task.archived_at is null
  limit 1;
$$;

alter function private.task_collaboration_role(uuid) owner to postgres;
revoke all on function private.task_collaboration_role(uuid)
from public, anon, authenticated;

create or replace function private.is_valid_task_description(p_description jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_block jsonb;
  v_inline jsonb;
begin
  if jsonb_typeof(p_description) <> 'object'
    or (p_description ->> 'type') is distinct from 'doc'
    or jsonb_typeof(p_description -> 'content') is distinct from 'array'
    or exists (
      select 1
      from jsonb_object_keys(p_description) as root_key(key)
      where root_key.key <> all (array['type', 'content']::text[])
    ) then
    return false;
  end if;

  for v_block in
    select block_node.value
    from jsonb_array_elements(p_description -> 'content') as block_node(value)
  loop
    if jsonb_typeof(v_block) <> 'object'
      or (v_block ->> 'type') is distinct from 'paragraph'
      or jsonb_typeof(v_block -> 'content') is distinct from 'array'
      or exists (
        select 1
        from jsonb_object_keys(v_block) as block_key(key)
        where block_key.key <> all (array['type', 'content']::text[])
      ) then
      return false;
    end if;

    for v_inline in
      select inline_node.value
      from jsonb_array_elements(v_block -> 'content') as inline_node(value)
    loop
      if jsonb_typeof(v_inline) <> 'object'
        or (v_inline ->> 'type') is distinct from 'text'
        or jsonb_typeof(v_inline -> 'text') is distinct from 'string'
        or exists (
          select 1
          from jsonb_object_keys(v_inline) as inline_key(key)
          where inline_key.key <> all (array['type', 'text']::text[])
        ) then
        return false;
      end if;
    end loop;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

alter function private.is_valid_task_description(jsonb) owner to postgres;
revoke all on function private.is_valid_task_description(jsonb)
from public, anon, authenticated;

create or replace function private.task_collaboration_payload(p_task_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_workspace_id uuid;
  v_role public.workspace_role;
  v_checklists jsonb;
  v_comments jsonb;
  v_links jsonb;
begin
  select task.workspace_id
  into v_workspace_id
  from public.tasks task
  where task.id = p_task_id
    and task.archived_at is null;

  v_role := private.task_collaboration_role(p_task_id);
  if v_workspace_id is null or v_role is null then
    raise exception using
      errcode = 'P0002',
      message = 'PTA_TASK_NOT_FOUND';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', checklist.id,
        'title', checklist.title,
        'position', checklist.position,
        'created_by', checklist.created_by,
        'creator_name', checklist_creator.full_name,
        'created_at', checklist.created_at,
        'updated_at', checklist.updated_at,
        'items', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', item.id,
                'content', item.content,
                'position', item.position,
                'is_completed', item.is_completed,
                'completed_by', item.completed_by,
                'completed_by_name', item_completer.full_name,
                'completed_at', item.completed_at,
                'created_by', item.created_by,
                'creator_name', item_creator.full_name,
                'created_at', item.created_at,
                'updated_at', item.updated_at
              ) order by item.position, item.created_at, item.id
            ),
            '[]'::jsonb
          )
          from public.task_checklist_items item
          left join public.profiles item_creator
            on item_creator.id = item.created_by
          left join public.profiles item_completer
            on item_completer.id = item.completed_by
          where item.workspace_id = checklist.workspace_id
            and item.task_id = checklist.task_id
            and item.checklist_id = checklist.id
        )
      ) order by checklist.position, checklist.created_at, checklist.id
    ),
    '[]'::jsonb
  )
  into v_checklists
  from public.task_checklists checklist
  left join public.profiles checklist_creator
    on checklist_creator.id = checklist.created_by
  where checklist.workspace_id = v_workspace_id
    and checklist.task_id = p_task_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', task_comment.id,
        'body', case when task_comment.deleted_at is null then task_comment.body else null end,
        'created_by', task_comment.created_by,
        'author_name', comment_author.full_name,
        'created_at', task_comment.created_at,
        'is_deleted', task_comment.deleted_at is not null,
        'deleted_at', task_comment.deleted_at,
        'can_delete_comment',
          task_comment.deleted_at is null
          and (
            v_role in (
              'owner'::public.workspace_role,
              'admin'::public.workspace_role,
              'manager'::public.workspace_role
            )
            or (
              v_role = 'member'::public.workspace_role
              and task_comment.created_by = v_actor
            )
          )
      ) order by task_comment.created_at, task_comment.id
    ),
    '[]'::jsonb
  )
  into v_comments
  from (
    select recent_comment.*
    from public.task_comments recent_comment
    where recent_comment.workspace_id = v_workspace_id
      and recent_comment.task_id = p_task_id
    order by recent_comment.created_at desc, recent_comment.id desc
    limit 20
  ) task_comment
  left join public.profiles comment_author
    on comment_author.id = task_comment.created_by;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', link.id,
        'url', link.url,
        'label', link.label,
        'created_by', link.created_by,
        'author_name', link_author.full_name,
        'created_at', link.created_at,
        'updated_at', link.updated_at,
        'can_edit_link',
          v_role in (
            'owner'::public.workspace_role,
            'admin'::public.workspace_role,
            'manager'::public.workspace_role
          )
          or (
            v_role = 'member'::public.workspace_role
            and link.created_by = v_actor
          ),
        'can_delete_link',
          v_role in (
            'owner'::public.workspace_role,
            'admin'::public.workspace_role,
            'manager'::public.workspace_role
          )
          or (
            v_role = 'member'::public.workspace_role
            and link.created_by = v_actor
          )
      ) order by link.created_at, link.id
    ),
    '[]'::jsonb
  )
  into v_links
  from public.task_links link
  left join public.profiles link_author
    on link_author.id = link.created_by
  where link.workspace_id = v_workspace_id
    and link.task_id = p_task_id;

  return jsonb_build_object(
    'checklists', v_checklists,
    'comments', v_comments,
    'links', v_links
  );
end;
$$;

create or replace function public.get_task_detail(p_task_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_role public.workspace_role;
  v_task jsonb;
  v_activity jsonb;
  v_collaboration jsonb;
  v_can_edit boolean;
  v_can_collaborate boolean;
begin
  select task.workspace_id
  into v_workspace_id
  from public.tasks task
  where task.id = p_task_id
    and task.archived_at is null;

  if v_workspace_id is null
    or not private.is_active_workspace_member(v_workspace_id) then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;

  select to_jsonb(overview)
    || jsonb_build_object('description_json', task.description_json)
  into v_task
  from public.v_task_overview overview
  join public.tasks task
    on task.workspace_id = overview.workspace_id
    and task.id = overview.id
  where overview.id = p_task_id;

  if v_task is null then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', activity.id,
        'actor_id', activity.actor_id,
        'action', activity.action,
        'changes_json', '{}'::jsonb,
        'metadata_json', '{}'::jsonb,
        'created_at', activity.created_at
      ) order by activity.created_at desc, activity.id desc
    ),
    '[]'::jsonb
  )
  into v_activity
  from (
    select id, actor_id, action, created_at
    from public.activity_logs
    where workspace_id = v_workspace_id
      and entity_type = 'task'
      and entity_id = p_task_id
    order by created_at desc, id desc
    limit 50
  ) activity;

  v_role := private.task_collaboration_role(p_task_id);
  v_can_edit := private.can_edit_task(p_task_id);
  v_can_collaborate := v_role in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role,
    'member'::public.workspace_role
  );
  v_collaboration := private.task_collaboration_payload(p_task_id);

  return jsonb_build_object(
    'task', v_task,
    'activity', v_activity,
    'collaboration', v_collaboration,
    'capabilities', jsonb_build_object(
      'can_edit', v_can_edit,
      'can_manage_assignees', v_role in (
        'owner'::public.workspace_role,
        'admin'::public.workspace_role,
        'manager'::public.workspace_role
      ),
      'can_edit_description', v_can_edit,
      'can_manage_checklist_structure', v_can_edit,
      'can_toggle_checklist', v_can_collaborate,
      'can_comment', v_can_collaborate,
      'can_add_link', v_can_collaborate,
      'can_remove_any_link', v_role in (
        'owner'::public.workspace_role,
        'admin'::public.workspace_role,
        'manager'::public.workspace_role
      )
    )
  );
end;
$$;

create or replace function public.update_task_description(
  p_task_id uuid,
  p_expected_version integer,
  p_description jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task public.tasks%rowtype;
begin
  select task.*
  into v_task
  from public.tasks task
  where task.id = p_task_id
  for update;

  if not found or not private.can_edit_task(p_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;
  if p_description is null
    or not private.is_valid_task_description(p_description) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_TASK_DESCRIPTION';
  end if;
  if octet_length(p_description::text) > 256000 then
    raise exception using errcode = '22023', message = 'PTA_DESCRIPTION_TOO_LARGE';
  end if;

  update public.tasks task
  set
    description_json = p_description,
    updated_by = v_actor
  where task.id = p_task_id
    and task.version = p_expected_version
  returning * into v_task;

  if not found then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  return jsonb_build_object(
    'id', v_task.id,
    'description_json', v_task.description_json,
    'version', v_task.version,
    'updated_at', v_task.updated_at
  );
end;
$$;

create or replace function public.create_task_checklist(
  p_task_id uuid,
  p_title text,
  p_position numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_workspace_id uuid;
  v_role public.workspace_role;
  v_position numeric;
  v_checklist public.task_checklists%rowtype;
begin
  select task.workspace_id
  into v_workspace_id
  from public.tasks task
  where task.id = p_task_id
    and task.archived_at is null;

  v_role := private.task_collaboration_role(p_task_id);
  if v_workspace_id is null or v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;
  if not private.can_edit_task(p_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_CHECKLIST_TITLE';
  end if;
  if p_position is not null and p_position < 0 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_CHECKLIST_POSITION';
  end if;

  select coalesce(
    p_position,
    coalesce(max(checklist.position), 0) + 1000
  )
  into v_position
  from public.task_checklists checklist
  where checklist.workspace_id = v_workspace_id
    and checklist.task_id = p_task_id;

  insert into public.task_checklists (
    workspace_id,
    task_id,
    title,
    position,
    created_by
  ) values (
    v_workspace_id,
    p_task_id,
    btrim(p_title),
    v_position,
    v_actor
  )
  returning * into v_checklist;

  return jsonb_build_object(
    'id', v_checklist.id,
    'task_id', v_checklist.task_id,
    'title', v_checklist.title,
    'position', v_checklist.position,
    'created_by', v_checklist.created_by,
    'created_at', v_checklist.created_at,
    'updated_at', v_checklist.updated_at
  );
end;
$$;

create or replace function public.add_task_checklist_item(
  p_checklist_id uuid,
  p_content text,
  p_position numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_workspace_id uuid;
  v_task_id uuid;
  v_role public.workspace_role;
  v_position numeric;
  v_item public.task_checklist_items%rowtype;
begin
  select checklist.workspace_id, checklist.task_id
  into v_workspace_id, v_task_id
  from public.task_checklists checklist
  where checklist.id = p_checklist_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_CHECKLIST_NOT_FOUND';
  end if;
  v_role := private.task_collaboration_role(v_task_id);
  if v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_CHECKLIST_NOT_FOUND';
  end if;
  if not private.can_edit_task(v_task_id) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_content is null or char_length(btrim(p_content)) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_CHECKLIST_ITEM';
  end if;
  if p_position is not null and p_position < 0 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_CHECKLIST_POSITION';
  end if;

  select coalesce(
    p_position,
    coalesce(max(item.position), 0) + 1000
  )
  into v_position
  from public.task_checklist_items item
  where item.workspace_id = v_workspace_id
    and item.task_id = v_task_id
    and item.checklist_id = p_checklist_id;

  insert into public.task_checklist_items (
    workspace_id,
    task_id,
    checklist_id,
    content,
    position,
    created_by
  ) values (
    v_workspace_id,
    v_task_id,
    p_checklist_id,
    btrim(p_content),
    v_position,
    v_actor
  )
  returning * into v_item;

  update public.task_checklists checklist
  set updated_at = clock_timestamp()
  where checklist.workspace_id = v_workspace_id
    and checklist.task_id = v_task_id
    and checklist.id = p_checklist_id;

  return jsonb_build_object(
    'id', v_item.id,
    'checklist_id', v_item.checklist_id,
    'task_id', v_item.task_id,
    'content', v_item.content,
    'position', v_item.position,
    'is_completed', v_item.is_completed,
    'created_by', v_item.created_by,
    'created_at', v_item.created_at,
    'updated_at', v_item.updated_at
  );
end;
$$;

create or replace function public.toggle_task_checklist_item(
  p_item_id uuid,
  p_is_completed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_item public.task_checklist_items%rowtype;
begin
  select item.*
  into v_item
  from public.task_checklist_items item
  where item.id = p_item_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_CHECKLIST_ITEM_NOT_FOUND';
  end if;
  v_role := private.task_collaboration_role(v_item.task_id);
  if v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_CHECKLIST_ITEM_NOT_FOUND';
  end if;
  if v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role,
    'member'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_is_completed is null then
    raise exception using errcode = '22023', message = 'PTA_INVALID_CHECKLIST_STATE';
  end if;

  if v_item.is_completed is distinct from p_is_completed then
    update public.task_checklist_items item
    set
      is_completed = p_is_completed,
      completed_by = case when p_is_completed then v_actor else null end,
      completed_at = case when p_is_completed then clock_timestamp() else null end,
      updated_at = clock_timestamp()
    where item.id = p_item_id
    returning * into v_item;

    update public.task_checklists checklist
    set updated_at = clock_timestamp()
    where checklist.workspace_id = v_item.workspace_id
      and checklist.task_id = v_item.task_id
      and checklist.id = v_item.checklist_id;
  end if;

  return jsonb_build_object(
    'id', v_item.id,
    'checklist_id', v_item.checklist_id,
    'task_id', v_item.task_id,
    'is_completed', v_item.is_completed,
    'completed_by', v_item.completed_by,
    'completed_at', v_item.completed_at,
    'updated_at', v_item.updated_at
  );
end;
$$;

create or replace function public.add_task_comment(
  p_task_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_workspace_id uuid;
  v_role public.workspace_role;
  v_comment public.task_comments%rowtype;
begin
  select task.workspace_id
  into v_workspace_id
  from public.tasks task
  where task.id = p_task_id
    and task.archived_at is null;

  v_role := private.task_collaboration_role(p_task_id);
  if v_workspace_id is null or v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;
  if v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role,
    'member'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 10000 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_COMMENT';
  end if;

  insert into public.task_comments (
    workspace_id,
    task_id,
    body,
    created_by
  ) values (
    v_workspace_id,
    p_task_id,
    btrim(p_body),
    v_actor
  )
  returning * into v_comment;

  return jsonb_build_object(
    'id', v_comment.id,
    'task_id', v_comment.task_id,
    'body', v_comment.body,
    'created_by', v_comment.created_by,
    'created_at', v_comment.created_at
  );
end;
$$;

create or replace function public.delete_task_comment(p_comment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_comment public.task_comments%rowtype;
begin
  select task_comment.*
  into v_comment
  from public.task_comments task_comment
  where task_comment.id = p_comment_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_COMMENT_NOT_FOUND';
  end if;
  v_role := private.task_collaboration_role(v_comment.task_id);
  if v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_COMMENT_NOT_FOUND';
  end if;
  if not (
    v_role in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'manager'::public.workspace_role
    )
    or (
      v_role = 'member'::public.workspace_role
      and v_comment.created_by = v_actor
    )
  ) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_comment.deleted_at is not null then
    return jsonb_build_object(
      'id', v_comment.id,
      'task_id', v_comment.task_id,
      'deleted', true,
      'deleted_at', v_comment.deleted_at
    );
  end if;

  update public.task_comments task_comment
  set
    body = null,
    deleted_by = v_actor,
    deleted_at = clock_timestamp()
  where task_comment.id = p_comment_id
  returning * into v_comment;

  return jsonb_build_object(
    'id', v_comment.id,
    'task_id', v_comment.task_id,
    'deleted', true,
    'deleted_at', v_comment.deleted_at
  );
end;
$$;

create or replace function public.add_task_link(
  p_task_id uuid,
  p_url text,
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_workspace_id uuid;
  v_role public.workspace_role;
  v_url text := btrim(p_url);
  v_label text := nullif(btrim(p_label), '');
  v_link public.task_links%rowtype;
begin
  select task.workspace_id
  into v_workspace_id
  from public.tasks task
  where task.id = p_task_id
    and task.archived_at is null;

  v_role := private.task_collaboration_role(p_task_id);
  if v_workspace_id is null or v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;
  if v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role,
    'member'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_url is null
    or char_length(v_url) not between 8 and 2048
    or v_url !~* '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
    or v_url ~* '%0d|%0a' then
    raise exception using errcode = '22023', message = 'PTA_INVALID_LINK_URL';
  end if;
  if v_label is not null and char_length(v_label) > 200 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_LINK_LABEL';
  end if;

  insert into public.task_links (
    workspace_id,
    task_id,
    url,
    label,
    created_by
  ) values (
    v_workspace_id,
    p_task_id,
    v_url,
    v_label,
    v_actor
  )
  returning * into v_link;

  return jsonb_build_object(
    'id', v_link.id,
    'task_id', v_link.task_id,
    'url', v_link.url,
    'label', v_link.label,
    'created_by', v_link.created_by,
    'created_at', v_link.created_at,
    'updated_at', v_link.updated_at
  );
end;
$$;

create or replace function public.update_task_link(
  p_link_id uuid,
  p_url text,
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_url text := btrim(p_url);
  v_label text := nullif(btrim(p_label), '');
  v_link public.task_links%rowtype;
begin
  select link.*
  into v_link
  from public.task_links link
  where link.id = p_link_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_LINK_NOT_FOUND';
  end if;
  v_role := private.task_collaboration_role(v_link.task_id);
  if v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_LINK_NOT_FOUND';
  end if;
  if not (
    v_role in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'manager'::public.workspace_role
    )
    or (
      v_role = 'member'::public.workspace_role
      and v_link.created_by = v_actor
    )
  ) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_url is null
    or char_length(v_url) not between 8 and 2048
    or v_url !~* '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
    or v_url ~* '%0d|%0a' then
    raise exception using errcode = '22023', message = 'PTA_INVALID_LINK_URL';
  end if;
  if v_label is not null and char_length(v_label) > 200 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_LINK_LABEL';
  end if;

  update public.task_links link
  set
    url = v_url,
    label = v_label,
    updated_at = clock_timestamp()
  where link.id = p_link_id
  returning * into v_link;

  return jsonb_build_object(
    'id', v_link.id,
    'task_id', v_link.task_id,
    'url', v_link.url,
    'label', v_link.label,
    'created_by', v_link.created_by,
    'created_at', v_link.created_at,
    'updated_at', v_link.updated_at
  );
end;
$$;

create or replace function public.remove_task_link(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_link public.task_links%rowtype;
begin
  select link.*
  into v_link
  from public.task_links link
  where link.id = p_link_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_LINK_NOT_FOUND';
  end if;
  v_role := private.task_collaboration_role(v_link.task_id);
  if v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_LINK_NOT_FOUND';
  end if;
  if v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role,
    'member'::public.workspace_role
  ) then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if v_role = 'member'::public.workspace_role
    and v_link.created_by <> v_actor then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;

  delete from public.task_links link
  where link.id = p_link_id;

  return jsonb_build_object(
    'id', v_link.id,
    'task_id', v_link.task_id,
    'removed', true
  );
end;
$$;

alter function private.task_collaboration_payload(uuid) owner to postgres;
alter function public.get_task_detail(uuid) owner to postgres;
alter function public.update_task_description(uuid, integer, jsonb) owner to postgres;
alter function public.create_task_checklist(uuid, text, numeric) owner to postgres;
alter function public.add_task_checklist_item(uuid, text, numeric) owner to postgres;
alter function public.toggle_task_checklist_item(uuid, boolean) owner to postgres;
alter function public.add_task_comment(uuid, text) owner to postgres;
alter function public.delete_task_comment(uuid) owner to postgres;
alter function public.add_task_link(uuid, text, text) owner to postgres;
alter function public.update_task_link(uuid, text, text) owner to postgres;
alter function public.remove_task_link(uuid) owner to postgres;

revoke all on function private.task_collaboration_payload(uuid)
from public, anon, authenticated;
revoke all on function public.get_task_detail(uuid)
from public, anon, authenticated;
revoke all on function public.update_task_description(uuid, integer, jsonb)
from public, anon, authenticated;
revoke all on function public.create_task_checklist(uuid, text, numeric)
from public, anon, authenticated;
revoke all on function public.add_task_checklist_item(uuid, text, numeric)
from public, anon, authenticated;
revoke all on function public.toggle_task_checklist_item(uuid, boolean)
from public, anon, authenticated;
revoke all on function public.add_task_comment(uuid, text)
from public, anon, authenticated;
revoke all on function public.delete_task_comment(uuid)
from public, anon, authenticated;
revoke all on function public.add_task_link(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.update_task_link(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.remove_task_link(uuid)
from public, anon, authenticated;

grant execute on function public.get_task_detail(uuid)
to authenticated;
grant execute on function public.update_task_description(uuid, integer, jsonb)
to authenticated;
grant execute on function public.create_task_checklist(uuid, text, numeric)
to authenticated;
grant execute on function public.add_task_checklist_item(uuid, text, numeric)
to authenticated;
grant execute on function public.toggle_task_checklist_item(uuid, boolean)
to authenticated;
grant execute on function public.add_task_comment(uuid, text)
to authenticated;
grant execute on function public.delete_task_comment(uuid)
to authenticated;
grant execute on function public.add_task_link(uuid, text, text)
to authenticated;
grant execute on function public.update_task_link(uuid, text, text)
to authenticated;
grant execute on function public.remove_task_link(uuid)
to authenticated;

comment on function public.get_task_detail(uuid) is
  'Returns task, activity, description, collaboration payload and granular capabilities in one request.';

commit;
