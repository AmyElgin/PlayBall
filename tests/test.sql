-- Behaviour tests for the Playball database. Run with tests/run.sh.
\set ON_ERROR_STOP on
\set QUIET on

-- ------------------------------------------------------------ test helpers
create schema t;
grant usage on schema t to anon, authenticated;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create function t.fails(q text, needle text, msg text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if position(lower(needle) in lower(sqlerrm)) = 0 then
      raise exception 'FAILED: % (wrong error: %)', msg, sqlerrm;
    end if;
    raise notice 'ok - %', msg;
    return;
  end;
  raise exception 'FAILED: % (no error)', msg;
end $$;
grant execute on all functions in schema t to anon, authenticated;

-- ------------------------------------------------------------------ setup
\set mgr   '00000000-0000-0000-0000-0000000000a1'
\set thandi '00000000-0000-0000-0000-0000000000b1'
\set jess   '00000000-0000-0000-0000-0000000000b2'
\set sipho  '00000000-0000-0000-0000-0000000000b3'
\set naledi '00000000-0000-0000-0000-0000000000c1'
\set megan  '00000000-0000-0000-0000-0000000000c2'

insert into private.settings values ('push_function_url', 'https://example.test/functions/v1/send-push'),
                                    ('push_webhook_secret', 'test-secret');

insert into auth.users (id, email, raw_user_meta_data) values
  (:'mgr',    'manager@test', '{"full_name":"Kim Manager"}'),
  (:'thandi', 'thandi@test',  '{"full_name":"Thandi Mokoena"}'),
  (:'jess',   'jess@test',    '{"full_name":"Jess Naidoo"}'),
  (:'sipho',  'sipho@test',   '{"full_name":"Sipho Ndlovu"}'),
  (:'naledi', 'naledi@test',  '{"full_name":"Naledi Sithole","phone":"082 555 0199"}'),
  (:'megan',  'megan@test',   '{"full_name":"Megan Pretorius"}');

select t.ok((select count(*) from public.profiles where role = 'parent') = 6, 'new accounts start as parents');

-- The first manager is set by hand in the Supabase SQL editor.
update public.profiles set role = 'manager' where id = :'mgr';

-- A term around today so the tests work on any date.
insert into public.terms (name, starts_on, ends_on) values ('Test term', public.local_today() - 30, public.local_today() + 60);

-- A weekday in the past few days, and the next weekday after today.
select d::date as past from generate_series(public.local_today() - 6, public.local_today() - 1, interval '1 day') d
 where extract(isodow from d) <= 5 order by d desc limit 1 \gset
select d::date as fut from generate_series(public.local_today() + 1, public.local_today() + 7, interval '1 day') d
 where extract(isodow from d) <= 5 order by d limit 1 \gset
select id as kloof from public.areas where name = 'Kloof' \gset
select id as hillcrest from public.areas where name = 'Hillcrest' \gset
select id as kpp from public.schools where name = 'Kloof Pre-Primary' \gset
select id as hbp from public.schools where name like 'Highbury%' \gset

-- --------------------------------------------------------------- manager
select set_config('request.jwt.claim.sub', :'mgr', false);
set role authenticated;

select public.set_staff_role(:'thandi', 'coach', :'kloof');
select public.set_staff_role(:'jess', 'coach', :'kloof');
select public.set_staff_role(:'sipho', 'coach', :'hillcrest');
select t.fails(format('select public.set_staff_role(%L, ''coach'')', :'jess'), 'area', 'a coach needs an area');

insert into public.classes (school_id, weekday, starts_at, duration_min, age_group, coach_id)
values (:'kpp', extract(isodow from :'past'::date), '08:30', 60, '3–4 years', :'thandi') returning id as k_past \gset
insert into public.classes (school_id, weekday, starts_at, duration_min, age_group, coach_id)
values (:'kpp', extract(isodow from :'fut'::date), '09:00', 45, '2–3 years', :'thandi') returning id as k_fut \gset
insert into public.classes (school_id, weekday, starts_at, duration_min, age_group, coach_id)
values (:'hbp', extract(isodow from :'fut'::date), '10:00', 60, 'Grade R', :'sipho') returning id as h_fut \gset

-- ---------------------------------------------------------------- parents
reset role; select set_config('request.jwt.claim.sub', :'naledi', false); set role authenticated;

select t.fails(format('select public.sign_up_child(%L, ''Ayanda'', ''Sithole'')', :'k_past'), 'agree', 'sign-up needs POPIA consent');
select public.sign_up_child(:'k_past', 'Ayanda', 'Sithole', null, true) as ayanda \gset
select public.sign_up_child(:'k_fut', 'Lesedi', 'Sithole') as lesedi \gset
select t.ok((select popia_consent_at is not null from public.profiles where id = :'naledi'), 'consent is recorded');
select t.ok((select count(*) from public.children) = 2, 'a parent sees their own two children');
select t.fails('update public.profiles set role = ''manager''', 'permission denied', 'a parent cannot make themselves a manager');
select t.fails(format('insert into public.lessons (class_id, lesson_date, status) values (%L, %L, ''done'')', :'k_past', :'past'),
               'row-level security', 'a parent cannot write lesson records');
select t.fails('select * from public.schedule_for_day(public.local_today())', 'only managers', 'a parent cannot see the full schedule');

reset role; select set_config('request.jwt.claim.sub', :'megan', false); set role authenticated;
select public.sign_up_child(:'k_fut', 'Ruben', 'Pretorius', null, true);
select t.ok((select count(*) from public.children) = 1, 'another parent sees only their own child');
select t.fails(format('select * from public.child_term_dates(%L)', :'ayanda'), 'not found', 'a parent cannot read another family''s dates');

reset role; select set_config('request.jwt.claim.sub', :'naledi', false); set role authenticated;
select t.ok((select count(*) from public.child_term_dates(:'ayanda')) between 12 and 14, 'a parent sees every lesson date in the term');

-- ----------------------------------------------------------------- coaches
reset role; select set_config('request.jwt.claim.sub', :'thandi', false); set role authenticated;
select t.ok((select count(*) from public.children) = 3, 'a coach sees the children in their classes');
select t.ok(exists (select 1 from public.my_lessons_to_confirm() where class_id = :'k_past' and lesson_date = :'past'),
            'a finished lesson asks the coach to confirm');
select public.confirm_lesson(:'k_past', :'past', true);
select t.ok(public.coach_minutes(:'thandi', :'past', :'past') = 60, 'confirming adds 60 minutes to the coach''s hours');
select t.fails(format('select public.confirm_lesson(%L, %L, true)', :'k_fut', :'fut'), 'finished', 'future lessons cannot be confirmed');
select t.fails(format('select public.coach_minutes(%L, %L, %L)', :'jess', :'past', :'past'), 'own hours', 'a coach cannot see another coach''s hours');

-- Swaps stay inside the area.
select t.fails(format('select public.request_swap(%L, %L, %L, 2)', :'k_fut', :'sipho', :'fut'), 'same area', 'swaps only go to coaches in the same area');
select public.request_swap(:'k_fut', :'jess', :'fut', 2, 'Doctor''s appointment') as swap1 \gset
select t.fails(format('select public.request_swap(%L, %L, %L, 2)', :'k_fut', :'jess', :'fut'), 'already asked', 'no duplicate requests');
select t.fails(format('select public.cancel_lessons(%L, ''area'', %L)', :'fut', :'kloof'), 'own lessons', 'a coach cannot cancel a whole area');

reset role; select set_config('request.jwt.claim.sub', :'jess', false); set role authenticated;
select t.fails(format('select public.confirm_lesson(%L, %L, true)', :'k_past', :'past'), 'only the coach', 'only the coach taking a lesson can confirm it');
select t.ok((select count(*) from public.notifications where kind = 'swap_request') = 1, 'the other coach is notified of the request');
select public.respond_swap(:'swap1', true);
select t.ok(public.coach_for(:'k_fut', :'fut') = :'jess', 'after accepting, the new coach takes the lesson');
select t.ok(public.coach_for(:'k_fut', :'fut'::date + 14) = :'thandi', 'after the agreed weeks it goes back to the regular coach');
select t.ok((select covering_for from public.my_week(:'fut'::date - (extract(isodow from :'fut'::date)::int - 1)) where class_id = :'k_fut') = 'Thandi Mokoena',
            'the covering coach sees who they are covering for');
select t.fails(format('select public.respond_swap(%L, true)', :'swap1'), 'already been answered', 'a request can only be answered once');

-- The covering coach can cancel that lesson; parents are told.
select (public.cancel_lessons(:'fut', 'lesson', :'k_fut', 'Coach is sick') ->> 'parents')::int as n \gset
select t.ok(:n = 2, 'cancelling one lesson tells both families');

reset role; select set_config('request.jwt.claim.sub', :'thandi', false); set role authenticated;
select t.ok(exists (select 1 from public.notifications where kind = 'swap_answer'), 'the first coach hears the answer');

-- ---------------------------------------------------------------- manager
reset role; select set_config('request.jwt.claim.sub', :'mgr', false); set role authenticated;
select t.ok((public.cancel_preview(:'fut', 'all') ->> 'lessons')::int = 1, 'the preview skips lessons already cancelled');
select t.ok(exists (select 1 from public.notifications where kind = 'coach_cancelled'), 'the manager hears when a coach cancels');
select (public.cancel_lessons(:'fut', 'all', null, 'Rain', 'See you next week!') ->> 'lessons')::int as n \gset
select t.ok(:n = 1, 'a manager can cancel every lesson on a day');
select t.ok((select count(*) from public.schedule_for_day(:'fut') where state = 'cancelled') = 2, 'the schedule shows both lessons as cancelled');
select t.ok((select minutes from public.coach_summary(:'past') where coach_id = :'thandi') = 60, 'the manager sees coach hours');
select t.fails('select public.cancel_lessons(public.local_today() - 1, ''all'')', 'today onwards', 'past lessons cannot be cancelled');

reset role; select set_config('request.jwt.claim.sub', :'naledi', false); set role authenticated;
select t.ok((select count(*) from public.notifications where kind = 'cancelled') = 1, 'the parent got one cancellation message');
select t.ok((select body from public.notifications where kind = 'cancelled') like 'Lesedi''s Playball at Kloof Pre-Primary%because the coach is unwell.',
            'the message names the child, school and reason');
select t.ok((select state from public.child_term_dates(:'lesedi') where lesson_date = :'fut') = 'cancelled', 'the term dates show the cancellation');
update public.notifications set read_at = now();
select t.fails('update public.notifications set body = ''x''', 'permission denied', 'a parent cannot edit message text');

-- ------------------------------------------------------------- signed out
reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;
select t.fails('select * from public.children', 'permission denied', 'signed-out visitors cannot read children');
select t.fails(format('select public.cancel_lessons(%L, ''all'')', :'fut'), 'permission denied', 'signed-out visitors cannot cancel');

-- ------------------------------------------------------------------- push
reset role;
select t.ok((select count(*) from net.calls) > 0, 'new messages are sent to the push function');
select t.ok((select bool_and(headers ->> 'x-webhook-secret' = 'test-secret') from net.calls), 'push calls carry the secret');
select t.ok((select sum(jsonb_array_length(body -> 'ids')) from net.calls) = (select count(*) from public.notifications),
            'every message is handed to the push function exactly once');

