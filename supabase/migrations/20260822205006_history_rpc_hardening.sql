create or replace function public.list_task_activity(p_workspace_id uuid)
returns table (
  activity_id uuid,
  actor_id uuid,
  actor_name text,
  task_id uuid,
  action text,
  created_at timestamptz,
  subject_user_id uuid,
  subject_name text,
  task_number bigint,
  task_title text,
  task_archived boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_workspace_id is null
    or not private.is_active_workspace_member(p_workspace_id) then
    raise exception using
      errcode = 'P0002',
      message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  return query
  select
    al.id as activity_id,
    al.actor_id,
    actor_profile.full_name as actor_name,
    al.entity_id as task_id,
    al.action,
    al.created_at,
    metadata.subject_user_id,
    subject_profile.full_name as subject_name,
    coalesce(task.task_number, metadata.task_number) as task_number,
    task.title as task_title,
    task.archived_at is not null as task_archived
  from public.activity_logs al
  left join public.tasks task
    on task.workspace_id = al.workspace_id
    and task.id = al.entity_id
  left join public.profiles actor_profile on actor_profile.id = al.actor_id
  left join lateral (
    select
      case
        when jsonb_typeof(al.metadata_json -> 'user_id') = 'string'
          and (al.metadata_json ->> 'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (al.metadata_json ->> 'user_id')::uuid
        else null
      end as subject_user_id,
      case
        when jsonb_typeof(al.metadata_json -> 'task_number') = 'number'
          and (al.metadata_json ->> 'task_number') ~ '^[0-9]+$'
        then (al.metadata_json ->> 'task_number')::bigint
        else null
      end as task_number
  ) metadata on true
  left join public.profiles subject_profile
    on subject_profile.id = metadata.subject_user_id
  where al.workspace_id = p_workspace_id
    and al.entity_type = 'task'
  order by al.created_at desc, al.id desc
  limit 50;
end;
$$;

alter function public.list_task_activity(uuid) owner to postgres;

revoke all on function public.list_task_activity(uuid) from public, anon, authenticated;
grant execute on function public.list_task_activity(uuid) to authenticated;

revoke select on table public.activity_logs from authenticated;

comment on function public.list_task_activity(uuid) is
  'Returns at most 50 sanitized task activity entries for an active member of the requested workspace.';
