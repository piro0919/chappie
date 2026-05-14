-- Defense-in-depth RLS on subscription / processed_event.
-- All writes still happen via service_role (webhook + checkout routes),
-- which bypasses RLS. This policy set only matters if anon/authenticated
-- clients ever query these tables directly.

alter table subscription enable row level security;
alter table processed_event enable row level security;

-- A signed-in user can read their own subscription row only.
create policy "subscription_select_own"
  on subscription
  for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete from anon or authenticated; service_role bypasses RLS.
-- processed_event is purely an internal idempotency log; nobody but service_role
-- should ever see it, so we add no policies (default-deny).
