begin;

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
  v_prefix_lexemes text[];
  v_prefix_tsquery tsquery;
  v_allow_lexeme_prefix boolean;
  v_allow_task_key_prefix boolean;
  v_limit_per_group integer := coalesce(p_limit_per_group, 8);
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

  if v_limit_per_group < 1 or v_limit_per_group > 20 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_SEARCH_LIMIT';
  end if;

  v_normalized_query := lower(extensions.unaccent(v_query));
  v_tsquery := websearch_to_tsquery(
    'pg_catalog.portuguese'::regconfig,
    extensions.unaccent(v_query)
  );
  v_prefix_lexemes := tsvector_to_array(
    to_tsvector(
      'pg_catalog.portuguese'::regconfig,
      extensions.unaccent(v_query)
    )
  );
  v_allow_lexeme_prefix :=
    v_normalized_query ~ '^[[:alnum:][:space:]]+$'
    and v_normalized_query !~ '(^|[[:space:]])or([[:space:]]|$)';
  v_allow_task_key_prefix :=
    v_normalized_query ~ '^[[:alnum:]-]+$';

  if v_allow_lexeme_prefix and cardinality(v_prefix_lexemes) > 0 then
    select to_tsquery(
      'pg_catalog.simple'::regconfig,
      string_agg(
        quote_literal(prefix_lexeme.value) || ':*',
        ' & '
        order by prefix_lexeme.value
      )
    )
    into v_prefix_tsquery
    from unnest(v_prefix_lexemes) as prefix_lexeme(value);
  end if;

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
          when starts_with(lower(extensions.unaccent(task.title)), v_normalized_query) then 50
          when v_allow_task_key_prefix
            and starts_with(
              lower(workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0')),
              v_normalized_query
            ) then 50
          when v_prefix_tsquery is not null
            and task.search_vector @@ v_prefix_tsquery then 20
          else 0
        end
        + ts_rank_cd(task.search_vector, v_tsquery) * 10
        + case
            when v_prefix_tsquery is null then 0
            else ts_rank_cd(task.search_vector, v_prefix_tsquery) * 5
          end
      )::real as score
    from public.tasks task
    join public.workspaces workspace on workspace.id = task.workspace_id
    join public.task_statuses status
      on status.workspace_id = task.workspace_id and status.id = task.status_id
    where task.workspace_id = p_workspace_id
      and task.archived_at is null
      and (
        task.search_vector @@ v_tsquery
        or (v_prefix_tsquery is not null and task.search_vector @@ v_prefix_tsquery)
        or (
          v_prefix_tsquery is null
          and starts_with(lower(extensions.unaccent(task.title)), v_normalized_query)
        )
        or lower(workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0')) = v_normalized_query
        or (
          v_allow_task_key_prefix
          and starts_with(
            lower(workspace.task_prefix || '-' || lpad(task.task_number::text, 6, '0')),
            v_normalized_query
          )
        )
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
          when starts_with(lower(extensions.unaccent(event.name)), v_normalized_query) then 50
          when v_prefix_tsquery is not null
            and event.search_vector @@ v_prefix_tsquery then 20
          else 0
        end
        + ts_rank_cd(event.search_vector, v_tsquery) * 10
        + case
            when v_prefix_tsquery is null then 0
            else ts_rank_cd(event.search_vector, v_prefix_tsquery) * 5
          end
      )::real
    from public.events event
    where event.workspace_id = p_workspace_id
      and event.archived_at is null
      and (
        event.search_vector @@ v_tsquery
        or (v_prefix_tsquery is not null and event.search_vector @@ v_prefix_tsquery)
        or (
          v_prefix_tsquery is null
          and starts_with(lower(extensions.unaccent(event.name)), v_normalized_query)
        )
      )

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
          when starts_with(lower(extensions.unaccent(product.name)), v_normalized_query) then 50
          when v_prefix_tsquery is not null
            and product.search_vector @@ v_prefix_tsquery then 20
          else 0
        end
        + ts_rank_cd(product.search_vector, v_tsquery) * 10
        + case
            when v_prefix_tsquery is null then 0
            else ts_rank_cd(product.search_vector, v_prefix_tsquery) * 5
          end
      )::real
    from public.products product
    where product.workspace_id = p_workspace_id
      and product.archived_at is null
      and (
        product.search_vector @@ v_tsquery
        or (v_prefix_tsquery is not null and product.search_vector @@ v_prefix_tsquery)
        or (
          v_prefix_tsquery is null
          and starts_with(lower(extensions.unaccent(product.name)), v_normalized_query)
        )
      )

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
          when starts_with(lower(extensions.unaccent(resource.title)), v_normalized_query) then 50
          when v_prefix_tsquery is not null
            and resource.search_vector @@ v_prefix_tsquery then 20
          else 0
        end
        + ts_rank_cd(resource.search_vector, v_tsquery) * 10
        + case
            when v_prefix_tsquery is null then 0
            else ts_rank_cd(resource.search_vector, v_prefix_tsquery) * 5
          end
      )::real
    from public.resources resource
    left join public.resource_categories category
      on category.workspace_id = resource.workspace_id and category.id = resource.category_id
    where resource.workspace_id = p_workspace_id
      and resource.archived_at is null
      and private.can_view_resource(resource.id)
      and (
        resource.search_vector @@ v_tsquery
        or (v_prefix_tsquery is not null and resource.search_vector @@ v_prefix_tsquery)
        or (
          v_prefix_tsquery is null
          and starts_with(lower(extensions.unaccent(resource.title)), v_normalized_query)
        )
      )

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
          when starts_with(lower(extensions.unaccent(profile.full_name)), v_normalized_query) then 50
          when v_prefix_tsquery is not null
            and profile.search_vector @@ v_prefix_tsquery then 20
          else 0
        end
        + ts_rank_cd(profile.search_vector, v_tsquery) * 10
        + case
            when v_prefix_tsquery is null then 0
            else ts_rank_cd(profile.search_vector, v_prefix_tsquery) * 5
          end
      )::real
    from public.workspace_members member
    join public.profiles profile on profile.id = member.user_id and profile.is_active
    where member.workspace_id = p_workspace_id
      and member.status = 'active'::public.membership_status
      and (
        profile.search_vector @@ v_tsquery
        or (v_prefix_tsquery is not null and profile.search_vector @@ v_prefix_tsquery)
        or (
          v_prefix_tsquery is null
          and starts_with(lower(extensions.unaccent(profile.full_name)), v_normalized_query)
        )
      )
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
    where ranked.group_position <= v_limit_per_group
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

alter function public.search_workspace(uuid, text, integer) owner to postgres;

revoke all on function public.search_workspace(uuid, text, integer)
  from public, anon, authenticated;

grant execute on function public.search_workspace(uuid, text, integer) to authenticated;

comment on function public.search_workspace(uuid, text, integer) is
  'Accent-insensitive grouped FTS with an indexable prefix query built only from normalized and quoted lexemes.';

commit;
