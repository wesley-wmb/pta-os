begin;

revoke select on table public.workspace_members from authenticated;
revoke select (weekly_capacity_minutes, suspended_at)
on table public.workspace_members
from authenticated;
grant select (
  workspace_id,
  user_id,
  role,
  status,
  created_at,
  joined_at
) on table public.workspace_members to authenticated;

drop policy if exists members_select_member on public.workspace_members;
create policy members_select_member
on public.workspace_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (
    status = 'active'::public.membership_status
    and private.is_active_workspace_member(workspace_id)
    and private.current_workspace_role(workspace_id) in (
      'owner'::public.workspace_role,
      'admin'::public.workspace_role,
      'manager'::public.workspace_role,
      'member'::public.workspace_role
    )
  )
);

create or replace function public.list_team_members(p_workspace_id uuid)
returns table (
  user_id uuid,
  full_name text,
  initials text,
  role public.workspace_role,
  joined_at timestamptz,
  weekly_capacity_minutes integer
)
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
    raise exception using
      errcode = 'P0002',
      message = 'PTA_WORKSPACE_NOT_FOUND';
  end if;

  if v_role = 'viewer'::public.workspace_role then
    raise exception using
      errcode = '42501',
      message = 'PTA_TEAM_FORBIDDEN';
  end if;

  return query
  select
    wm.user_id,
    member_profile.full_name,
    member_profile.initials,
    wm.role,
    wm.joined_at,
    wm.weekly_capacity_minutes
  from public.workspace_members wm
  join public.profiles member_profile
    on member_profile.id = wm.user_id
    and member_profile.is_active
  where wm.workspace_id = p_workspace_id
    and wm.status = 'active'::public.membership_status
    and (
      v_role in (
        'owner'::public.workspace_role,
        'admin'::public.workspace_role,
        'manager'::public.workspace_role
      )
      or (
        v_role = 'member'::public.workspace_role
        and wm.user_id = (select auth.uid())
      )
    )
  order by wm.joined_at, wm.user_id;
end;
$$;

alter function public.list_team_members(uuid) owner to postgres;

revoke all on function public.list_team_members(uuid) from public, anon, authenticated;
grant execute on function public.list_team_members(uuid) to authenticated;

comment on function public.list_team_members(uuid) is
  'Returns active team members with capacity only to workspace managers; members receive only their own row and viewers are denied.';

commit;
