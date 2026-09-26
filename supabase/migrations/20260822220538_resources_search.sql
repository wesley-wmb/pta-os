-- PTA OS resource center and global search. URL-only V1, without exposed file fields.
begin;

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

create type public.resource_type as enum (
  'link',
  'document',
  'folder',
  'system',
  'dashboard',
  'page',
  'creative',
  'video'
);

create type public.resource_permission_level as enum ('view', 'edit');

create table public.resource_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  color text not null default 'stone',
  position integer not null default 0,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, id),
  unique (workspace_id, slug),
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint resource_categories_name_length
    check (char_length(btrim(name)) between 2 and 80),
  constraint resource_categories_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint resource_categories_position_valid check (position >= 0)
);

create unique index resource_categories_name_workspace_unique
  on public.resource_categories (workspace_id, lower(name));
create index resource_categories_workspace_active_position
  on public.resource_categories (workspace_id, position, name)
  where archived_at is null;

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text not null default 'stone',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, id),
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint tags_name_length check (char_length(btrim(name)) between 1 and 60)
);

create unique index tags_name_workspace_unique on public.tags (workspace_id, lower(name));
create index tags_workspace_active_name on public.tags (workspace_id, name)
  where archived_at is null;

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category_id uuid,
  resource_type public.resource_type not null default 'link',
  title text not null,
  description text,
  external_url text not null,
  is_restricted boolean not null default false,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid,
  version integer not null default 1,
  search_vector tsvector not null default ''::tsvector,
  unique (workspace_id, id),
  foreign key (workspace_id, category_id)
    references public.resource_categories(workspace_id, id) on delete restrict,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, updated_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  foreign key (workspace_id, archived_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint resources_title_length check (char_length(btrim(title)) between 2 and 180),
  constraint resources_description_length
    check (description is null or char_length(description) <= 5000),
  constraint resources_https_url check (
    char_length(external_url) between 12 and 2048
    and external_url ~ '^https://[^[:space:]/:?#@]+(?::[0-9]{1,5})?(?:[/?#][^[:space:]]*)?$'
    and (
      substring(external_url from '^https://[^/:?#@]+:([0-9]{1,5})(?:[/?#]|$)') is null
      or substring(external_url from '^https://[^/:?#@]+:([0-9]{1,5})(?:[/?#]|$)')::integer
        between 1 and 65535
    )
  ),
  constraint resources_version_valid check (version >= 1),
  constraint resources_archived_actor_consistent check (
    (archived_at is null and archived_by is null)
    or (archived_at is not null and archived_by is not null)
  )
);

create index resources_workspace_active_updated
  on public.resources (workspace_id, updated_at desc, id)
  where archived_at is null;
create index resources_workspace_category_active
  on public.resources (workspace_id, category_id, updated_at desc)
  where archived_at is null;
create index resources_workspace_type_active
  on public.resources (workspace_id, resource_type, updated_at desc)
  where archived_at is null;
create index resources_search_vector on public.resources using gin (search_vector);

create table public.resource_tasks (
  workspace_id uuid not null,
  resource_id uuid not null,
  task_id uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, resource_id, task_id),
  foreign key (workspace_id, resource_id)
    references public.resources(workspace_id, id) on delete cascade,
  foreign key (workspace_id, task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict
);

create index resource_tasks_task on public.resource_tasks (workspace_id, task_id, resource_id);

create table public.resource_products (
  workspace_id uuid not null,
  resource_id uuid not null,
  product_id uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, resource_id, product_id),
  foreign key (workspace_id, resource_id)
    references public.resources(workspace_id, id) on delete cascade,
  foreign key (workspace_id, product_id)
    references public.products(workspace_id, id) on delete cascade,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict
);

create index resource_products_product
  on public.resource_products (workspace_id, product_id, resource_id);

create table public.resource_events (
  workspace_id uuid not null,
  resource_id uuid not null,
  event_id uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, resource_id, event_id),
  foreign key (workspace_id, resource_id)
    references public.resources(workspace_id, id) on delete cascade,
  foreign key (workspace_id, event_id)
    references public.events(workspace_id, id) on delete cascade,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict
);

create index resource_events_event on public.resource_events (workspace_id, event_id, resource_id);

create table public.resource_tags (
  workspace_id uuid not null,
  resource_id uuid not null,
  tag_id uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, resource_id, tag_id),
  foreign key (workspace_id, resource_id)
    references public.resources(workspace_id, id) on delete cascade,
  foreign key (workspace_id, tag_id)
    references public.tags(workspace_id, id) on delete cascade,
  foreign key (workspace_id, created_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict
);

create index resource_tags_tag on public.resource_tags (workspace_id, tag_id, resource_id);

create table public.resource_permissions (
  workspace_id uuid not null,
  resource_id uuid not null,
  user_id uuid not null,
  permission public.resource_permission_level not null default 'view',
  granted_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, resource_id, user_id),
  foreign key (workspace_id, resource_id)
    references public.resources(workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id) on delete cascade,
  foreign key (workspace_id, granted_by)
    references public.workspace_members(workspace_id, user_id) on delete restrict,
  constraint resource_permissions_no_self_grant check (user_id <> granted_by)
);

create index resource_permissions_user
  on public.resource_permissions (workspace_id, user_id, resource_id);

create table public.resource_favorites (
  workspace_id uuid not null,
  resource_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, resource_id, user_id),
  foreign key (workspace_id, resource_id)
    references public.resources(workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id) on delete cascade
);

create index resource_favorites_user_created
  on public.resource_favorites (workspace_id, user_id, created_at desc);

create table public.resource_visits (
  workspace_id uuid not null,
  resource_id uuid not null,
  user_id uuid not null,
  first_visited_at timestamptz not null default now(),
  last_visited_at timestamptz not null default now(),
  visit_count integer not null default 1,
  primary key (workspace_id, resource_id, user_id),
  foreign key (workspace_id, resource_id)
    references public.resources(workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id) on delete cascade,
  constraint resource_visits_count_valid check (visit_count > 0)
);

create index resource_visits_user_recent
  on public.resource_visits (workspace_id, user_id, last_visited_at desc);

alter table public.products add column search_vector tsvector not null default ''::tsvector;
alter table public.events add column search_vector tsvector not null default ''::tsvector;
alter table public.profiles add column search_vector tsvector not null default ''::tsvector;

create index products_search_vector on public.products using gin (search_vector);
create index events_search_vector on public.events using gin (search_vector);
create index profiles_search_vector on public.profiles using gin (search_vector);

create or replace function private.is_valid_resource_url(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_url is not null
    and char_length(btrim(p_url)) between 12 and 2048
    and btrim(p_url) ~ '^https://[^[:space:]/:?#@]+(?::[0-9]{1,5})?(?:[/?#][^[:space:]]*)?$'
    and (
      substring(btrim(p_url) from '^https://[^/:?#@]+:([0-9]{1,5})(?:[/?#]|$)') is null
      or substring(btrim(p_url) from '^https://[^/:?#@]+:([0-9]{1,5})(?:[/?#]|$)')::integer
        between 1 and 65535
    );
$$;

create or replace function private.resource_search_vector(
  p_title text,
  p_description text,
  p_type public.resource_type,
  p_category_name text
)
returns tsvector
language sql
stable
set search_path = ''
as $$
  select
    setweight(
      to_tsvector(
        'pg_catalog.portuguese'::regconfig,
        extensions.unaccent(coalesce(p_title, ''))
      ),
      'A'
    )
    || setweight(
      to_tsvector(
        'pg_catalog.portuguese'::regconfig,
        extensions.unaccent(coalesce(p_description, ''))
      ),
      'B'
    )
    || setweight(
      to_tsvector(
        'pg_catalog.portuguese'::regconfig,
        extensions.unaccent(coalesce(p_category_name, ''))
      ),
      'B'
    )
    || setweight(
      to_tsvector('pg_catalog.simple'::regconfig, coalesce(p_type::text, '')),
      'C'
    );
$$;

create or replace function private.resources_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_category_name text;
begin
  new.title := btrim(new.title);
  new.description := nullif(btrim(new.description), '');
  new.external_url := btrim(new.external_url);

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, v_actor);
    new.updated_by := coalesce(new.updated_by, v_actor);
    new.version := 1;
  else
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := coalesce(v_actor, new.updated_by, old.updated_by);
    new.updated_at := clock_timestamp();
    new.version := old.version + 1;
  end if;

  if new.category_id is not null then
    select rc.name into v_category_name
    from public.resource_categories rc
    where rc.workspace_id = new.workspace_id
      and rc.id = new.category_id
      and rc.archived_at is null;

    if not found then
      raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_CATEGORY';
    end if;
  end if;

  new.search_vector := private.resource_search_vector(
    new.title,
    new.description,
    new.resource_type,
    v_category_name
  );

  return new;
end;
$$;

create trigger resources_before_write
  before insert or update on public.resources
  for each row execute function private.resources_before_write();

create or replace function private.resource_activity_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'resource.created';
  elsif old.archived_at is null and new.archived_at is not null then
    v_action := 'resource.archived';
  else
    v_action := 'resource.updated';
  end if;

  insert into public.activity_logs (
    workspace_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    changes_json,
    metadata_json
  ) values (
    new.workspace_id,
    (select auth.uid()),
    'resource',
    new.id,
    v_action,
    jsonb_build_object(
      'title', new.title,
      'resource_type', new.resource_type,
      'category_id', new.category_id,
      'is_restricted', new.is_restricted,
      'version', new.version
    ),
    '{}'::jsonb
  );

  return new;
end;
$$;

create trigger resource_activity_after_write
  after insert or update on public.resources
  for each row execute function private.resource_activity_after_write();

create or replace function private.products_search_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector := setweight(
    to_tsvector(
      'pg_catalog.portuguese'::regconfig,
      extensions.unaccent(coalesce(new.name, ''))
    ),
    'A'
  );
  return new;
end;
$$;

create trigger zz_products_search_before_write
  before insert or update on public.products
  for each row execute function private.products_search_before_write();

create or replace function private.events_search_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector := setweight(
    to_tsvector(
      'pg_catalog.portuguese'::regconfig,
      extensions.unaccent(coalesce(new.name, ''))
    ),
    'A'
  );
  return new;
end;
$$;

create trigger zz_events_search_before_write
  before insert or update on public.events
  for each row execute function private.events_search_before_write();

create or replace function private.profiles_search_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector := setweight(
    to_tsvector(
      'pg_catalog.portuguese'::regconfig,
      extensions.unaccent(coalesce(new.full_name, ''))
    ),
    'A'
  ) || setweight(
    to_tsvector(
      'pg_catalog.simple'::regconfig,
      extensions.unaccent(coalesce(new.initials, ''))
    ),
    'B'
  );
  return new;
end;
$$;

create trigger zz_profiles_search_before_write
  before insert or update on public.profiles
  for each row execute function private.profiles_search_before_write();

create or replace function private.tasks_search_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector := setweight(
    to_tsvector(
      'pg_catalog.portuguese'::regconfig,
      extensions.unaccent(coalesce(new.title, ''))
    ),
    'A'
  ) || setweight(
    to_tsvector('pg_catalog.simple'::regconfig, new.task_number::text),
    'A'
  );
  return new;
end;
$$;

create trigger zz_tasks_search_before_write
  before insert or update on public.tasks
  for each row execute function private.tasks_search_before_write();

-- Backfill search vectors without changing timestamps, task versions or activity.
alter table public.products disable trigger user;
update public.products
set search_vector = setweight(
  to_tsvector('pg_catalog.portuguese'::regconfig, extensions.unaccent(coalesce(name, ''))),
  'A'
);
alter table public.products enable trigger user;

alter table public.events disable trigger user;
update public.events
set search_vector = setweight(
  to_tsvector('pg_catalog.portuguese'::regconfig, extensions.unaccent(coalesce(name, ''))),
  'A'
);
alter table public.events enable trigger user;

alter table public.profiles disable trigger user;
update public.profiles
set search_vector = setweight(
  to_tsvector('pg_catalog.portuguese'::regconfig, extensions.unaccent(coalesce(full_name, ''))),
  'A'
) || setweight(
  to_tsvector('pg_catalog.simple'::regconfig, extensions.unaccent(coalesce(initials, ''))),
  'B'
);
alter table public.profiles enable trigger user;

alter table public.tasks disable trigger user;
update public.tasks
set search_vector = setweight(
  to_tsvector('pg_catalog.portuguese'::regconfig, extensions.unaccent(coalesce(title, ''))),
  'A'
) || setweight(
  to_tsvector('pg_catalog.simple'::regconfig, task_number::text),
  'A'
);
alter table public.tasks enable trigger user;

create or replace function private.can_view_resource(p_resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.resources r
    join public.workspace_members wm
      on wm.workspace_id = r.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'::public.membership_status
    join public.profiles own_profile
      on own_profile.id = wm.user_id
      and own_profile.is_active
    join public.workspaces w
      on w.id = r.workspace_id
      and w.archived_at is null
    where r.id = p_resource_id
      and (
        r.archived_at is null
        or wm.role in (
          'owner'::public.workspace_role,
          'admin'::public.workspace_role,
          'manager'::public.workspace_role
        )
      )
      and (
        not r.is_restricted
        or wm.role in ('owner'::public.workspace_role, 'admin'::public.workspace_role)
        or r.created_by = (select auth.uid())
        or exists (
          select 1
          from public.resource_permissions rp
          where rp.workspace_id = r.workspace_id
            and rp.resource_id = r.id
            and rp.user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function private.can_edit_resource(p_resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.resources r
    join public.workspace_members wm
      on wm.workspace_id = r.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'::public.membership_status
    join public.profiles own_profile
      on own_profile.id = wm.user_id
      and own_profile.is_active
    join public.workspaces w
      on w.id = r.workspace_id
      and w.archived_at is null
    where r.id = p_resource_id
      and r.archived_at is null
      and (
        wm.role in ('owner'::public.workspace_role, 'admin'::public.workspace_role)
        or (
          wm.role = 'manager'::public.workspace_role
          and (
            not r.is_restricted
            or r.created_by = (select auth.uid())
            or exists (
              select 1
              from public.resource_permissions rp
              where rp.workspace_id = r.workspace_id
                and rp.resource_id = r.id
                and rp.user_id = (select auth.uid())
                and rp.permission = 'edit'::public.resource_permission_level
            )
          )
        )
      )
  );
$$;

create or replace function private.jsonb_uuid_array(p_patch jsonb, p_key text)
returns uuid[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value jsonb := p_patch -> p_key;
  v_result uuid[];
begin
  if jsonb_typeof(v_value) <> 'array'
    or exists (
      select 1
      from jsonb_array_elements(v_value) item
      where jsonb_typeof(item) <> 'string'
        or trim(both '"' from item::text) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_PATCH';
  end if;

  select coalesce(array_agg(distinct value::uuid), '{}'::uuid[])
  into v_result
  from jsonb_array_elements_text(v_value) item(value);

  return v_result;
end;
$$;

create or replace function private.replace_resource_relations(
  p_workspace_id uuid,
  p_resource_id uuid,
  p_task_ids uuid[],
  p_product_ids uuid[],
  p_event_ids uuid[],
  p_tag_ids uuid[],
  p_permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.workspace_role;
begin
  v_role := private.current_workspace_role(p_workspace_id);

  if v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  ) then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  if p_task_ids is not null then
    if (select count(*) from public.tasks t
        where t.workspace_id = p_workspace_id
          and t.id = any(p_task_ids)
          and t.archived_at is null) <> cardinality(p_task_ids) then
      raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_RELATIONS';
    end if;

    delete from public.resource_tasks
    where workspace_id = p_workspace_id and resource_id = p_resource_id;

    insert into public.resource_tasks (workspace_id, resource_id, task_id, created_by)
    select p_workspace_id, p_resource_id, relation_id, v_actor
    from unnest(p_task_ids) relation_id;
  end if;

  if p_product_ids is not null then
    if (select count(*) from public.products p
        where p.workspace_id = p_workspace_id
          and p.id = any(p_product_ids)
          and p.archived_at is null) <> cardinality(p_product_ids) then
      raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_RELATIONS';
    end if;

    delete from public.resource_products
    where workspace_id = p_workspace_id and resource_id = p_resource_id;

    insert into public.resource_products (workspace_id, resource_id, product_id, created_by)
    select p_workspace_id, p_resource_id, relation_id, v_actor
    from unnest(p_product_ids) relation_id;
  end if;

  if p_event_ids is not null then
    if (select count(*) from public.events e
        where e.workspace_id = p_workspace_id
          and e.id = any(p_event_ids)
          and e.archived_at is null) <> cardinality(p_event_ids) then
      raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_RELATIONS';
    end if;

    delete from public.resource_events
    where workspace_id = p_workspace_id and resource_id = p_resource_id;

    insert into public.resource_events (workspace_id, resource_id, event_id, created_by)
    select p_workspace_id, p_resource_id, relation_id, v_actor
    from unnest(p_event_ids) relation_id;
  end if;

  if p_tag_ids is not null then
    if (select count(*) from public.tags tag
        where tag.workspace_id = p_workspace_id
          and tag.id = any(p_tag_ids)
          and tag.archived_at is null) <> cardinality(p_tag_ids) then
      raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_TAGS';
    end if;

    delete from public.resource_tags
    where workspace_id = p_workspace_id and resource_id = p_resource_id;

    insert into public.resource_tags (workspace_id, resource_id, tag_id, created_by)
    select p_workspace_id, p_resource_id, relation_id, v_actor
    from unnest(p_tag_ids) relation_id;
  end if;

  if p_permissions is not null then
    if jsonb_typeof(p_permissions) is distinct from 'array'
      or exists (
        select 1
        from jsonb_array_elements(p_permissions) permission_item
        where jsonb_typeof(permission_item) <> 'object'
          or not (permission_item ? 'user_id')
          or not (permission_item ? 'permission')
          or permission_item ->> 'user_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or permission_item ->> 'permission' not in ('view', 'edit')
          or exists (
            select 1 from jsonb_object_keys(permission_item) permission_key
            where permission_key not in ('user_id', 'permission')
          )
      ) then
      raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_PERMISSIONS';
    end if;

    if v_role not in ('owner'::public.workspace_role, 'admin'::public.workspace_role)
      and jsonb_array_length(p_permissions) > 0 then
      raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_permissions) permission_item
      left join public.workspace_members wm
        on wm.workspace_id = p_workspace_id
        and wm.user_id = (permission_item ->> 'user_id')::uuid
        and wm.status = 'active'::public.membership_status
      left join public.profiles profile
        on profile.id = wm.user_id
        and profile.is_active
      where wm.user_id is null
        or profile.id is null
        or wm.user_id = v_actor
        or (
          permission_item ->> 'permission' = 'edit'
          and wm.role <> 'manager'::public.workspace_role
        )
    ) then
      raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_PERMISSIONS';
    end if;

    delete from public.resource_permissions
    where workspace_id = p_workspace_id and resource_id = p_resource_id;

    insert into public.resource_permissions (
      workspace_id,
      resource_id,
      user_id,
      permission,
      granted_by
    )
    select distinct on ((permission_item ->> 'user_id')::uuid)
      p_workspace_id,
      p_resource_id,
      (permission_item ->> 'user_id')::uuid,
      (permission_item ->> 'permission')::public.resource_permission_level,
      v_actor
    from jsonb_array_elements(p_permissions) permission_item
    order by
      (permission_item ->> 'user_id')::uuid,
      case when permission_item ->> 'permission' = 'edit' then 0 else 1 end;
  end if;
end;
$$;

alter table public.resource_categories enable row level security;
alter table public.resource_categories force row level security;
alter table public.tags enable row level security;
alter table public.tags force row level security;
alter table public.resources enable row level security;
alter table public.resources force row level security;
alter table public.resource_tasks enable row level security;
alter table public.resource_tasks force row level security;
alter table public.resource_products enable row level security;
alter table public.resource_products force row level security;
alter table public.resource_events enable row level security;
alter table public.resource_events force row level security;
alter table public.resource_tags enable row level security;
alter table public.resource_tags force row level security;
alter table public.resource_permissions enable row level security;
alter table public.resource_permissions force row level security;
alter table public.resource_favorites enable row level security;
alter table public.resource_favorites force row level security;
alter table public.resource_visits enable row level security;
alter table public.resource_visits force row level security;

create policy resource_categories_select_member
on public.resource_categories for select to authenticated
using (private.is_active_workspace_member(workspace_id));

create policy tags_select_member
on public.tags for select to authenticated
using (private.is_active_workspace_member(workspace_id));

create policy resources_select_allowed
on public.resources for select to authenticated
using (private.can_view_resource(id));

create policy resource_tasks_select_allowed
on public.resource_tasks for select to authenticated
using (private.can_view_resource(resource_id));

create policy resource_products_select_allowed
on public.resource_products for select to authenticated
using (private.can_view_resource(resource_id));

create policy resource_events_select_allowed
on public.resource_events for select to authenticated
using (private.can_view_resource(resource_id));

create policy resource_tags_select_allowed
on public.resource_tags for select to authenticated
using (private.can_view_resource(resource_id));

create policy resource_permissions_select_allowed
on public.resource_permissions for select to authenticated
using (
  user_id = (select auth.uid())
  or private.current_workspace_role(workspace_id) in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role
  )
);

create policy resource_favorites_select_own
on public.resource_favorites for select to authenticated
using (
  user_id = (select auth.uid())
  and private.can_view_resource(resource_id)
);

create policy resource_visits_select_own
on public.resource_visits for select to authenticated
using (
  user_id = (select auth.uid())
  and private.can_view_resource(resource_id)
);

revoke all on table
  public.resource_categories,
  public.tags,
  public.resources,
  public.resource_tasks,
  public.resource_products,
  public.resource_events,
  public.resource_tags,
  public.resource_permissions,
  public.resource_favorites,
  public.resource_visits
from public, anon, authenticated;

create or replace function public.list_resources(
  p_workspace_id uuid,
  p_query text default null,
  p_category_id uuid default null,
  p_resource_type public.resource_type default null,
  p_only_favorites boolean default false,
  p_only_recent boolean default false,
  p_include_archived boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(p_query), '');
  v_limit integer := coalesce(p_limit, 50);
  v_offset integer := coalesce(p_offset, 0);
  v_tsquery tsquery;
  v_role public.workspace_role;
  v_result jsonb;
begin
  v_role := private.current_workspace_role(p_workspace_id);

  if p_workspace_id is null or v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  if v_limit < 1 or v_limit > 100 or v_offset < 0 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_PAGINATION';
  end if;

  if v_query is not null then
    if char_length(v_query) < 2 or char_length(v_query) > 100 then
      raise exception using errcode = '22023', message = 'PTA_INVALID_SEARCH_QUERY';
    end if;
    v_tsquery := websearch_to_tsquery(
      'pg_catalog.portuguese'::regconfig,
      extensions.unaccent(v_query)
    );
  end if;

  with matching as (
    select
      r.*,
      rc.name as category_name,
      rc.color as category_color,
      exists (
        select 1 from public.resource_favorites favorite
        where favorite.workspace_id = r.workspace_id
          and favorite.resource_id = r.id
          and favorite.user_id = (select auth.uid())
      ) as is_favorite,
      visit.last_visited_at
    from public.resources r
    left join public.resource_categories rc
      on rc.workspace_id = r.workspace_id and rc.id = r.category_id
    left join public.resource_visits visit
      on visit.workspace_id = r.workspace_id
      and visit.resource_id = r.id
      and visit.user_id = (select auth.uid())
    where r.workspace_id = p_workspace_id
      and private.can_view_resource(r.id)
      and (
        r.archived_at is null
        or (
          p_include_archived
          and v_role in (
            'owner'::public.workspace_role,
            'admin'::public.workspace_role,
            'manager'::public.workspace_role
          )
        )
      )
      and (p_category_id is null or r.category_id = p_category_id)
      and (p_resource_type is null or r.resource_type = p_resource_type)
      and (
        not p_only_favorites
        or exists (
          select 1 from public.resource_favorites favorite
          where favorite.workspace_id = r.workspace_id
            and favorite.resource_id = r.id
            and favorite.user_id = (select auth.uid())
        )
      )
      and (not p_only_recent or visit.resource_id is not null)
      and (v_tsquery is null or r.search_vector @@ v_tsquery)
  ), filtered as (
    select * from matching
    order by
      case when p_only_recent then matching.last_visited_at end desc nulls last,
      matching.updated_at desc,
      matching.id desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', filtered.id,
          'workspace_id', filtered.workspace_id,
          'title', filtered.title,
          'description', filtered.description,
          'resource_type', filtered.resource_type,
          'external_url', filtered.external_url,
          'category', case when filtered.category_id is null then null else jsonb_build_object(
            'id', filtered.category_id,
            'name', filtered.category_name,
            'color', filtered.category_color
          ) end,
          'is_restricted', filtered.is_restricted,
          'is_favorite', filtered.is_favorite,
          'last_visited_at', filtered.last_visited_at,
          'version', filtered.version,
          'updated_at', filtered.updated_at,
          'archived_at', filtered.archived_at,
          'can_edit', private.can_edit_resource(filtered.id)
        ) order by
          case when p_only_recent then filtered.last_visited_at end desc nulls last,
          filtered.updated_at desc,
          filtered.id desc
      ),
      '[]'::jsonb
    ),
    'total', (select count(*) from matching),
    'limit', v_limit,
    'offset', v_offset,
    'facets', jsonb_build_object(
      'categories', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', category.id,
            'name', category.name,
            'color', category.color
          ) order by category.position, category.name
        )
        from public.resource_categories category
        where category.workspace_id = p_workspace_id
          and category.archived_at is null
      ), '[]'::jsonb),
      'resource_types', to_jsonb(enum_range(null::public.resource_type))
    )
  )
  into v_result
  from filtered;

  return v_result;
end;
$$;

create or replace function public.get_resource_detail(p_resource_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_resource public.resources%rowtype;
  v_role public.workspace_role;
  v_result jsonb;
begin
  if p_resource_id is null or not private.can_view_resource(p_resource_id) then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  select * into v_resource from public.resources where id = p_resource_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  v_role := private.current_workspace_role(v_resource.workspace_id);

  select jsonb_build_object(
    'resource', jsonb_build_object(
      'id', v_resource.id,
      'workspace_id', v_resource.workspace_id,
      'title', v_resource.title,
      'description', v_resource.description,
      'resource_type', v_resource.resource_type,
      'external_url', v_resource.external_url,
      'is_restricted', v_resource.is_restricted,
      'version', v_resource.version,
      'created_by', v_resource.created_by,
      'created_at', v_resource.created_at,
      'updated_at', v_resource.updated_at,
      'archived_at', v_resource.archived_at,
      'category', (
        select jsonb_build_object('id', rc.id, 'name', rc.name, 'color', rc.color)
        from public.resource_categories rc
        where rc.workspace_id = v_resource.workspace_id and rc.id = v_resource.category_id
      ),
      'is_favorite', exists (
        select 1 from public.resource_favorites favorite
        where favorite.workspace_id = v_resource.workspace_id
          and favorite.resource_id = v_resource.id
          and favorite.user_id = (select auth.uid())
      ),
      'last_visited_at', (
        select visit.last_visited_at from public.resource_visits visit
        where visit.workspace_id = v_resource.workspace_id
          and visit.resource_id = v_resource.id
          and visit.user_id = (select auth.uid())
      )
    ),
    'relations', jsonb_build_object(
      'tasks', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', task.id,
          'task_key', workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0'),
          'title', task.title
        ) order by task.task_number)
        from public.resource_tasks relation
        join public.tasks task
          on task.workspace_id = relation.workspace_id and task.id = relation.task_id
        join public.workspaces workspace on workspace.id = task.workspace_id
        where relation.workspace_id = v_resource.workspace_id
          and relation.resource_id = v_resource.id
      ), '[]'::jsonb),
      'products', coalesce((
        select jsonb_agg(jsonb_build_object('id', product.id, 'name', product.name) order by product.name)
        from public.resource_products relation
        join public.products product
          on product.workspace_id = relation.workspace_id and product.id = relation.product_id
        where relation.workspace_id = v_resource.workspace_id
          and relation.resource_id = v_resource.id
      ), '[]'::jsonb),
      'events', coalesce((
        select jsonb_agg(jsonb_build_object('id', event.id, 'name', event.name) order by event.name)
        from public.resource_events relation
        join public.events event
          on event.workspace_id = relation.workspace_id and event.id = relation.event_id
        where relation.workspace_id = v_resource.workspace_id
          and relation.resource_id = v_resource.id
      ), '[]'::jsonb),
      'tags', coalesce((
        select jsonb_agg(jsonb_build_object('id', tag.id, 'name', tag.name, 'color', tag.color) order by tag.name)
        from public.resource_tags relation
        join public.tags tag
          on tag.workspace_id = relation.workspace_id and tag.id = relation.tag_id
        where relation.workspace_id = v_resource.workspace_id
          and relation.resource_id = v_resource.id
      ), '[]'::jsonb)
    ),
    'permissions', case
      when v_role in ('owner'::public.workspace_role, 'admin'::public.workspace_role) then coalesce((
        select jsonb_agg(jsonb_build_object(
          'user_id', permission.user_id,
          'full_name', profile.full_name,
          'permission', permission.permission
        ) order by profile.full_name)
        from public.resource_permissions permission
        join public.profiles profile on profile.id = permission.user_id
        where permission.workspace_id = v_resource.workspace_id
          and permission.resource_id = v_resource.id
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'capabilities', jsonb_build_object(
      'can_edit', private.can_edit_resource(v_resource.id),
      'can_manage_permissions', v_role in (
        'owner'::public.workspace_role,
        'admin'::public.workspace_role
      ),
      'can_archive', private.can_edit_resource(v_resource.id)
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.create_resource(
  p_workspace_id uuid,
  p_title text,
  p_external_url text,
  p_resource_type public.resource_type default 'link'::public.resource_type,
  p_description text default null,
  p_category_id uuid default null,
  p_is_restricted boolean default false,
  p_task_ids uuid[] default '{}'::uuid[],
  p_product_ids uuid[] default '{}'::uuid[],
  p_event_ids uuid[] default '{}'::uuid[],
  p_tag_ids uuid[] default '{}'::uuid[],
  p_permissions jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.workspace_role;
  v_resource_id uuid;
  v_task_ids uuid[] := array(select distinct value from unnest(coalesce(p_task_ids, '{}'::uuid[])) value);
  v_product_ids uuid[] := array(select distinct value from unnest(coalesce(p_product_ids, '{}'::uuid[])) value);
  v_event_ids uuid[] := array(select distinct value from unnest(coalesce(p_event_ids, '{}'::uuid[])) value);
  v_tag_ids uuid[] := array(select distinct value from unnest(coalesce(p_tag_ids, '{}'::uuid[])) value);
begin
  v_role := private.current_workspace_role(p_workspace_id);

  if p_workspace_id is null or v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role
  ) then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 2 and 180 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_TITLE';
  end if;

  if p_description is not null and char_length(p_description) > 5000 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_DESCRIPTION';
  end if;

  if not private.is_valid_resource_url(p_external_url) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_URL';
  end if;

  if p_permissions is null
    or jsonb_typeof(p_permissions) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_PERMISSIONS';
  end if;

  if v_role = 'manager'::public.workspace_role and jsonb_array_length(p_permissions) > 0 then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  insert into public.resources (
    workspace_id,
    category_id,
    resource_type,
    title,
    description,
    external_url,
    is_restricted,
    created_by,
    updated_by
  ) values (
    p_workspace_id,
    p_category_id,
    p_resource_type,
    p_title,
    p_description,
    p_external_url,
    p_is_restricted,
    v_actor,
    v_actor
  ) returning id into v_resource_id;

  perform private.replace_resource_relations(
    p_workspace_id,
    v_resource_id,
    v_task_ids,
    v_product_ids,
    v_event_ids,
    v_tag_ids,
    p_permissions
  );

  return public.get_resource_detail(v_resource_id);
end;
$$;

create or replace function public.update_resource(
  p_resource_id uuid,
  p_expected_version integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resource public.resources%rowtype;
  v_role public.workspace_role;
  v_category_id uuid;
  v_type public.resource_type;
  v_task_ids uuid[];
  v_product_ids uuid[];
  v_event_ids uuid[];
  v_tag_ids uuid[];
  v_permissions jsonb;
begin
  if p_resource_id is null or not private.can_edit_resource(p_resource_id) then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;

  if p_patch is null
    or jsonb_typeof(p_patch) is distinct from 'object'
    or p_patch = '{}'::jsonb
    or exists (
      select 1 from jsonb_object_keys(p_patch) patch_key
      where patch_key not in (
        'title',
        'description',
        'external_url',
        'resource_type',
        'category_id',
        'is_restricted',
        'task_ids',
        'product_ids',
        'event_ids',
        'tag_ids',
        'permissions'
      )
    ) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_PATCH';
  end if;

  select * into v_resource
  from public.resources
  where id = p_resource_id and archived_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  v_role := private.current_workspace_role(v_resource.workspace_id);

  if p_patch ? 'title'
    and (
      jsonb_typeof(p_patch -> 'title') <> 'string'
      or char_length(btrim(p_patch ->> 'title')) not between 2 and 180
    ) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_TITLE';
  end if;

  if p_patch ? 'description'
    and p_patch -> 'description' <> 'null'::jsonb
    and (
      jsonb_typeof(p_patch -> 'description') <> 'string'
      or char_length(p_patch ->> 'description') > 5000
    ) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_DESCRIPTION';
  end if;

  if p_patch ? 'external_url'
    and (
      jsonb_typeof(p_patch -> 'external_url') <> 'string'
      or not private.is_valid_resource_url(p_patch ->> 'external_url')
    ) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_URL';
  end if;

  if p_patch ? 'resource_type' then
    if jsonb_typeof(p_patch -> 'resource_type') <> 'string'
      or not exists (
        select 1
        from unnest(enum_range(null::public.resource_type)) allowed_type
        where allowed_type::text = p_patch ->> 'resource_type'
      ) then
      raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_TYPE';
    end if;
    v_type := (p_patch ->> 'resource_type')::public.resource_type;
  end if;

  if p_patch ? 'category_id' then
    if p_patch -> 'category_id' = 'null'::jsonb then
      v_category_id := null;
    elsif jsonb_typeof(p_patch -> 'category_id') <> 'string'
      or p_patch ->> 'category_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_CATEGORY';
    else
      v_category_id := (p_patch ->> 'category_id')::uuid;
    end if;
  end if;

  if p_patch ? 'is_restricted'
    and jsonb_typeof(p_patch -> 'is_restricted') <> 'boolean' then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_RESTRICTION';
  end if;

  if p_patch ? 'is_restricted'
    and v_role not in ('owner'::public.workspace_role, 'admin'::public.workspace_role)
    and (p_patch ->> 'is_restricted')::boolean is distinct from v_resource.is_restricted then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  if p_patch ? 'task_ids' then v_task_ids := private.jsonb_uuid_array(p_patch, 'task_ids'); end if;
  if p_patch ? 'product_ids' then v_product_ids := private.jsonb_uuid_array(p_patch, 'product_ids'); end if;
  if p_patch ? 'event_ids' then v_event_ids := private.jsonb_uuid_array(p_patch, 'event_ids'); end if;
  if p_patch ? 'tag_ids' then v_tag_ids := private.jsonb_uuid_array(p_patch, 'tag_ids'); end if;

  if p_patch ? 'permissions' then
    if v_role not in ('owner'::public.workspace_role, 'admin'::public.workspace_role) then
      raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
    end if;
    v_permissions := p_patch -> 'permissions';
  end if;

  update public.resources
  set
    title = case when p_patch ? 'title' then p_patch ->> 'title' else title end,
    description = case
      when not (p_patch ? 'description') then description
      when p_patch -> 'description' = 'null'::jsonb then null
      else p_patch ->> 'description'
    end,
    external_url = case when p_patch ? 'external_url' then p_patch ->> 'external_url' else external_url end,
    resource_type = coalesce(v_type, resource_type),
    category_id = case when p_patch ? 'category_id' then v_category_id else category_id end,
    is_restricted = case
      when p_patch ? 'is_restricted' then (p_patch ->> 'is_restricted')::boolean
      else is_restricted
    end
  where id = p_resource_id
    and version = p_expected_version
    and archived_at is null;

  if not found then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  perform private.replace_resource_relations(
    v_resource.workspace_id,
    p_resource_id,
    v_task_ids,
    v_product_ids,
    v_event_ids,
    v_tag_ids,
    v_permissions
  );

  return public.get_resource_detail(p_resource_id);
end;
$$;

create or replace function public.archive_resource(
  p_resource_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_resource_id is null or not private.can_edit_resource(p_resource_id) then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;

  update public.resources
  set archived_at = clock_timestamp(), archived_by = (select auth.uid())
  where id = p_resource_id
    and archived_at is null
    and version = p_expected_version;

  if not found then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  return public.get_resource_detail(p_resource_id);
end;
$$;

create or replace function public.set_resource_favorite(
  p_resource_id uuid,
  p_is_favorite boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  if p_resource_id is null
    or p_is_favorite is null
    or not private.can_view_resource(p_resource_id) then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  select workspace_id into v_workspace_id from public.resources where id = p_resource_id;

  if p_is_favorite then
    insert into public.resource_favorites (workspace_id, resource_id, user_id)
    values (v_workspace_id, p_resource_id, (select auth.uid()))
    on conflict (workspace_id, resource_id, user_id) do nothing;
  else
    delete from public.resource_favorites
    where workspace_id = v_workspace_id
      and resource_id = p_resource_id
      and user_id = (select auth.uid());
  end if;

  return jsonb_build_object('resource_id', p_resource_id, 'is_favorite', p_is_favorite);
end;
$$;

create or replace function public.record_resource_visit(p_resource_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_last_visited_at timestamptz;
begin
  if p_resource_id is null or not private.can_view_resource(p_resource_id) then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  select workspace_id into v_workspace_id from public.resources where id = p_resource_id;

  insert into public.resource_visits (
    workspace_id,
    resource_id,
    user_id,
    first_visited_at,
    last_visited_at,
    visit_count
  ) values (
    v_workspace_id,
    p_resource_id,
    (select auth.uid()),
    clock_timestamp(),
    clock_timestamp(),
    1
  )
  on conflict (workspace_id, resource_id, user_id) do update
    set last_visited_at = clock_timestamp(),
        visit_count = public.resource_visits.visit_count + 1
  returning last_visited_at into v_last_visited_at;

  return jsonb_build_object(
    'resource_id', p_resource_id,
    'last_visited_at', v_last_visited_at
  );
end;
$$;

create or replace function public.search_workspace(
  p_workspace_id uuid,
  p_query text,
  p_limit_per_group integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := btrim(coalesce(p_query, ''));
  v_normalized_query text;
  v_tsquery tsquery;
  v_role public.workspace_role;
  v_result jsonb;
begin
  v_role := private.current_workspace_role(p_workspace_id);

  if p_workspace_id is null or v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  if char_length(v_query) < 2 or char_length(v_query) > 100 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_SEARCH_QUERY';
  end if;

  if p_limit_per_group < 1 or p_limit_per_group > 20 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_SEARCH_LIMIT';
  end if;

  v_normalized_query := lower(extensions.unaccent(v_query));
  v_tsquery := websearch_to_tsquery(
    'pg_catalog.portuguese'::regconfig,
    extensions.unaccent(v_query)
  );

  with candidates as (
    select
      'task'::text as entity_type,
      'Demandas'::text as group_label,
      1 as group_order,
      task.id as entity_id,
      task.title,
      workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0')
        || ' · ' || status.name as subtitle,
      '/tarefa/' || task.id::text as href,
      (
        case
          when lower(extensions.unaccent(task.title)) = v_normalized_query then 100
          when lower(workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0')) = v_normalized_query then 100
          when lower(extensions.unaccent(task.title)) like v_normalized_query || '%' then 50
          else 0
        end
        + ts_rank_cd(task.search_vector, v_tsquery) * 10
      )::real as score
    from public.tasks task
    join public.workspaces workspace on workspace.id = task.workspace_id
    join public.task_statuses status
      on status.workspace_id = task.workspace_id and status.id = task.status_id
    where task.workspace_id = p_workspace_id
      and task.archived_at is null
      and (
        task.search_vector @@ v_tsquery
        or lower(workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0')) = v_normalized_query
        or lpad(task.task_number::text, 6, '0') = v_normalized_query
        or task.task_number::text = v_normalized_query
      )

    union all

    select
      'event'::text,
      'Eventos'::text,
      2,
      event.id,
      event.name,
      case
        when event.start_date is null then 'Evento'
        else 'Evento · ' || to_char(event.start_date, 'DD/MM/YYYY')
      end,
      '/eventos?evento=' || event.id::text,
      (
        case
          when lower(extensions.unaccent(event.name)) = v_normalized_query then 100
          when lower(extensions.unaccent(event.name)) like v_normalized_query || '%' then 50
          else 0
        end
        + ts_rank_cd(event.search_vector, v_tsquery) * 10
      )::real
    from public.events event
    where event.workspace_id = p_workspace_id
      and event.archived_at is null
      and event.search_vector @@ v_tsquery

    union all

    select
      'product'::text,
      'Produtos'::text,
      3,
      product.id,
      product.name,
      'Produto'::text,
      '/produtos?produto=' || product.id::text,
      (
        case
          when lower(extensions.unaccent(product.name)) = v_normalized_query then 100
          when lower(extensions.unaccent(product.name)) like v_normalized_query || '%' then 50
          else 0
        end
        + ts_rank_cd(product.search_vector, v_tsquery) * 10
      )::real
    from public.products product
    where product.workspace_id = p_workspace_id
      and product.archived_at is null
      and product.search_vector @@ v_tsquery

    union all

    select
      'resource'::text,
      'Recursos'::text,
      4,
      resource.id,
      resource.title,
      coalesce(category.name || ' · ', '') || resource.resource_type::text,
      '/recursos?recurso=' || resource.id::text,
      (
        case
          when lower(extensions.unaccent(resource.title)) = v_normalized_query then 100
          when lower(extensions.unaccent(resource.title)) like v_normalized_query || '%' then 50
          else 0
        end
        + ts_rank_cd(resource.search_vector, v_tsquery) * 10
      )::real
    from public.resources resource
    left join public.resource_categories category
      on category.workspace_id = resource.workspace_id and category.id = resource.category_id
    where resource.workspace_id = p_workspace_id
      and resource.archived_at is null
      and private.can_view_resource(resource.id)
      and resource.search_vector @@ v_tsquery

    union all

    select
      'person'::text,
      'Pessoas'::text,
      5,
      profile.id,
      profile.full_name,
      case member.role
        when 'owner'::public.workspace_role then 'Proprietário'
        when 'admin'::public.workspace_role then 'Administrador'
        when 'manager'::public.workspace_role then 'Gestor'
        when 'member'::public.workspace_role then 'Membro'
        else 'Visualizador'
      end,
      '/equipe?membro=' || profile.id::text,
      (
        case
          when lower(extensions.unaccent(profile.full_name)) = v_normalized_query then 100
          when lower(extensions.unaccent(profile.full_name)) like v_normalized_query || '%' then 50
          else 0
        end
        + ts_rank_cd(profile.search_vector, v_tsquery) * 10
      )::real
    from public.workspace_members member
    join public.profiles profile on profile.id = member.user_id and profile.is_active
    where member.workspace_id = p_workspace_id
      and member.status = 'active'::public.membership_status
      and profile.search_vector @@ v_tsquery
      and (
        v_role in (
          'owner'::public.workspace_role,
          'admin'::public.workspace_role,
          'manager'::public.workspace_role
        )
        or (
          v_role = 'member'::public.workspace_role
          and member.user_id = (select auth.uid())
        )
      )
  ), ranked as (
    select
      candidates.*,
      row_number() over (
        partition by candidates.entity_type
        order by candidates.score desc, candidates.title, candidates.entity_id
      ) as group_position
    from candidates
  ), groups as (
    select
      ranked.entity_type,
      ranked.group_label,
      ranked.group_order,
      jsonb_agg(
        jsonb_build_object(
          'id', ranked.entity_id,
          'title', ranked.title,
          'subtitle', ranked.subtitle,
          'href', ranked.href,
          'score', ranked.score
        ) order by ranked.score desc, ranked.title, ranked.entity_id
      ) as items
    from ranked
    where ranked.group_position <= p_limit_per_group
    group by ranked.entity_type, ranked.group_label, ranked.group_order
  )
  select jsonb_build_object(
    'query', v_query,
    'groups', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'entity_type', groups.entity_type,
          'label', groups.group_label,
          'items', groups.items
        ) order by groups.group_order
      ),
      '[]'::jsonb
    ),
    'total', (select count(*) from ranked)
  ) into v_result
  from groups;

  return v_result;
end;
$$;

alter function private.is_valid_resource_url(text) owner to postgres;
alter function private.resource_search_vector(text, text, public.resource_type, text) owner to postgres;
alter function private.resources_before_write() owner to postgres;
alter function private.resource_activity_after_write() owner to postgres;
alter function private.products_search_before_write() owner to postgres;
alter function private.events_search_before_write() owner to postgres;
alter function private.profiles_search_before_write() owner to postgres;
alter function private.tasks_search_before_write() owner to postgres;
alter function private.can_view_resource(uuid) owner to postgres;
alter function private.can_edit_resource(uuid) owner to postgres;
alter function private.jsonb_uuid_array(jsonb, text) owner to postgres;
alter function private.replace_resource_relations(uuid, uuid, uuid[], uuid[], uuid[], uuid[], jsonb)
  owner to postgres;

alter function public.list_resources(
  uuid, text, uuid, public.resource_type, boolean, boolean, boolean, integer, integer
) owner to postgres;
alter function public.get_resource_detail(uuid) owner to postgres;
alter function public.create_resource(
  uuid, text, text, public.resource_type, text, uuid, boolean, uuid[], uuid[], uuid[], uuid[], jsonb
) owner to postgres;
alter function public.update_resource(uuid, integer, jsonb) owner to postgres;
alter function public.archive_resource(uuid, integer) owner to postgres;
alter function public.set_resource_favorite(uuid, boolean) owner to postgres;
alter function public.record_resource_visit(uuid) owner to postgres;
alter function public.search_workspace(uuid, text, integer) owner to postgres;

revoke all on function private.is_valid_resource_url(text) from public, anon, authenticated;
revoke all on function private.resource_search_vector(text, text, public.resource_type, text)
  from public, anon, authenticated;
revoke all on function private.resources_before_write() from public, anon, authenticated;
revoke all on function private.resource_activity_after_write() from public, anon, authenticated;
revoke all on function private.products_search_before_write() from public, anon, authenticated;
revoke all on function private.events_search_before_write() from public, anon, authenticated;
revoke all on function private.profiles_search_before_write() from public, anon, authenticated;
revoke all on function private.tasks_search_before_write() from public, anon, authenticated;
revoke all on function private.can_view_resource(uuid) from public, anon, authenticated;
revoke all on function private.can_edit_resource(uuid) from public, anon, authenticated;
revoke all on function private.jsonb_uuid_array(jsonb, text) from public, anon, authenticated;
revoke all on function private.replace_resource_relations(uuid, uuid, uuid[], uuid[], uuid[], uuid[], jsonb)
  from public, anon, authenticated;

revoke all on function public.list_resources(
  uuid, text, uuid, public.resource_type, boolean, boolean, boolean, integer, integer
) from public, anon, authenticated;
revoke all on function public.get_resource_detail(uuid) from public, anon, authenticated;
revoke all on function public.create_resource(
  uuid, text, text, public.resource_type, text, uuid, boolean, uuid[], uuid[], uuid[], uuid[], jsonb
) from public, anon, authenticated;
revoke all on function public.update_resource(uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.archive_resource(uuid, integer) from public, anon, authenticated;
revoke all on function public.set_resource_favorite(uuid, boolean) from public, anon, authenticated;
revoke all on function public.record_resource_visit(uuid) from public, anon, authenticated;
revoke all on function public.search_workspace(uuid, text, integer) from public, anon, authenticated;

grant execute on function public.list_resources(
  uuid, text, uuid, public.resource_type, boolean, boolean, boolean, integer, integer
) to authenticated;
grant execute on function public.get_resource_detail(uuid) to authenticated;
grant execute on function public.create_resource(
  uuid, text, text, public.resource_type, text, uuid, boolean, uuid[], uuid[], uuid[], uuid[], jsonb
) to authenticated;
grant execute on function public.update_resource(uuid, integer, jsonb) to authenticated;
grant execute on function public.archive_resource(uuid, integer) to authenticated;
grant execute on function public.set_resource_favorite(uuid, boolean) to authenticated;
grant execute on function public.record_resource_visit(uuid) to authenticated;
grant execute on function public.search_workspace(uuid, text, integer) to authenticated;

comment on table public.resources is
  'URL-only resources for V1. The external URL is never included in FTS or activity logs.';
comment on function public.list_resources(
  uuid, text, uuid, public.resource_type, boolean, boolean, boolean, integer, integer
) is 'Lists only resources visible to the caller, with URL, filters, favorites and recency.';
comment on function public.get_resource_detail(uuid) is
  'Returns one sanitized resource DTO and non-enumerable not-found errors.';
comment on function public.create_resource(
  uuid, text, text, public.resource_type, text, uuid, boolean, uuid[], uuid[], uuid[], uuid[], jsonb
) is 'Creates an HTTPS resource and its relations atomically for owner, admin or manager.';
comment on function public.update_resource(uuid, integer, jsonb) is
  'Updates a resource and replaces supplied relation arrays with optimistic version checking.';
comment on function public.archive_resource(uuid, integer) is
  'Soft-archives a resource with optimistic version checking.';
comment on function public.search_workspace(uuid, text, integer) is
  'Accent-insensitive grouped FTS across tasks, events, products, visible resources and openable people.';

commit;
