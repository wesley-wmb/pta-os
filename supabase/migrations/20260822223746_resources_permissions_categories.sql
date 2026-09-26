-- PTA OS resource follow-up: restriction guard and safe category creation.
begin;

create or replace function private.guard_resource_restriction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.workspace_role;
begin
  v_role := private.current_workspace_role(new.workspace_id);

  if tg_op = 'INSERT'
    and (
      v_role is null
      or v_role not in (
        'owner'::public.workspace_role,
        'admin'::public.workspace_role,
        'manager'::public.workspace_role
      )
      or (
        new.is_restricted
        and v_role not in (
          'owner'::public.workspace_role,
          'admin'::public.workspace_role
        )
      )
    ) then
    raise exception using errcode = 'P0002', message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  if tg_op = 'UPDATE'
    and new.is_restricted is distinct from old.is_restricted
    and (
      v_role is null
      or v_role not in ('owner'::public.workspace_role, 'admin'::public.workspace_role)
    ) then
    raise exception using errcode = 'P0002', message = 'PTA_RESOURCE_NOT_FOUND';
  end if;

  return new;
end;
$$;

create trigger resources_restriction_guard
  before insert or update of is_restricted on public.resources
  for each row execute function private.guard_resource_restriction();

create or replace function public.create_resource_category(
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
  v_base_slug text;
  v_slug text;
  v_suffix integer := 2;
  v_position integer;
  v_category public.resource_categories%rowtype;
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

  if char_length(v_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_CATEGORY_NAME';
  end if;

  if v_color not in (
    'stone',
    'blue',
    'cyan',
    'green',
    'lime',
    'orange',
    'pink',
    'purple',
    'red',
    'yellow'
  ) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_RESOURCE_CATEGORY_COLOR';
  end if;

  if exists (
    select 1
    from public.resource_categories category
    where category.workspace_id = p_workspace_id
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
    where category.workspace_id = p_workspace_id
      and category.slug = v_slug
  ) loop
    v_slug := v_base_slug || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  end loop;

  select coalesce(max(category.position), -1) + 1
  into v_position
  from public.resource_categories category
  where category.workspace_id = p_workspace_id
    and category.archived_at is null;

  insert into public.resource_categories (
    workspace_id,
    name,
    slug,
    color,
    position,
    created_by
  ) values (
    p_workspace_id,
    v_name,
    v_slug,
    v_color,
    v_position,
    v_actor
  )
  returning * into v_category;

  return jsonb_build_object(
    'id', v_category.id,
    'name', v_category.name,
    'color', v_category.color
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PTA_RESOURCE_CATEGORY_EXISTS';
end;
$$;

alter function private.guard_resource_restriction() owner to postgres;
alter function public.create_resource_category(uuid, text, text) owner to postgres;

revoke all on function private.guard_resource_restriction()
  from public, anon, authenticated;
revoke all on function public.create_resource_category(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.create_resource_category(uuid, text, text)
  to authenticated;

comment on function public.create_resource_category(uuid, text, text) is
  'Creates a validated workspace resource category for owner, admin or manager.';

commit;
