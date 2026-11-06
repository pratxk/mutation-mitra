-- Atomic transition: lock row, verify expected stage, update, log event, close open AI suggestions.
create function apply_transition(
  p_app uuid, p_actor uuid, p_role role_t, p_action text,
  p_expected stage_t, p_to stage_t, p_outcome outcome_t, p_reason text, p_final text
) returns void language plpgsql security definer set search_path = public as $$
declare cur applications%rowtype;
begin
  select * into cur from applications where id = p_app for update;
  if not found then raise exception 'not_found'; end if;
  if cur.outcome is not null then raise exception 'terminal'; end if;
  if cur.stage <> p_expected then raise exception 'stale_stage'; end if;

  update applications set
    stage = coalesce(p_to, stage),
    outcome = p_outcome,
    decided_at = case when p_outcome is not null then now() else decided_at end,
    return_count = return_count + (case when p_action = 'returned' then 1 else 0 end)
  where id = p_app;

  insert into application_events (application_id, actor, actor_role, action, from_stage, to_stage, reason, meta)
  values (p_app, p_actor, p_role, p_action, cur.stage, coalesce(p_to, cur.stage), p_reason,
          case when p_final is null then '{}'::jsonb else jsonb_build_object('final_text', p_final) end);

  update ai_suggestions set status = 'ignored', resolved_at = now()
  where application_id = p_app and stage = cur.stage and status = 'shown';
end $$;
revoke all on function apply_transition from public, anon, authenticated;
