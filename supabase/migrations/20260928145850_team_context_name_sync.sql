-- The internal context inherits the team's identity; retain all other event fields.
create or replace function private.sync_team_context_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.workspace_event_id is not null and new.name is distinct from old.name then
    update public.events set name = new.name, updated_by = auth.uid()
      where workspace_id = new.workspace_id and id = new.workspace_event_id
        and name is distinct from new.name;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_team_context_name() from public,anon,authenticated;
create trigger teams_sync_context_name after update of name on public.teams
  for each row execute function private.sync_team_context_name();

-- Preserve the prior audit actor when applying this structural migration without a session.
update public.events e set name = t.name, updated_by = coalesce(auth.uid(),e.updated_by,t.created_by)
from public.teams t
where t.workspace_id = e.workspace_id and t.workspace_event_id = e.id
  and t.archived_at is null and e.archived_at is null and e.name is distinct from t.name;
