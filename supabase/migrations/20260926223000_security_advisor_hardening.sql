-- Internal event-trigger helper: PostgreSQL invokes it through the event trigger,
-- so it must never be exposed as a PostgREST RPC.
revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;
