begin;

alter table public.task_comments
  add column parent_comment_id uuid,
  add column updated_at timestamptz,
  add column edited_at timestamptz;

update public.task_comments
set updated_at = created_at
where updated_at is null;

alter table public.task_comments
  alter column updated_at set default now(),
  alter column updated_at set not null,
  add constraint task_comments_workspace_task_id_unique
    unique (workspace_id, task_id, id),
  add constraint task_comments_parent_same_task
    foreign key (workspace_id, task_id, parent_comment_id)
    references public.task_comments(workspace_id, task_id, id)
    on delete restrict,
  add constraint task_comments_parent_not_self
    check (parent_comment_id is null or parent_comment_id <> id),
  add constraint task_comments_timestamps_valid
    check (
      updated_at >= created_at
      and (edited_at is null or edited_at >= created_at)
    );

create index task_comments_active_cursor
  on public.task_comments (workspace_id, task_id, created_at desc, id desc)
  where deleted_at is null;

alter table public.task_links
  add column provider text,
  add column deleted_by uuid,
  add column deleted_at timestamptz,
  add constraint task_links_deleted_by_member
    foreign key (workspace_id, deleted_by)
    references public.workspace_members(workspace_id, user_id)
    on delete restrict;

create or replace function private.task_link_provider(p_url text)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_host text := lower(substring(p_url from '^https://([^/:?#]+)'));
begin
  return case
    when v_host ~ '(^|\.)figma\.com$' then 'figma'
    when v_host ~ '(^|\.)canva\.com$' then 'canva'
    when v_host ~ '(^|\.)(notion\.so|notion\.site)$' then 'notion'
    when v_host ~ '(^|\.)(drive|docs)\.google\.com$' then 'google_drive'
    when v_host ~ '(^|\.)(youtube\.com|youtu\.be)$' then 'youtube'
    when v_host ~ '(^|\.)loom\.com$' then 'loom'
    when v_host ~ '(^|\.)dropbox\.com$' then 'dropbox'
    else 'link'
  end;
end;
$$;

update public.task_links
set provider = private.task_link_provider(url)
where provider is null;

alter table public.task_links
  alter column provider set default 'link',
  alter column provider set not null,
  drop constraint task_links_workspace_id_task_id_url_key,
  add constraint task_links_provider_valid check (
    provider = btrim(provider)
    and char_length(provider) between 1 and 80
  ),
  add constraint task_links_deletion_consistent check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  );

create unique index task_links_active_url_unique
  on public.task_links (workspace_id, task_id, url)
  where deleted_at is null;

create index task_links_active_created
  on public.task_links (workspace_id, task_id, created_at, id)
  where deleted_at is null;

drop policy if exists task_comments_select_member on public.task_comments;
create policy task_comments_select_member
on public.task_comments
for select
to authenticated
using (
  private.is_active_workspace_member(workspace_id)
);

drop policy if exists task_links_select_member on public.task_links;
create policy task_links_select_member
on public.task_links
for select
to authenticated
using (
  deleted_at is null
  and private.is_active_workspace_member(workspace_id)
);

alter table public.task_comments force row level security;
alter table public.task_links force row level security;

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
              and comment_row.created_by = v_actor,
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
  v_comments_page jsonb;
  v_links jsonb;
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

  v_comments_page := public.list_task_comments(p_task_id, null, null, 20);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', link.id,
        'url', link.url,
        'label', link.label,
        'provider', link.provider,
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
    and link.task_id = p_task_id
    and link.deleted_at is null;

  return jsonb_build_object(
    'checklists', v_checklists,
    'comments', v_comments_page -> 'comments',
    'comments_page', jsonb_build_object(
      'has_more', v_comments_page -> 'has_more',
      'next_cursor', v_comments_page -> 'next_cursor'
    ),
    'links', v_links
  );
end;
$$;

drop function public.add_task_comment(uuid, text);

create function public.add_task_comment(
  p_task_id uuid,
  p_body text,
  p_parent_comment_id uuid default null
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
  if p_parent_comment_id is not null and not exists (
    select 1
    from public.task_comments parent_comment
    where parent_comment.workspace_id = v_workspace_id
      and parent_comment.task_id = p_task_id
      and parent_comment.id = p_parent_comment_id
      and parent_comment.deleted_at is null
  ) then
    raise exception using errcode = 'P0002', message = 'PTA_COMMENT_NOT_FOUND';
  end if;

  insert into public.task_comments (
    workspace_id,
    task_id,
    parent_comment_id,
    body,
    created_by
  ) values (
    v_workspace_id,
    p_task_id,
    p_parent_comment_id,
    btrim(p_body),
    v_actor
  )
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
  if v_comment.created_by <> v_actor then
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
    and task_comment.deleted_at is null
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

  update public.task_comments task_comment
  set
    body = null,
    deleted_by = v_actor,
    deleted_at = clock_timestamp(),
    updated_at = clock_timestamp()
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
    provider,
    created_by
  ) values (
    v_workspace_id,
    p_task_id,
    v_url,
    v_label,
    private.task_link_provider(v_url),
    v_actor
  )
  returning * into v_link;

  return jsonb_build_object(
    'id', v_link.id,
    'task_id', v_link.task_id,
    'url', v_link.url,
    'label', v_link.label,
    'provider', v_link.provider,
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
    and link.deleted_at is null
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
    provider = private.task_link_provider(v_url),
    updated_at = clock_timestamp()
  where link.id = p_link_id
    and link.deleted_at is null
  returning * into v_link;

  return jsonb_build_object(
    'id', v_link.id,
    'task_id', v_link.task_id,
    'url', v_link.url,
    'label', v_link.label,
    'provider', v_link.provider,
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
    and link.deleted_at is null
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

  update public.task_links link
  set
    deleted_by = v_actor,
    deleted_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where link.id = p_link_id
    and link.deleted_at is null
  returning * into v_link;

  return jsonb_build_object(
    'id', v_link.id,
    'task_id', v_link.task_id,
    'removed', true,
    'deleted_at', v_link.deleted_at
  );
end;
$$;

create or replace function private.task_collaboration_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_actor uuid := auth.uid();
  v_workspace_id uuid;
  v_task_id uuid;
  v_metadata jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'task_comments' then
    v_workspace_id := new.workspace_id;
    v_task_id := new.task_id;
    v_actor := coalesce(v_actor, new.deleted_by, new.created_by);
    v_metadata := jsonb_build_object('comment_id', new.id);

    if tg_op = 'INSERT' then
      v_action := 'task.comment_added';
    elsif old.deleted_at is null and new.deleted_at is not null then
      v_action := 'task.comment_deleted';
    elsif new.body is distinct from old.body then
      v_action := 'task.comment_edited';
    else
      return new;
    end if;
  elsif tg_table_name = 'task_checklist_items' then
    if new.is_completed is not distinct from old.is_completed then
      return new;
    end if;
    v_workspace_id := new.workspace_id;
    v_task_id := new.task_id;
    v_actor := coalesce(v_actor, new.completed_by, new.created_by);
    v_action := 'task.checklist_item_toggled';
    v_metadata := jsonb_build_object(
      'checklist_item_id', new.id,
      'is_completed', new.is_completed
    );
  elsif tg_table_name = 'task_links' then
    v_workspace_id := new.workspace_id;
    v_task_id := new.task_id;
    v_actor := coalesce(v_actor, new.deleted_by, new.created_by);
    v_metadata := jsonb_build_object('link_id', new.id);

    if tg_op = 'INSERT' then
      v_action := 'task.link_added';
    elsif old.deleted_at is null and new.deleted_at is not null then
      v_action := 'task.link_removed';
    elsif new.url is distinct from old.url
      or new.label is distinct from old.label
      or new.provider is distinct from old.provider then
      v_action := 'task.link_updated';
    else
      return new;
    end if;
  else
    return new;
  end if;

  insert into public.activity_logs (
    workspace_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata_json
  ) values (
    v_workspace_id,
    v_actor,
    'task',
    v_task_id,
    v_action,
    v_metadata
  );

  return new;
end;
$$;

create trigger task_comments_activity
after insert or update on public.task_comments
for each row execute function private.task_collaboration_activity();

create trigger task_checklist_items_activity
after update on public.task_checklist_items
for each row execute function private.task_collaboration_activity();

create trigger task_links_activity
after insert or update on public.task_links
for each row execute function private.task_collaboration_activity();

alter function private.task_link_provider(text) owner to postgres;
alter function private.task_collaboration_payload(uuid) owner to postgres;
alter function private.task_collaboration_activity() owner to postgres;
alter function public.list_task_comments(uuid, timestamptz, uuid, integer) owner to postgres;
alter function public.add_task_comment(uuid, text, uuid) owner to postgres;
alter function public.update_task_comment(uuid, text) owner to postgres;
alter function public.delete_task_comment(uuid) owner to postgres;
alter function public.add_task_link(uuid, text, text) owner to postgres;
alter function public.update_task_link(uuid, text, text) owner to postgres;
alter function public.remove_task_link(uuid) owner to postgres;

revoke all on function private.task_link_provider(text)
from public, anon, authenticated;
revoke all on function private.task_collaboration_payload(uuid)
from public, anon, authenticated;
revoke all on function private.task_collaboration_activity()
from public, anon, authenticated;
revoke all on function public.list_task_comments(uuid, timestamptz, uuid, integer)
from public, anon, authenticated;
revoke all on function public.add_task_comment(uuid, text, uuid)
from public, anon, authenticated;
revoke all on function public.update_task_comment(uuid, text)
from public, anon, authenticated;
revoke all on function public.delete_task_comment(uuid)
from public, anon, authenticated;
revoke all on function public.add_task_link(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.update_task_link(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.remove_task_link(uuid)
from public, anon, authenticated;

grant execute on function public.list_task_comments(uuid, timestamptz, uuid, integer)
to authenticated;
grant execute on function public.add_task_comment(uuid, text, uuid)
to authenticated;
grant execute on function public.update_task_comment(uuid, text)
to authenticated;
grant execute on function public.delete_task_comment(uuid)
to authenticated;
grant execute on function public.add_task_link(uuid, text, text)
to authenticated;
grant execute on function public.update_task_link(uuid, text, text)
to authenticated;
grant execute on function public.remove_task_link(uuid)
to authenticated;

do $$
declare
  v_all_tables boolean;
begin
  select publication.puballtables
  into v_all_tables
  from pg_catalog.pg_publication publication
  where publication.pubname = 'supabase_realtime';

  if found and not v_all_tables then
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables publication_table
      where publication_table.pubname = 'supabase_realtime'
        and publication_table.schemaname = 'public'
        and publication_table.tablename = 'task_checklists'
    ) then
      alter publication supabase_realtime add table public.task_checklists;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_publication_tables publication_table
      where publication_table.pubname = 'supabase_realtime'
        and publication_table.schemaname = 'public'
        and publication_table.tablename = 'task_checklist_items'
    ) then
      alter publication supabase_realtime add table public.task_checklist_items;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_publication_tables publication_table
      where publication_table.pubname = 'supabase_realtime'
        and publication_table.schemaname = 'public'
        and publication_table.tablename = 'task_comments'
    ) then
      alter publication supabase_realtime add table public.task_comments;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_publication_tables publication_table
      where publication_table.pubname = 'supabase_realtime'
        and publication_table.schemaname = 'public'
        and publication_table.tablename = 'task_links'
    ) then
      alter publication supabase_realtime add table public.task_links;
    end if;
  end if;
end;
$$;

comment on function public.list_task_comments(uuid, timestamptz, uuid, integer) is
  'Lists at most 20 active task comments with a stable created_at and id cursor.';

commit;
