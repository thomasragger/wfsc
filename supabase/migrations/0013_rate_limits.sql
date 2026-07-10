-- Postgres-backed rate limiting (replaces the Upstash Redis dependency).
-- Fixed-window counters: one row per (key, window). Atomic via upsert.

create table if not exists rate_limits (
  key          text not null,          -- '<kind>:<identifier>'
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (key, window_start)
);

alter table rate_limits enable row level security;
-- no anon policies: service-role only

-- Consume one hit; returns whether the request is allowed and, when denied,
-- seconds until the window resets. Fixed windows allow a short boundary burst
-- (up to 2x across two windows) — acceptable for our low-frequency endpoints.
create or replace function rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns table(allowed boolean, retry_after int)
language plpgsql
security definer
set search_path = public
as $$
declare
  w_start   timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  new_count int;
begin
  -- Opportunistic cleanup (~0.5% of calls) instead of a scheduled job.
  if random() < 0.005 then
    delete from rate_limits where window_start < now() - interval '2 days';
  end if;

  insert into rate_limits as r (key, window_start, count)
  values (p_key, w_start, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into new_count;

  if new_count <= p_max then
    return query select true, 0;
  else
    return query select
      false,
      greatest(1, ceil(extract(epoch from (w_start + make_interval(secs => p_window_seconds) - now())))::int);
  end if;
end;
$$;

-- PostgREST exposes granted functions as RPC; keep this server-only.
revoke execute on function rate_limit_hit(text, int, int) from public, anon, authenticated;
