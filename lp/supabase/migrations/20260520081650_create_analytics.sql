-- Opt-in usage analytics.
--
-- Two tables:
--   analytics_consent — per-device opt-in flag (row exists = opted in,
--     no row = opted out). DELETE on opt-out so the table doubles as
--     the canonical consent ledger.
--   analytics_event — append-only voice-turn log (utterance text +
--     called tool names + metadata). 90-day retention via pg_cron.
--
-- Only inserted to when a request arrives with the consent header AND
-- a corresponding row in analytics_consent. Both checks live in the
-- /api/analytics route to keep the SQL boring.
--
-- The device_id used here is the same UUIDv5 emitted by chappie's
-- device_id.rs — derived one-way from the hardware UUID. Not reversible
-- to a user identity, but stable across reinstalls until hardware
-- changes.

create table analytics_consent (
  device_id text primary key,
  consented_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now()
);

create table analytics_event (
  id bigserial primary key,
  device_id text not null,
  ts timestamptz not null default now(),
  turn_id text not null,
  utterance text not null,
  tool_calls jsonb not null,        -- array of strings; [] means chitchat / pure response
  lang text not null,                -- ja / en / es / fr / de / it / pt / ko / zh
  mode text not null,                -- free / paid / byok
  latency_ms integer,
  success boolean not null,
  unique (device_id, turn_id)
);

create index idx_analytics_event_ts on analytics_event (ts);
create index idx_analytics_event_device on analytics_event (device_id);

-- 90-day retention. pg_cron lives in the cron schema and is enabled by
-- default on Supabase. Daily 03:17 UTC job deletes older rows.
-- Schedule offset by :17 to dodge the top-of-hour cron rush.
create extension if not exists pg_cron;

select cron.schedule(
  'analytics_event_purge',
  '17 3 * * *',
  $$delete from analytics_event where ts < now() - interval '90 days'$$
);

-- RLS: only the service role can touch these tables. The /api/analytics
-- route uses the service-role client (supabaseAdmin), so policies stay
-- locked-down. anon / authenticated clients have no access.
alter table analytics_consent enable row level security;
alter table analytics_event enable row level security;
