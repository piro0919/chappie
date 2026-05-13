-- Per-device daily quota counter for chappie free mode.
-- One row per (device_id, UTC date). Reset is implicit: a new date inserts a new row.
create table quota (
  device_id text not null,
  date date not null,
  count integer not null default 0,
  primary key (device_id, date)
);

create index idx_quota_date on quota (date);

-- Atomic +1 and return the new count. Single statement → no race condition.
-- Date is computed in UTC server-side so client clock skew can't shift the bucket.
create or replace function increment_quota(p_device_id text)
returns integer
language sql
as $$
  insert into quota (device_id, date, count)
  values (p_device_id, (now() at time zone 'utc')::date, 1)
  on conflict (device_id, date)
  do update set count = quota.count + 1
  returning count;
$$;
