-- Paid tier: Stripe subscription mirrored from webhooks.
-- One row per Supabase user. Webhook upserts on `customer.subscription.*`.

create table subscription (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text not null unique,
  status text not null, -- active | trialing | past_due | canceled | unpaid | incomplete
  current_period_end timestamptz not null,
  updated_at timestamptz not null default now()
);

create index idx_subscription_customer on subscription (stripe_customer_id);
create index idx_subscription_status on subscription (status);

-- Idempotency log: Stripe re-sends the same event on retry. We process each event id once.
create table processed_event (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

-- Helper: is the user currently paid?
-- "paid" = status is active or trialing AND current_period_end is still in the future.
create or replace function is_paid(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from subscription
    where user_id = p_user_id
      and status in ('active', 'trialing')
      and current_period_end > now()
  );
$$;
