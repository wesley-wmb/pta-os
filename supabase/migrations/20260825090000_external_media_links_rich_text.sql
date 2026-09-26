-- PTA OS external media policy and safe Notion-like task descriptions.
-- Existing Storage objects remain readable for a controlled migration, but
-- authenticated users can no longer prepare or upload new task attachments.

drop policy if exists task_attachments_object_insert on storage.objects;

revoke execute on function public.prepare_task_attachment(
  uuid,
  text,
  text,
  text,
  bigint
) from public, anon, authenticated;

revoke execute on function public.complete_task_attachment(uuid)
from public, anon, authenticated;

comment on function public.prepare_task_attachment(uuid, text, text, text, bigint)
is 'Legacy task attachment entrypoint. New uploads are disabled; use task_links or resources with external HTTPS URLs.';

comment on function public.complete_task_attachment(uuid)
is 'Legacy task attachment completion entrypoint. New uploads are disabled; use task_links or resources with external HTTPS URLs.';

create or replace function private.jsonb_has_only_keys(
  p_value jsonb,
  p_allowed_keys text[]
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'object'
    and not exists (
      select 1
      from jsonb_object_keys(p_value) as object_key(key)
      where not (object_key.key = any (p_allowed_keys))
    );
$$;

create or replace function private.is_valid_task_description_mark(p_mark jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_type text := p_mark ->> 'type';
  v_attrs jsonb := p_mark -> 'attrs';
  v_href text;
begin
  if jsonb_typeof(p_mark) <> 'object' then
    return false;
  end if;

  if v_type in ('bold', 'italic', 'strike', 'code') then
    return private.jsonb_has_only_keys(p_mark, array['type']);
  end if;

  if v_type <> 'link'
    or not private.jsonb_has_only_keys(p_mark, array['type', 'attrs'])
    or jsonb_typeof(v_attrs) <> 'object'
    or not private.jsonb_has_only_keys(
      v_attrs,
      array['href', 'target', 'rel', 'class']
    ) then
    return false;
  end if;

  v_href := v_attrs ->> 'href';
  if not private.is_valid_resource_url(v_href) then
    return false;
  end if;
  if v_attrs ? 'target'
    and jsonb_typeof(v_attrs -> 'target') not in ('string', 'null') then
    return false;
  end if;
  if coalesce(v_attrs ->> 'target', '_blank') <> '_blank' then
    return false;
  end if;
  if v_attrs ? 'rel'
    and jsonb_typeof(v_attrs -> 'rel') not in ('string', 'null') then
    return false;
  end if;
  if v_attrs ? 'class'
    and jsonb_typeof(v_attrs -> 'class') not in ('string', 'null') then
    return false;
  end if;
  if char_length(coalesce(v_attrs ->> 'rel', '')) > 120
    or char_length(coalesce(v_attrs ->> 'class', '')) > 120 then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function private.is_valid_task_description_node(
  p_node jsonb,
  p_depth integer default 0
)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_type text := p_node ->> 'type';
  v_content jsonb := p_node -> 'content';
  v_attrs jsonb := p_node -> 'attrs';
  v_child jsonb;
  v_mark jsonb;
begin
  if p_depth > 10 or jsonb_typeof(p_node) <> 'object' then
    return false;
  end if;

  if v_type = 'text' then
    if not private.jsonb_has_only_keys(p_node, array['type', 'text', 'marks'])
      or jsonb_typeof(p_node -> 'text') <> 'string'
      or char_length(p_node ->> 'text') > 50000 then
      return false;
    end if;
    if p_node ? 'marks' then
      if jsonb_typeof(p_node -> 'marks') <> 'array'
        or jsonb_array_length(p_node -> 'marks') > 12 then
        return false;
      end if;
      for v_mark in
        select mark.value
        from jsonb_array_elements(p_node -> 'marks') as mark(value)
      loop
        if not private.is_valid_task_description_mark(v_mark) then
          return false;
        end if;
      end loop;
    end if;
    return true;
  end if;

  if v_type = 'hardBreak' then
    return private.jsonb_has_only_keys(p_node, array['type']);
  end if;

  if v_type = 'heading' then
    if not private.jsonb_has_only_keys(p_node, array['type', 'attrs', 'content'])
      or jsonb_typeof(v_attrs) <> 'object'
      or not private.jsonb_has_only_keys(v_attrs, array['level'])
      or jsonb_typeof(v_attrs -> 'level') <> 'number'
      or (v_attrs ->> 'level')::integer not between 1 and 3 then
      return false;
    end if;
  elsif v_type = 'orderedList' then
    if not private.jsonb_has_only_keys(p_node, array['type', 'attrs', 'content']) then
      return false;
    end if;
    if v_attrs is not null then
      if jsonb_typeof(v_attrs) <> 'object'
        or not private.jsonb_has_only_keys(v_attrs, array['start', 'type']) then
        return false;
      end if;
      if v_attrs ? 'start'
        and (
          jsonb_typeof(v_attrs -> 'start') <> 'number'
          or (v_attrs ->> 'start')::integer < 1
        ) then
        return false;
      end if;
      if v_attrs ? 'type'
        and jsonb_typeof(v_attrs -> 'type') not in ('string', 'null') then
        return false;
      end if;
      if v_attrs ->> 'type' is not null
        and v_attrs ->> 'type' not in ('1', 'a', 'A', 'i', 'I') then
        return false;
      end if;
    end if;
  elsif v_type = 'taskItem' then
    if not private.jsonb_has_only_keys(p_node, array['type', 'attrs', 'content'])
      or jsonb_typeof(v_attrs) <> 'object'
      or not private.jsonb_has_only_keys(v_attrs, array['checked'])
      or jsonb_typeof(v_attrs -> 'checked') <> 'boolean' then
      return false;
    end if;
  elsif v_type in ('paragraph', 'bulletList', 'listItem', 'taskList', 'blockquote') then
    if not private.jsonb_has_only_keys(p_node, array['type', 'content']) then
      return false;
    end if;
  else
    return false;
  end if;

  if v_content is null then
    return v_type in ('paragraph', 'heading');
  end if;
  if jsonb_typeof(v_content) <> 'array' then
    return false;
  end if;

  for v_child in
    select child.value
    from jsonb_array_elements(v_content) as child(value)
  loop
    if v_type in ('paragraph', 'heading')
      and v_child ->> 'type' not in ('text', 'hardBreak') then
      return false;
    end if;
    if v_type in ('bulletList', 'orderedList')
      and v_child ->> 'type' <> 'listItem' then
      return false;
    end if;
    if v_type = 'taskList' and v_child ->> 'type' <> 'taskItem' then
      return false;
    end if;
    if v_type in ('listItem', 'taskItem')
      and v_child ->> 'type' not in (
        'paragraph',
        'bulletList',
        'orderedList',
        'taskList',
        'blockquote'
      ) then
      return false;
    end if;
    if v_type = 'blockquote'
      and v_child ->> 'type' not in (
        'paragraph',
        'heading',
        'bulletList',
        'orderedList',
        'taskList',
        'blockquote'
      ) then
      return false;
    end if;
    if not private.is_valid_task_description_node(v_child, p_depth + 1) then
      return false;
    end if;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function private.is_valid_task_description(p_description jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_block jsonb;
  v_node_count integer;
begin
  if jsonb_typeof(p_description) <> 'object'
    or not private.jsonb_has_only_keys(p_description, array['type', 'content'])
    or (p_description ->> 'type') is distinct from 'doc'
    or jsonb_typeof(p_description -> 'content') <> 'array' then
    return false;
  end if;

  select count(*)
  into v_node_count
  from jsonb_path_query(p_description, 'strict $.** ? (@.type() == "object")');

  if v_node_count > 3000 then
    return false;
  end if;

  for v_block in
    select block_node.value
    from jsonb_array_elements(p_description -> 'content') as block_node(value)
  loop
    if v_block ->> 'type' not in (
      'paragraph',
      'heading',
      'bulletList',
      'orderedList',
      'taskList',
      'blockquote'
    ) or not private.is_valid_task_description_node(v_block, 0) then
      return false;
    end if;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

alter function private.jsonb_has_only_keys(jsonb, text[]) owner to postgres;
alter function private.is_valid_task_description_mark(jsonb) owner to postgres;
alter function private.is_valid_task_description_node(jsonb, integer) owner to postgres;
alter function private.is_valid_task_description(jsonb) owner to postgres;

revoke all on function private.jsonb_has_only_keys(jsonb, text[])
from public, anon, authenticated;
revoke all on function private.is_valid_task_description_mark(jsonb)
from public, anon, authenticated;
revoke all on function private.is_valid_task_description_node(jsonb, integer)
from public, anon, authenticated;
revoke all on function private.is_valid_task_description(jsonb)
from public, anon, authenticated;

comment on function private.is_valid_task_description(jsonb)
is 'Validates the allowlisted rich text tree for task descriptions. Media, embeds and raw HTML are rejected.';
