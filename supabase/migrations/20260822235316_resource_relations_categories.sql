-- PTA OS resource relations, indexed discovery and category management.
-- Hosted migration version: 20260822235316.
begin;

create or replace function private.resource_search_vector_v2(
  p_resource_id uuid,
  p_title text,
  p_description text,
  p_type public.resource_type,
  p_workspace_id uuid,
  p_category_id uuid
)
returns tsvector
language sql
stable
security definer
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
        extensions.unaccent(
          concat_ws(
            ' ',
            coalesce(p_description, ''),
            coalesce((
              select category.name
              from public.resource_categories category
              where category.workspace_id = p_workspace_id
                and category.id = p_category_id
                and category.archived_at is null
            ), ''),
            coalesce((
              select string_agg(product.name, ' ' order by product.name)
              from public.resource_products relation
              join public.products product
                on product.workspace_id = relation.workspace_id
                and product.id = relation.product_id
                and product.archived_at is null
              where relation.workspace_id = p_workspace_id
                and relation.resource_id = p_resource_id
            ), ''),
            coalesce((
              select string_agg(event.name, ' ' order by event.name)
              from public.resource_events relation
              join public.events event
                on event.workspace_id = relation.workspace_id
                and event.id = relation.event_id
                and event.archived_at is null
              where relation.workspace_id = p_workspace_id
                and relation.resource_id = p_resource_id
            ), ''),
            coalesce((
              select string_agg(tag.name, ' ' order by tag.name)
              from public.resource_tags relation
              join public.tags tag
                on tag.workspace_id = relation.workspace_id
                and tag.id = relation.tag_id
                and tag.archived_at is null
              where relation.workspace_id = p_workspace_id
                and relation.resource_id = p_resource_id
            ), '')
          )
        )
      ),
      'B'
    )
    || setweight(
      to_tsvector(
        'pg_catalog.portuguese'::regconfig,
        extensions.unaccent(coalesce((
          select string_agg(
            task.title || ' ' || workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0'),
            ' '
            order by task.task_number
          )
          from public.resource_tasks relation
          join public.tasks task
            on task.workspace_id = relation.workspace_id
            and task.id = relation.task_id
            and task.archived_at is null
          join public.workspaces workspace on workspace.id = task.workspace_id
          where relation.workspace_id = p_workspace_id
            and relation.resource_id = p_resource_id
        ), ''))
      ),
      'C'
    )
    || setweight(
      to_tsvector('pg_catalog.simple'::regconfig, coalesce(p_type::text, '')),
      'C'
    );
$$;

create or replace function private.lock_resource_category_write(
  p_workspace_id uuid,
  p_category_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_workspace_id is null or p_category_id is null then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'pta:resource-category-write:'
        || p_workspace_id::text || ':' || p_category_id::text,
      0
    )
  );
end;
$$;

create or replace function private.resources_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_category_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.search_vector is distinct from old.search_vector
    and new.category_id is not distinct from old.category_id
    and new.resource_type is not distinct from old.resource_type
    and new.title is not distinct from old.title
    and new.description is not distinct from old.description
    and new.external_url is not distinct from old.external_url
    and new.is_restricted is not distinct from old.is_restricted
    and new.archived_at is not distinct from old.archived_at
    and new.archived_by is not distinct from old.archived_by
    and new.version is not distinct from old.version
    and new.updated_at is not distinct from old.updated_at
    and new.updated_by is not distinct from old.updated_by then
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    return new;
  end if;

  new.title := btrim(new.title);
  new.description := nullif(btrim(new.description), '');
  new.external_url := btrim(new.external_url);

  if tg_op = 'INSERT' then
    perform private.lock_resource_category_write(new.workspace_id, new.category_id);
  else
    for v_category_id in
      select candidate.category_id
      from (
        values (old.category_id), (new.category_id)
      ) as candidate(category_id)
      where candidate.category_id is not null
      group by candidate.category_id
      order by candidate.category_id
    loop
      perform private.lock_resource_category_write(new.workspace_id, v_category_id);
    end loop;
  end if;

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

  if new.category_id is not null
    and not exists (
      select 1
      from public.resource_categories category
      where category.workspace_id = new.workspace_id
        and category.id = new.category_id
        and category.archived_at is null
    ) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_CATEGORY';
  end if;

  new.search_vector := private.resource_search_vector_v2(
    new.id,
    new.title,
    new.description,
    new.resource_type,
    new.workspace_id,
    new.category_id
  );

  return new;
end;
$$;

create or replace function private.resource_activity_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if tg_op = 'UPDATE'
    and new.search_vector is distinct from old.search_vector
    and new.category_id is not distinct from old.category_id
    and new.resource_type is not distinct from old.resource_type
    and new.title is not distinct from old.title
    and new.description is not distinct from old.description
    and new.external_url is not distinct from old.external_url
    and new.is_restricted is not distinct from old.is_restricted
    and new.archived_at is not distinct from old.archived_at
    and new.archived_by is not distinct from old.archived_by
    and new.version is not distinct from old.version
    and new.updated_at is not distinct from old.updated_at
    and new.updated_by is not distinct from old.updated_by then
    return new;
  end if;

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

create or replace function private.refresh_resource_search_vector(p_resource_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_category_id uuid;
begin
  select resource.workspace_id, resource.category_id
  into v_workspace_id, v_category_id
  from public.resources resource
  where resource.id = p_resource_id;

  if not found then
    return;
  end if;

  perform private.lock_resource_category_write(v_workspace_id, v_category_id);

  with next_vector as (
    select
      resource.id,
      private.resource_search_vector_v2(
        resource.id,
        resource.title,
        resource.description,
        resource.resource_type,
        resource.workspace_id,
        resource.category_id
      ) as search_vector
    from public.resources resource
    where resource.id = p_resource_id
  )
  update public.resources resource
  set search_vector = next_vector.search_vector
  from next_vector
  where resource.id = next_vector.id
    and resource.search_vector is distinct from next_vector.search_vector;
end;
$$;

create or replace function private.resource_relation_search_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category record;
  v_resource_id uuid;
  v_resource_ids uuid[] := '{}'::uuid[];
begin
  if tg_op = 'DELETE' then
    v_resource_ids := array[old.resource_id];
  elsif tg_op = 'INSERT' then
    v_resource_ids := array[new.resource_id];
  else
    select coalesce(
      array_agg(candidate.resource_id order by candidate.resource_id),
      '{}'::uuid[]
    )
    into v_resource_ids
    from (
      select distinct affected.resource_id
      from unnest(array[old.resource_id, new.resource_id]) as affected(resource_id)
    ) candidate;
  end if;

  for v_category in
    select resource.workspace_id, resource.category_id
    from public.resources resource
    where resource.id = any(v_resource_ids)
      and resource.category_id is not null
    group by resource.workspace_id, resource.category_id
    order by resource.workspace_id, resource.category_id
  loop
    perform private.lock_resource_category_write(
      v_category.workspace_id,
      v_category.category_id
    );
  end loop;

  foreach v_resource_id in array v_resource_ids loop
    perform private.refresh_resource_search_vector(v_resource_id);
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger resource_tasks_search_after_write
  after insert or update or delete on public.resource_tasks
  for each row execute function private.resource_relation_search_after_write();
create trigger resource_products_search_after_write
  after insert or update or delete on public.resource_products
  for each row execute function private.resource_relation_search_after_write();
create trigger resource_events_search_after_write
  after insert or update or delete on public.resource_events
  for each row execute function private.resource_relation_search_after_write();
create trigger resource_tags_search_after_write
  after insert or update or delete on public.resource_tags
  for each row execute function private.resource_relation_search_after_write();

create or replace function private.resource_catalog_search_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_id uuid;
  v_resource_id uuid;
  v_resource_ids uuid[] := '{}'::uuid[];
begin
  if tg_table_name = 'resource_categories' then
    select coalesce(
      array_agg(resource.id order by resource.category_id nulls last, resource.id),
      '{}'::uuid[]
    )
    into v_resource_ids
      from public.resources resource
      where resource.workspace_id = new.workspace_id
        and resource.category_id = new.id;
  elsif tg_table_name = 'products' then
    select coalesce(
      array_agg(resource.id order by resource.category_id nulls last, resource.id),
      '{}'::uuid[]
    )
    into v_resource_ids
      from public.resource_products relation
      join public.resources resource
        on resource.workspace_id = relation.workspace_id
        and resource.id = relation.resource_id
      where relation.workspace_id = new.workspace_id
        and relation.product_id = new.id;
  elsif tg_table_name = 'events' then
    select coalesce(
      array_agg(resource.id order by resource.category_id nulls last, resource.id),
      '{}'::uuid[]
    )
    into v_resource_ids
      from public.resource_events relation
      join public.resources resource
        on resource.workspace_id = relation.workspace_id
        and resource.id = relation.resource_id
      where relation.workspace_id = new.workspace_id
        and relation.event_id = new.id;
  elsif tg_table_name = 'tags' then
    select coalesce(
      array_agg(resource.id order by resource.category_id nulls last, resource.id),
      '{}'::uuid[]
    )
    into v_resource_ids
      from public.resource_tags relation
      join public.resources resource
        on resource.workspace_id = relation.workspace_id
        and resource.id = relation.resource_id
      where relation.workspace_id = new.workspace_id
        and relation.tag_id = new.id;
  elsif tg_table_name = 'tasks' then
    select coalesce(
      array_agg(resource.id order by resource.category_id nulls last, resource.id),
      '{}'::uuid[]
    )
    into v_resource_ids
      from public.resource_tasks relation
      join public.resources resource
        on resource.workspace_id = relation.workspace_id
        and resource.id = relation.resource_id
      where relation.workspace_id = new.workspace_id
        and relation.task_id = new.id;
  end if;

  for v_category_id in
    select resource.category_id
    from public.resources resource
    where resource.workspace_id = new.workspace_id
      and resource.id = any(v_resource_ids)
      and resource.category_id is not null
    group by resource.category_id
    order by resource.category_id
  loop
    perform private.lock_resource_category_write(new.workspace_id, v_category_id);
  end loop;

  foreach v_resource_id in array v_resource_ids loop
    perform private.refresh_resource_search_vector(v_resource_id);
  end loop;

  return new;
end;
$$;

create trigger resource_categories_catalog_search_after_write
  after update of name, archived_at on public.resource_categories
  for each row execute function private.resource_catalog_search_after_write();
create trigger products_resource_search_after_write
  after update of name, archived_at on public.products
  for each row execute function private.resource_catalog_search_after_write();
create trigger events_resource_search_after_write
  after update of name, archived_at on public.events
  for each row execute function private.resource_catalog_search_after_write();
create trigger tags_resource_search_after_write
  after update of name, archived_at on public.tags
  for each row execute function private.resource_catalog_search_after_write();
create trigger tasks_resource_search_after_write
  after update of title, archived_at on public.tasks
  for each row execute function private.resource_catalog_search_after_write();

with next_vectors as (
  select
    resource.id,
    private.resource_search_vector_v2(
      resource.id,
      resource.title,
      resource.description,
      resource.resource_type,
      resource.workspace_id,
      resource.category_id
    ) as search_vector
  from public.resources resource
)
update public.resources resource
set search_vector = next_vectors.search_vector
from next_vectors
where resource.id = next_vectors.id
  and resource.search_vector is distinct from next_vectors.search_vector;

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
  v_lock_category_id uuid;
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

  if v_resource.version is distinct from p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  for v_lock_category_id in
    select candidate.category_id
    from (
      values (
        v_resource.category_id
      ), (
        case
          when p_patch ? 'category_id' then v_category_id
          else v_resource.category_id
        end
      )
    ) as candidate(category_id)
    where candidate.category_id is not null
    group by candidate.category_id
    order by candidate.category_id
  loop
    perform private.lock_resource_category_write(
      v_resource.workspace_id,
      v_lock_category_id
    );
  end loop;

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
declare
  v_resource public.resources%rowtype;
begin
  if p_resource_id is null or not private.can_edit_resource(p_resource_id) then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_EXPECTED_VERSION';
  end if;

  select * into v_resource
  from public.resources resource
  where resource.id = p_resource_id
    and resource.archived_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  if v_resource.version is distinct from p_expected_version then
    raise exception using errcode = '40001', message = 'PTA_VERSION_CONFLICT';
  end if;

  perform private.lock_resource_category_write(
    v_resource.workspace_id,
    v_resource.category_id
  );

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

create or replace function public.search_resource_relation_options(
  p_workspace_id uuid,
  p_entity_type text,
  p_query text default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(p_query), '');
  v_normalized_query text;
  v_limit integer := coalesce(p_limit, 30);
  v_result jsonb;
begin
  if p_workspace_id is null
    or private.current_workspace_role(p_workspace_id) is null then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  if p_entity_type is null
    or p_entity_type not in ('task', 'product', 'event', 'tag') then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_RELATION_TYPE';
  end if;

  if v_query is not null and char_length(v_query) > 100 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_SEARCH_QUERY';
  end if;

  if v_limit < 1 or v_limit > 50 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_RELATION_LIMIT';
  end if;

  v_normalized_query := lower(extensions.unaccent(coalesce(v_query, '')));

  if p_entity_type = 'task' then
    select coalesce(
      jsonb_agg(option - 'sort' order by option ->> 'sort' desc),
      '[]'::jsonb
    )
    into v_result
    from (
      select jsonb_build_object(
        'id', task.id,
        'label', task.title,
        'meta', workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0'),
        'color', null,
        'sort', lpad(task.task_number::text, 20, '0')
      ) as option
      from public.tasks task
      join public.workspaces workspace on workspace.id = task.workspace_id
      where task.workspace_id = p_workspace_id
        and task.archived_at is null
        and (
          v_query is null
          or lower(extensions.unaccent(task.title)) like '%' || v_normalized_query || '%'
          or lower(workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0')) like '%' || v_normalized_query || '%'
        )
      order by task.updated_at desc, task.id
      limit v_limit
    ) options;
  elsif p_entity_type = 'product' then
    select coalesce(jsonb_agg(option order by option ->> 'label'), '[]'::jsonb)
    into v_result
    from (
      select jsonb_build_object(
        'id', product.id,
        'label', product.name,
        'meta', null,
        'color', null
      ) as option
      from public.products product
      where product.workspace_id = p_workspace_id
        and product.archived_at is null
        and (
          v_query is null
          or lower(extensions.unaccent(product.name)) like '%' || v_normalized_query || '%'
        )
      order by product.name, product.id
      limit v_limit
    ) options;
  elsif p_entity_type = 'event' then
    select coalesce(jsonb_agg(option order by option ->> 'label'), '[]'::jsonb)
    into v_result
    from (
      select jsonb_build_object(
        'id', event.id,
        'label', event.name,
        'meta', case
          when event.start_date is null then null
          else to_char(event.start_date, 'DD/MM/YYYY')
        end,
        'color', null
      ) as option
      from public.events event
      where event.workspace_id = p_workspace_id
        and event.archived_at is null
        and (
          v_query is null
          or lower(extensions.unaccent(event.name)) like '%' || v_normalized_query || '%'
        )
      order by event.start_date desc nulls last, event.name, event.id
      limit v_limit
    ) options;
  else
    select coalesce(jsonb_agg(option order by option ->> 'label'), '[]'::jsonb)
    into v_result
    from (
      select jsonb_build_object(
        'id', tag.id,
        'label', tag.name,
        'meta', null,
        'color', tag.color
      ) as option
      from public.tags tag
      where tag.workspace_id = p_workspace_id
        and tag.archived_at is null
        and (
          v_query is null
          or lower(extensions.unaccent(tag.name)) like '%' || v_normalized_query || '%'
        )
      order by tag.name, tag.id
      limit v_limit
    ) options;
  end if;

  return jsonb_build_object('items', v_result);
end;
$$;

create or replace function public.create_resource_tag(
  p_workspace_id uuid,
  p_name text,
  p_color text default 'stone'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.workspace_role;
  v_name text := btrim(coalesce(p_name, ''));
  v_color text := lower(btrim(coalesce(p_color, 'stone')));
  v_tag public.tags%rowtype;
begin
  v_role := private.current_workspace_role(p_workspace_id);

  if p_workspace_id is null
    or v_role is null
    or v_role not in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'manager'::public.workspace_role
    ) then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  if char_length(v_name) not between 1 and 60 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_TAG_NAME';
  end if;

  if v_color not in (
    'stone', 'blue', 'cyan', 'green', 'lime',
    'orange', 'pink', 'purple', 'red', 'yellow'
  ) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_TAG_COLOR';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('resource-tag:' || p_workspace_id::text, 0)
  );

  if exists (
    select 1
    from public.tags tag
    where tag.workspace_id = p_workspace_id
      and lower(tag.name) = lower(v_name)
  ) then
    raise exception using errcode = '23505', message = 'PTA_RESOURCE_TAG_EXISTS';
  end if;

  insert into public.tags (workspace_id, name, color, created_by)
  values (p_workspace_id, v_name, v_color, v_actor)
  returning * into v_tag;

  return jsonb_build_object(
    'id', v_tag.id,
    'label', v_tag.name,
    'meta', null,
    'color', v_tag.color
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PTA_RESOURCE_TAG_EXISTS';
end;
$$;

create or replace function private.resource_categories_snapshot(
  p_workspace_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(coalesce(
    string_agg(
      concat_ws(
        ':',
        category.id::text,
        category.position::text,
        extract(epoch from category.updated_at)::text
      ),
      '|' order by category.id
    ),
    ''
  ))
  from public.resource_categories category
  where category.workspace_id = p_workspace_id
    and category.archived_at is null;
$$;

create or replace function public.list_resource_categories(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.workspace_role;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if p_workspace_id is null or v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'snapshot', private.resource_categories_snapshot(p_workspace_id),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', category.id,
          'name', category.name,
          'color', category.color,
          'position', category.position,
          'updated_at', category.updated_at,
          'resource_count', (
            select count(*)
            from public.resources resource
            where resource.workspace_id = category.workspace_id
              and resource.category_id = category.id
              and resource.archived_at is null
              and private.can_view_resource(resource.id)
          )
        ) order by category.position, category.name
      )
      from public.resource_categories category
      where category.workspace_id = p_workspace_id
        and category.archived_at is null
    ), '[]'::jsonb),
    'can_manage', v_role in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'manager'::public.workspace_role
    )
  );
end;
$$;

create or replace function public.update_resource_category(
  p_category_id uuid,
  p_expected_updated_at timestamptz,
  p_name text,
  p_color text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category public.resource_categories%rowtype;
  v_role public.workspace_role;
  v_name text := btrim(coalesce(p_name, ''));
  v_color text := lower(btrim(coalesce(p_color, 'stone')));
  v_base_slug text;
  v_slug text;
  v_suffix integer := 2;
begin
  select * into v_category
  from public.resource_categories category
  where category.id = p_category_id
    and category.archived_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_CATEGORY_NOT_FOUND';
  end if;

  v_role := private.current_workspace_role(v_category.workspace_id);
  if v_role is null
    or v_role not in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'manager'::public.workspace_role
    ) then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_CATEGORY_NOT_FOUND';
  end if;

  if p_expected_updated_at is null
    or v_category.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'PTA_RESOURCE_CATEGORY_CONFLICT';
  end if;

  if char_length(v_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_CATEGORY_NAME';
  end if;

  if v_color not in (
    'stone', 'blue', 'cyan', 'green', 'lime',
    'orange', 'pink', 'purple', 'red', 'yellow'
  ) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_CATEGORY_COLOR';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_category.workspace_id::text, 0)
  );
  perform private.lock_resource_category_write(
    v_category.workspace_id,
    v_category.id
  );

  if exists (
    select 1
    from public.resource_categories category
    where category.workspace_id = v_category.workspace_id
      and category.id <> v_category.id
      and lower(category.name) = lower(v_name)
  ) then
    raise exception using errcode = '23505', message = 'PTA_RESOURCE_CATEGORY_EXISTS';
  end if;

  v_base_slug := trim(
    both '-' from regexp_replace(
      lower(extensions.unaccent(v_name)),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );
  if v_base_slug = '' then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_CATEGORY_NAME';
  end if;

  v_slug := v_base_slug;
  while exists (
    select 1
    from public.resource_categories category
    where category.workspace_id = v_category.workspace_id
      and category.id <> v_category.id
      and category.slug = v_slug
  ) loop
    v_slug := v_base_slug || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  end loop;

  update public.resource_categories category
  set
    name = v_name,
    slug = v_slug,
    color = v_color,
    updated_at = clock_timestamp()
  where category.id = v_category.id
    and category.updated_at = p_expected_updated_at
  returning * into v_category;

  if not found then
    raise exception using errcode = '40001', message = 'PTA_RESOURCE_CATEGORY_CONFLICT';
  end if;

  return jsonb_build_object(
    'id', v_category.id,
    'name', v_category.name,
    'color', v_category.color,
    'position', v_category.position,
    'updated_at', v_category.updated_at,
    'resource_count', (
      select count(*)
      from public.resources resource
      where resource.workspace_id = v_category.workspace_id
        and resource.category_id = v_category.id
        and resource.archived_at is null
        and private.can_view_resource(resource.id)
    )
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PTA_RESOURCE_CATEGORY_EXISTS';
end;
$$;

create or replace function public.archive_resource_category(
  p_category_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category public.resource_categories%rowtype;
  v_role public.workspace_role;
  v_detached_count integer;
begin
  select * into v_category
  from public.resource_categories category
  where category.id = p_category_id
    and category.archived_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_CATEGORY_NOT_FOUND';
  end if;

  v_role := private.current_workspace_role(v_category.workspace_id);
  if v_role is null
    or v_role not in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role
    ) then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_CATEGORY_NOT_FOUND';
  end if;

  if p_expected_updated_at is null
    or v_category.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'PTA_RESOURCE_CATEGORY_CONFLICT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_category.workspace_id::text, 0)
  );
  perform private.lock_resource_category_write(
    v_category.workspace_id,
    v_category.id
  );

  update public.resource_categories category
  set archived_at = clock_timestamp(), updated_at = clock_timestamp()
  where category.id = v_category.id
    and category.updated_at = p_expected_updated_at
  returning * into v_category;

  if not found then
    raise exception using errcode = '40001', message = 'PTA_RESOURCE_CATEGORY_CONFLICT';
  end if;

  update public.resources resource
  set category_id = null
  where resource.workspace_id = v_category.workspace_id
    and resource.category_id = v_category.id;
  get diagnostics v_detached_count = row_count;

  with ordered as (
    select
      category.id,
      (
        row_number() over (order by category.position, category.name, category.id) - 1
      )::integer as next_position
    from public.resource_categories category
    where category.workspace_id = v_category.workspace_id
      and category.archived_at is null
  )
  update public.resource_categories category
  set position = ordered.next_position, updated_at = clock_timestamp()
  from ordered
  where category.id = ordered.id
    and category.position is distinct from ordered.next_position;

  return jsonb_build_object(
    'id', v_category.id,
    'archived_at', v_category.archived_at,
    'detached_resources', v_detached_count
  );
end;
$$;

create or replace function public.reorder_resource_categories(
  p_workspace_id uuid,
  p_category_ids uuid[],
  p_expected_snapshot text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.workspace_role;
  v_ids uuid[] := coalesce(p_category_ids, '{}'::uuid[]);
  v_active_count integer;
begin
  v_role := private.current_workspace_role(p_workspace_id);
  if p_workspace_id is null
    or v_role is null
    or v_role not in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'manager'::public.workspace_role
    ) then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_workspace_id::text, 0)
  );

  if p_expected_snapshot is null
    or private.resource_categories_snapshot(p_workspace_id)
      is distinct from p_expected_snapshot then
    raise exception using errcode = '40001', message = 'PTA_RESOURCE_CATEGORY_CONFLICT';
  end if;

  select count(*) into v_active_count
  from public.resource_categories category
  where category.workspace_id = p_workspace_id
    and category.archived_at is null;

  if cardinality(v_ids) <> v_active_count
    or (select count(distinct id) from unnest(v_ids) id) <> v_active_count
    or exists (
      select 1
      from unnest(v_ids) id
      left join public.resource_categories category
        on category.workspace_id = p_workspace_id
        and category.id = id
        and category.archived_at is null
      where category.id is null
    ) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_CATEGORY_ORDER';
  end if;

  update public.resource_categories category
  set
    position = (ordered.ordinality - 1)::integer,
    updated_at = clock_timestamp()
  from unnest(v_ids) with ordinality ordered(id, ordinality)
  where category.workspace_id = p_workspace_id
    and category.id = ordered.id
    and category.position is distinct from (ordered.ordinality - 1)::integer;

  return public.list_resource_categories(p_workspace_id);
end;
$$;

alter function private.resource_search_vector_v2(uuid, text, text, public.resource_type, uuid, uuid)
  owner to postgres;
alter function private.lock_resource_category_write(uuid, uuid) owner to postgres;
alter function private.resource_categories_snapshot(uuid) owner to postgres;
alter function private.refresh_resource_search_vector(uuid) owner to postgres;
alter function private.resource_relation_search_after_write() owner to postgres;
alter function private.resource_catalog_search_after_write() owner to postgres;
alter function public.update_resource(uuid, integer, jsonb) owner to postgres;
alter function public.archive_resource(uuid, integer) owner to postgres;
alter function public.search_resource_relation_options(uuid, text, text, integer)
  owner to postgres;
alter function public.create_resource_tag(uuid, text, text) owner to postgres;
alter function public.list_resource_categories(uuid) owner to postgres;
alter function public.update_resource_category(uuid, timestamptz, text, text)
  owner to postgres;
alter function public.archive_resource_category(uuid, timestamptz) owner to postgres;
alter function public.reorder_resource_categories(uuid, uuid[], text) owner to postgres;

revoke all on function private.resource_search_vector_v2(uuid, text, text, public.resource_type, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.lock_resource_category_write(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.resource_categories_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function private.refresh_resource_search_vector(uuid)
  from public, anon, authenticated;
revoke all on function private.resource_relation_search_after_write()
  from public, anon, authenticated;
revoke all on function private.resource_catalog_search_after_write()
  from public, anon, authenticated;
revoke all on function public.update_resource(uuid, integer, jsonb)
  from public, anon, authenticated;
revoke all on function public.archive_resource(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.search_resource_relation_options(uuid, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.create_resource_tag(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.list_resource_categories(uuid)
  from public, anon, authenticated;
revoke all on function public.update_resource_category(uuid, timestamptz, text, text)
  from public, anon, authenticated;
revoke all on function public.archive_resource_category(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.reorder_resource_categories(uuid, uuid[], text)
  from public, anon, authenticated;

revoke all on table
  public.resources,
  public.resource_tasks,
  public.resource_products,
  public.resource_events,
  public.resource_tags
from public, anon, authenticated;

grant execute on function public.search_resource_relation_options(uuid, text, text, integer)
  to authenticated;
grant execute on function public.update_resource(uuid, integer, jsonb)
  to authenticated;
grant execute on function public.archive_resource(uuid, integer)
  to authenticated;
grant execute on function public.create_resource_tag(uuid, text, text)
  to authenticated;
grant execute on function public.list_resource_categories(uuid)
  to authenticated;
grant execute on function public.update_resource_category(uuid, timestamptz, text, text)
  to authenticated;
grant execute on function public.archive_resource_category(uuid, timestamptz)
  to authenticated;
grant execute on function public.reorder_resource_categories(uuid, uuid[], text)
  to authenticated;

comment on function public.search_resource_relation_options(uuid, text, text, integer) is
  'Returns active workspace entities available to a resource relation editor.';
comment on function public.create_resource_tag(uuid, text, text) is
  'Creates an active resource tag for owner, admin or manager.';
comment on function public.list_resource_categories(uuid) is
  'Lists active resource categories with order and usage count.';
comment on function public.update_resource_category(uuid, timestamptz, text, text) is
  'Renames and recolors a resource category with optimistic concurrency.';
comment on function public.archive_resource_category(uuid, timestamptz) is
  'Archives a resource category and detaches its active resource references.';
comment on function public.reorder_resource_categories(uuid, uuid[], text) is
  'Reorders every active resource category after validating a serialized snapshot.';

commit;
