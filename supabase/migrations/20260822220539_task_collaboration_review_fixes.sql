begin;

create or replace function public.list_task_comments(
  p_task_id uuid,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.workspace_role;
  v_workspace_id uuid;
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 20));
  v_result jsonb;
begin
  if (p_cursor_created_at is null) <> (p_cursor_id is null) then
    raise exception using errcode = '22023', message = 'PTA_INVALID_COMMENT_CURSOR';
  end if;

  select task.workspace_id
  into v_workspace_id
  from public.tasks task
  where task.id = p_task_id
    and task.archived_at is null;

  v_role := private.task_collaboration_role(p_task_id);
  if v_workspace_id is null or v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_TASK_NOT_FOUND';
  end if;

  with page as (
    select
      task_comment.id,
      task_comment.parent_comment_id,
      task_comment.body,
      task_comment.created_by,
      comment_author.full_name as author_name,
      task_comment.created_at,
      task_comment.updated_at,
      task_comment.edited_at,
      task_comment.deleted_at,
      row_number() over (
        order by task_comment.created_at desc, task_comment.id desc
      ) as row_number
    from public.task_comments task_comment
    left join public.profiles comment_author
      on comment_author.id = task_comment.created_by
    where task_comment.workspace_id = v_workspace_id
      and task_comment.task_id = p_task_id
      and (
        p_cursor_created_at is null
        or (task_comment.created_at, task_comment.id)
          < (p_cursor_created_at, p_cursor_id)
      )
    order by task_comment.created_at desc, task_comment.id desc
    limit v_limit + 1
  ),
  visible as (
    select *
    from page
    where row_number <= v_limit
  ),
  last_visible as (
    select created_at, id
    from visible
    order by row_number desc
    limit 1
  )
  select jsonb_build_object(
    'comments', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', comment_row.id,
            'parent_comment_id', comment_row.parent_comment_id,
            'body', comment_row.body,
            'created_by', comment_row.created_by,
            'author_name', comment_row.author_name,
            'created_at', comment_row.created_at,
            'updated_at', comment_row.updated_at,
            'edited_at', comment_row.edited_at,
            'is_deleted', comment_row.deleted_at is not null,
            'deleted_at', comment_row.deleted_at,
            'can_edit_comment',
              comment_row.deleted_at is null
              and comment_row.created_by = v_actor
              and v_role in (
                'owner'::public.workspace_role,
                'admin'::public.workspace_role,
                'manager'::public.workspace_role,
                'member'::public.workspace_role
              ),
            'can_delete_comment',
              comment_row.deleted_at is null
              and (
                v_role in (
                  'owner'::public.workspace_role,
                  'admin'::public.workspace_role,
                  'manager'::public.workspace_role
                )
                or (
                  v_role = 'member'::public.workspace_role
                  and comment_row.created_by = v_actor
                )
              )
          ) order by comment_row.row_number desc
        )
        from visible comment_row
      ),
      '[]'::jsonb
    ),
    'has_more', (select count(*) > v_limit from page),
    'next_cursor', case
      when (select count(*) > v_limit from page) then (
        select jsonb_build_object(
          'created_at', cursor_row.created_at,
          'id', cursor_row.id
        )
        from last_visible cursor_row
      )
      else null
    end
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.update_task_comment(
  p_comment_id uuid,
  p_body text
)
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
    and task_comment.deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PTA_COMMENT_NOT_FOUND';
  end if;
  v_role := private.task_collaboration_role(v_comment.task_id);
  if v_role is null then
    raise exception using errcode = 'P0002', message = 'PTA_COMMENT_NOT_FOUND';
  end if;
  if v_role not in (
    'owner'::public.workspace_role,
    'admin'::public.workspace_role,
    'manager'::public.workspace_role,
    'member'::public.workspace_role
  ) or v_comment.created_by <> v_actor then
    raise exception using errcode = '42501', message = 'PTA_FORBIDDEN';
  end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 10000 then
    raise exception using errcode = '22023', message = 'PTA_INVALID_COMMENT';
  end if;

  if v_comment.body = btrim(p_body) then
    return jsonb_build_object(
      'id', v_comment.id,
      'task_id', v_comment.task_id,
      'parent_comment_id', v_comment.parent_comment_id,
      'body', v_comment.body,
      'created_by', v_comment.created_by,
      'created_at', v_comment.created_at,
      'updated_at', v_comment.updated_at,
      'edited_at', v_comment.edited_at
    );
  end if;

  update public.task_comments task_comment
  set
    body = btrim(p_body),
    updated_at = clock_timestamp(),
    edited_at = clock_timestamp()
  where task_comment.id = p_comment_id
  returning * into v_comment;

  return jsonb_build_object(
    'id', v_comment.id,
    'task_id', v_comment.task_id,
    'parent_comment_id', v_comment.parent_comment_id,
    'body', v_comment.body,
    'created_by', v_comment.created_by,
    'created_at', v_comment.created_at,
    'updated_at', v_comment.updated_at,
    'edited_at', v_comment.edited_at
  );
end;
$$;

alter table public.task_links
  add constraint task_links_port_range_valid check (
    substring(url from '^https://[^/:?#]+:([0-9]{1,5})') is null
    or (
      substring(url from '^https://[^/:?#]+:([0-9]{1,5})')::integer
        between 1 and 65535
    )
  );

alter function public.list_task_comments(uuid, timestamptz, uuid, integer)
owner to postgres;
alter function public.update_task_comment(uuid, text) owner to postgres;

revoke all on function public.list_task_comments(uuid, timestamptz, uuid, integer)
from public, anon, authenticated;
revoke all on function public.update_task_comment(uuid, text)
from public, anon, authenticated;

grant execute on function public.list_task_comments(uuid, timestamptz, uuid, integer)
to authenticated;
grant execute on function public.update_task_comment(uuid, text)
to authenticated;

comment on constraint task_links_port_range_valid on public.task_links is
  'Rejects explicit HTTPS ports outside the valid TCP range.';

commit;
