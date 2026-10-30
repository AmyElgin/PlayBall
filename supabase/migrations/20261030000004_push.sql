-- Playball: push notifications.
-- Every batch of new notifications is posted to the `send-push` Edge Function,
-- which sends them through Expo to Apple and Google. A rainy morning with
-- 3,000 parents becomes a handful of web requests, not 3,000.

create extension if not exists pg_net with schema extensions;

-- Settings the trigger needs. Fill these in once after deploying the function:
--   insert into private.settings values
--     ('push_function_url', 'https://<project-ref>.supabase.co/functions/v1/send-push'),
--     ('push_webhook_secret', '<a long random string, also set as PUSH_WEBHOOK_SECRET>');
create table private.settings (
  key   text primary key,
  value text not null
);
revoke all on private.settings from public, anon, authenticated;

create function private.queue_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
  v_ids    bigint[];
  v_n      int;
begin
  select value into v_url from private.settings where key = 'push_function_url';
  select value into v_secret from private.settings where key = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return null; -- push not set up yet; messages still show in the app
  end if;

  select array_agg(id order by id) into v_ids from new_rows;
  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n = 0 then
    return null;
  end if;

  for i in 0 .. (v_n - 1) / 500 loop
    perform net.http_post(
      url     := v_url,
      body    := jsonb_build_object('ids', v_ids[i * 500 + 1 : (i + 1) * 500]),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret)
    );
  end loop;
  return null;
end;
$$;

create trigger notifications_push
  after insert on public.notifications
  referencing new table as new_rows
  for each statement execute function private.queue_push();
