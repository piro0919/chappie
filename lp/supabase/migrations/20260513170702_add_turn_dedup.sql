-- Per-turn dedup so multi-round tool-call chains in one user turn
-- consume only 1 quota slot.
--
-- The Chappie dispatch loop generates a UUID per chat_complete call and
-- sends it in every round's `X-Chappie-Turn-Id` header. The proxy
-- records (device_id, turn_id) on first sight and skips quota INCR on
-- subsequent rounds with the same pair.
--
-- Scoped to device_id so a malicious client can't dedupe against
-- another device's turn. A client could still bypass quota by reusing
-- their own turn_id forever, but Phase 3 auth + the per-turn time
-- window mitigate this; for MVP the abuse vector is acceptable.
create table seen_turn (
  device_id text not null,
  turn_id text not null,
  seen_at timestamptz not null default now(),
  primary key (device_id, turn_id)
);

create index idx_seen_turn_at on seen_turn (seen_at);

-- Atomic: record turn (if new) and increment quota only on first sight.
-- Returns the resulting daily count for the device.
create or replace function consume_quota_with_turn(
  p_device_id text,
  p_turn_id text
) returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  insert into seen_turn (device_id, turn_id)
  values (p_device_id, p_turn_id)
  on conflict (device_id, turn_id) do nothing;

  if found then
    -- First request of this turn: increment quota.
    insert into quota (device_id, date, count)
    values (p_device_id, (now() at time zone 'utc')::date, 1)
    on conflict (device_id, date)
    do update set count = quota.count + 1
    returning count into v_count;
  else
    -- Replay of an earlier round in the same turn: just return the
    -- current count without incrementing.
    select count into v_count
    from quota
    where device_id = p_device_id
      and date = (now() at time zone 'utc')::date;
    v_count := coalesce(v_count, 0);
  end if;

  return v_count;
end;
$$;
