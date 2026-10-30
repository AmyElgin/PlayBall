-- Playball: the actions the apps call (Supabase RPC).
-- Each one checks who is calling, so the rules hold whatever the app sends.

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------- helpers

create function public.reason_phrase(p_reason text)
returns text
language sql
immutable
as $$
  select case p_reason
    when 'Rain' then ' because of rain'
    when 'Too hot' then ' because of the heat'
    when 'Coach is sick' then ' because the coach is unwell'
    when 'School event' then ' because of a school event'
    else ''
  end
$$;

create function public.day_phrase(p_date date)
returns text
language sql
stable
as $$
  select case
    when p_date = public.local_today() then 'today'
    when p_date = public.local_today() + 1 then 'tomorrow'
    else 'on ' || to_char(p_date, 'FMDay FMDD FMMonth')
  end
$$;

create function public.current_term()
returns public.terms
language sql
stable
security definer
set search_path = ''
as $$
  select t.* from public.terms t
   where t.ends_on >= public.local_today()
   order by t.starts_on
   limit 1
$$;

-- Classes on a date that can still be cancelled, for a scope:
-- 'all', 'area' (p_target = area id), 'school' (school id), 'lesson' (class id).
create function private.cancellable_classes(p_date date, p_scope text, p_target uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(c.id order by c.starts_at), '{}')
    from public.classes c
    join public.schools s on s.id = c.school_id
   where c.active
     and c.weekday = extract(isodow from p_date)
     and case p_scope
           when 'all' then true
           when 'area' then s.area_id = p_target
           when 'school' then c.school_id = p_target
           when 'lesson' then c.id = p_target
           else false
         end
     and not exists (
       select 1 from public.lessons l
        where l.class_id = c.id and l.lesson_date = p_date and l.status in ('done', 'cancelled')
     )
$$;

-- --------------------------------------------------------- cancellations

-- How many lessons and parents a cancellation would reach. Used on the
-- "Check and send" screen.
create function public.cancel_preview(p_date date, p_scope text, p_target uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_classes uuid[];
begin
  if public.my_role() not in ('manager', 'coach') then
    raise exception 'Only staff can cancel lessons';
  end if;
  v_classes := private.cancellable_classes(p_date, p_scope, p_target);
  return jsonb_build_object(
    'lessons', cardinality(v_classes),
    'parents', (select count(distinct parent_id) from public.children where class_id = any (v_classes))
  );
end;
$$;

-- Cancel lessons and message every parent (one message per child) and coach.
-- Managers can cancel anything. Coaches can cancel one lesson they are coaching.
create function public.cancel_lessons(
  p_date   date,
  p_scope  text,
  p_target uuid default null,
  p_reason text default 'Rain',
  p_note   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := auth.uid();
  v_role    public.user_role := public.my_role();
  v_classes uuid[];
  v_parents int;
  v_note    text := nullif(trim(coalesce(p_note, '')), '');
begin
  if v_role is null or v_role = 'parent' then
    raise exception 'Only staff can cancel lessons';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Choose a reason';
  end if;
  if extract(isodow from p_date) > 5 then
    raise exception 'There are no lessons on weekends';
  end if;
  if p_date < public.local_today() then
    raise exception 'You can only cancel lessons from today onwards';
  end if;

  v_classes := private.cancellable_classes(p_date, p_scope, p_target);

  if v_role = 'coach' and (p_scope <> 'lesson' or public.coach_for(p_target, p_date) is distinct from v_me) then
    raise exception 'Coaches can only cancel their own lessons';
  end if;

  if cardinality(v_classes) = 0 then
    return jsonb_build_object('lessons', 0, 'parents', 0);
  end if;

  insert into public.lessons (class_id, lesson_date, status, coach_id, reason, recorded_by)
  select id, p_date, 'cancelled', public.coach_for(id, p_date), p_reason, v_me
    from unnest(v_classes) as id
  on conflict (class_id, lesson_date) do update
    set status = 'cancelled', reason = excluded.reason,
        recorded_by = excluded.recorded_by, recorded_at = now();

  -- Parents: one message per child.
  insert into public.notifications (user_id, kind, title, body, data)
  select ch.parent_id, 'cancelled', 'Lesson cancelled',
         format('%s''s Playball at %s %s (%s) is cancelled%s.%s',
                ch.first_name, s.name, public.day_phrase(p_date), to_char(c.starts_at, 'HH24:MI'),
                public.reason_phrase(p_reason), coalesce(' ' || v_note, '')),
         jsonb_build_object('class_id', c.id, 'date', p_date, 'child_id', ch.id)
    from public.children ch
    join public.classes c on c.id = ch.class_id
    join public.schools s on s.id = c.school_id
   where ch.class_id = any (v_classes);

  select count(distinct parent_id) into v_parents
    from public.children where class_id = any (v_classes);

  -- Coaches who were going to take those lessons (not the person cancelling).
  insert into public.notifications (user_id, kind, title, body, data)
  select x.coach, 'cancelled', 'Lesson cancelled',
         format('%s, %s at %s. %s.', s.name, to_char(p_date, 'Dy DD Mon'), to_char(c.starts_at, 'HH24:MI'), p_reason),
         jsonb_build_object('class_id', c.id, 'date', p_date)
    from public.classes c
    join public.schools s on s.id = c.school_id
    cross join lateral (select public.coach_for(c.id, p_date) as coach) x
   where c.id = any (v_classes) and x.coach <> v_me;

  -- Managers hear about it when a coach cancels.
  if v_role = 'coach' then
    insert into public.notifications (user_id, kind, title, body, data)
    select p.id, 'coach_cancelled', 'A coach cancelled a lesson',
           format('%s: %s, %s at %s. %s.', me.full_name, s.name, to_char(p_date, 'Dy DD Mon'), to_char(c.starts_at, 'HH24:MI'), p_reason),
           jsonb_build_object('class_id', c.id, 'date', p_date)
      from public.profiles p
      cross join public.profiles me
      join public.classes c on c.id = p_target
      join public.schools s on s.id = c.school_id
     where p.role = 'manager' and me.id = v_me;
  end if;

  insert into public.cancellations (created_by, lesson_date, scope, reason, note, lesson_count, parent_count)
  values (v_me, p_date, p_scope, p_reason, v_note, cardinality(v_classes), v_parents);

  return jsonb_build_object('lessons', cardinality(v_classes), 'parents', v_parents);
end;
$$;

-- ------------------------------------------------------ coach: confirming

-- "Did this lesson happen?" Yes adds the hours to the coach who answered.
create function public.confirm_lesson(p_class uuid, p_date date, p_happened boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  c    public.classes;
begin
  select * into c from public.classes where id = p_class;
  if not found or c.weekday <> extract(isodow from p_date) then
    raise exception 'There is no lesson for this class on that day';
  end if;
  if public.coach_for(p_class, p_date) is distinct from v_me then
    raise exception 'Only the coach taking this lesson can confirm it';
  end if;
  if p_date + c.starts_at + make_interval(mins => c.duration_min) > public.local_now() then
    raise exception 'This lesson hasn''t finished yet';
  end if;
  if p_date < public.local_today() - 31 then
    raise exception 'Lessons older than a month can only be changed by a manager';
  end if;
  if exists (select 1 from public.lessons where class_id = p_class and lesson_date = p_date and status = 'cancelled') then
    raise exception 'This lesson was cancelled';
  end if;

  insert into public.lessons (class_id, lesson_date, status, coach_id, reason, recorded_by)
  values (p_class, p_date, case when p_happened then 'done' else 'missed' end::public.lesson_status, v_me,
          case when p_happened then null else p_reason end, v_me)
  on conflict (class_id, lesson_date) do update
    set status = excluded.status, coach_id = excluded.coach_id, reason = excluded.reason,
        recorded_by = excluded.recorded_by, recorded_at = now();

  if not p_happened then
    insert into public.notifications (user_id, kind, title, body, data)
    select p.id, 'missed', 'A lesson didn''t happen',
           format('%s: %s, %s at %s. %s.', me.full_name, s.name, to_char(p_date, 'Dy DD Mon'),
                  to_char(c.starts_at, 'HH24:MI'), coalesce(p_reason, 'No reason given')),
           jsonb_build_object('class_id', p_class, 'date', p_date)
      from public.profiles p
      cross join public.profiles me
      join public.schools s on s.id = c.school_id
     where p.role = 'manager' and me.id = v_me;
  end if;
end;
$$;

-- --------------------------------------------------------------- swaps

create function public.request_swap(p_class uuid, p_to_coach uuid, p_first_date date, p_weeks int, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := auth.uid();
  c      public.classes;
  v_area uuid;
  v_to   public.profiles;
  v_id   uuid;
begin
  if public.my_role() <> 'coach' then
    raise exception 'Only coaches can give lessons away';
  end if;
  select * into c from public.classes where id = p_class and active;
  if not found then
    raise exception 'That class doesn''t exist';
  end if;
  if c.weekday <> extract(isodow from p_first_date) then
    raise exception 'The first date must be a % for this class', to_char(p_first_date, 'FMDay');
  end if;
  if p_first_date < public.local_today() then
    raise exception 'You can''t give away a lesson in the past';
  end if;
  if p_weeks not between 1 and 20 then
    raise exception 'Choose between 1 and 20 weeks';
  end if;
  if public.coach_for(p_class, p_first_date) is distinct from v_me then
    raise exception 'You can only give away lessons you are coaching';
  end if;

  select area_id into v_area from public.schools where id = c.school_id;
  select * into v_to from public.profiles where id = p_to_coach;
  if not found or v_to.role <> 'coach' or v_to.id = v_me then
    raise exception 'Choose another coach';
  end if;
  if v_to.area_id is distinct from v_area then
    raise exception 'You can only give lessons to coaches in the same area';
  end if;
  if exists (select 1 from public.swaps
              where class_id = p_class and from_coach = v_me and first_date = p_first_date and status = 'pending') then
    raise exception 'You already asked someone to take this lesson. Wait for an answer first.';
  end if;

  insert into public.swaps (class_id, from_coach, to_coach, first_date, weeks, note)
  values (p_class, v_me, p_to_coach, p_first_date, p_weeks, nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;

  insert into public.notifications (user_id, kind, title, body, data)
  select p_to_coach, 'swap_request',
         format('%s asked you to take a lesson', split_part(me.full_name, ' ', 1)),
         format('%s, %ss at %s, %s week%s from %s.', s.name, to_char(p_first_date, 'FMDay'),
                to_char(c.starts_at, 'HH24:MI'), p_weeks, case when p_weeks > 1 then 's' else '' end,
                to_char(p_first_date, 'FMDD Mon')),
         jsonb_build_object('swap_id', v_id)
    from public.profiles me, public.schools s
   where me.id = v_me and s.id = c.school_id;

  return v_id;
end;
$$;

create function public.respond_swap(p_swap uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  sw   public.swaps;
  v_school text;
  v_to_name text;
begin
  select * into sw from public.swaps where id = p_swap for update;
  if not found or sw.to_coach is distinct from v_me then
    raise exception 'This request isn''t for you';
  end if;
  if sw.status <> 'pending' then
    raise exception 'This request has already been answered';
  end if;

  update public.swaps
     set status = case when p_accept then 'accepted' else 'declined' end::public.swap_status,
         responded_at = now()
   where id = p_swap;

  select s.name into v_school from public.classes c join public.schools s on s.id = c.school_id where c.id = sw.class_id;
  select split_part(full_name, ' ', 1) into v_to_name from public.profiles where id = v_me;

  insert into public.notifications (user_id, kind, title, body, data)
  values (sw.from_coach, 'swap_answer',
          case when p_accept then format('%s said yes', v_to_name) else format('%s can''t take your lesson', v_to_name) end,
          case when p_accept then format('They will take %s for %s week%s from %s.', v_school, sw.weeks,
                                         case when sw.weeks > 1 then 's' else '' end, to_char(sw.first_date, 'FMDD Mon'))
               else 'Try another coach in your area.' end,
          jsonb_build_object('swap_id', p_swap));

  if p_accept then
    insert into public.notifications (user_id, kind, title, body, data)
    select p.id, 'swap_agreed', 'Lesson swap agreed',
           format('%s → %s: %s, %s week%s from %s.', f.full_name, t.full_name, v_school, sw.weeks,
                  case when sw.weeks > 1 then 's' else '' end, to_char(sw.first_date, 'FMDD Mon')),
           jsonb_build_object('swap_id', p_swap)
      from public.profiles p, public.profiles f, public.profiles t
     where p.role = 'manager' and f.id = sw.from_coach and t.id = sw.to_coach;
  end if;
end;
$$;

create function public.withdraw_swap(p_swap uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.swaps set status = 'withdrawn', responded_at = now()
   where id = p_swap and from_coach = auth.uid() and status = 'pending';
  if not found then
    raise exception 'You can only withdraw your own requests that haven''t been answered';
  end if;
end;
$$;

-- ------------------------------------------------------------- parents

create function public.sign_up_child(
  p_class uuid,
  p_first_name text,
  p_last_name text,
  p_medical_notes text default null,
  p_popia_consent boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if public.my_role() is null then
    raise exception 'Please sign in first';
  end if;
  if not exists (select 1 from public.classes where id = p_class and active) then
    raise exception 'That lesson time is no longer available';
  end if;
  if not p_popia_consent and (select popia_consent_at from public.profiles where id = v_me) is null then
    raise exception 'Please agree to how Playball uses your information';
  end if;

  update public.profiles set popia_consent_at = coalesce(popia_consent_at, now()) where id = v_me;

  insert into public.children (parent_id, class_id, first_name, last_name, medical_notes)
  values (v_me, p_class, trim(p_first_name), trim(p_last_name), nullif(trim(coalesce(p_medical_notes, '')), ''))
  returning id into v_id;

  insert into public.notifications (user_id, kind, title, body, data)
  select v_me, 'signed_up', format('%s is signed up', trim(p_first_name)),
         format('%s, every %s at %s.', s.name, to_char(date '2024-01-01' + (c.weekday - 1), 'FMDay'), to_char(c.starts_at, 'HH24:MI')),
         jsonb_build_object('child_id', v_id)
    from public.classes c join public.schools s on s.id = c.school_id
   where c.id = p_class;

  insert into public.notifications (user_id, kind, title, body, data)
  select c.coach_id, 'new_child', 'New child in your class',
         format('%s %s joined %s (%s).', trim(p_first_name), trim(p_last_name), s.name, c.age_group),
         jsonb_build_object('child_id', v_id)
    from public.classes c join public.schools s on s.id = c.school_id
   where c.id = p_class;

  return v_id;
end;
$$;

-- Every lesson date this term for one child, with what happened.
create function public.child_term_dates(p_child uuid)
returns table (lesson_date date, starts_at time, duration_min int, state text, reason text, coach_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ch public.children;
  t  public.terms := public.current_term();
begin
  select * into ch from public.children where id = p_child;
  if not found or (ch.parent_id is distinct from auth.uid() and not public.is_manager()) then
    raise exception 'Child not found';
  end if;
  if t.id is null then
    return;
  end if;

  return query
  select d::date, c.starts_at, c.duration_min::int,
         public.lesson_state(d::date, c.starts_at, c.duration_min, l.status),
         l.reason,
         split_part(p.full_name, ' ', 1)
    from public.classes c
    cross join generate_series(t.starts_on, t.ends_on, interval '1 day') d
    left join public.lessons l on l.class_id = c.id and l.lesson_date = d::date
    left join public.profiles p on p.id = public.coach_for(c.id, d::date)
   where c.id = ch.class_id
     and extract(isodow from d) = c.weekday
   order by d;
end;
$$;

-- ------------------------------------------------------------- coaches

-- A coach's lessons for the week starting p_monday, including lessons they
-- are covering and ones they have given away.
create function public.my_week(p_monday date)
returns table (
  lesson_date date, class_id uuid, school_name text, area_name text, starts_at time,
  duration_min int, age_group text, child_count int, state text, reason text,
  is_mine boolean, covering_for text, given_to text
)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select (p_monday + i)::date as d from generate_series(0, 4) i
  )
  select days.d, c.id, s.name, a.name, c.starts_at, c.duration_min::int, c.age_group,
         (select count(*) from public.children ch where ch.class_id = c.id)::int,
         public.lesson_state(days.d, c.starts_at, c.duration_min, l.status),
         l.reason,
         x.coach = auth.uid(),
         case when x.coach = auth.uid() and c.coach_id <> auth.uid() then (select full_name from public.profiles where id = c.coach_id) end,
         case when x.coach <> auth.uid() then (select full_name from public.profiles where id = x.coach) end
    from days
    join public.classes c on c.weekday = extract(isodow from days.d) and c.active
    join public.schools s on s.id = c.school_id
    join public.areas a on a.id = s.area_id
    cross join lateral (select public.coach_for(c.id, days.d) as coach) x
    left join public.lessons l on l.class_id = c.id and l.lesson_date = days.d
   where c.coach_id = auth.uid() or x.coach = auth.uid()
   order by days.d, c.starts_at
$$;

-- Lessons from the last week that the signed-in coach still has to confirm.
create function public.my_lessons_to_confirm()
returns table (lesson_date date, class_id uuid, school_name text, starts_at time, duration_min int)
language sql
stable
security definer
set search_path = ''
as $$
  select d::date, c.id, s.name, c.starts_at, c.duration_min::int
    from generate_series(public.local_today() - 7, public.local_today(), interval '1 day') d
    join public.classes c on c.weekday = extract(isodow from d) and c.active
    join public.schools s on s.id = c.school_id
   where public.coach_for(c.id, d::date) = auth.uid()
     and not exists (select 1 from public.lessons l where l.class_id = c.id and l.lesson_date = d::date)
     and d::date + c.starts_at + make_interval(mins => c.duration_min) < public.local_now()
   order by d, c.starts_at
$$;

-- Minutes coached (confirmed lessons only) between two dates.
create function public.coach_minutes(p_coach uuid, p_from date, p_to date)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_coach is distinct from auth.uid() and not public.is_manager() then
    raise exception 'You can only see your own hours';
  end if;
  return coalesce((
    select sum(c.duration_min)
      from public.lessons l join public.classes c on c.id = l.class_id
     where l.coach_id = p_coach and l.status = 'done' and l.lesson_date between p_from and p_to
  ), 0);
end;
$$;

-- ------------------------------------------------------------ managers

-- Every lesson on one day, for the manager's schedule screen.
create function public.schedule_for_day(p_date date)
returns table (
  class_id uuid, school_name text, area_id uuid, area_name text, starts_at time, duration_min int,
  age_group text, coach_id uuid, coach_name text, covering boolean, child_count int, state text, reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_manager() then
    raise exception 'Only managers can see the full schedule';
  end if;
  return query
  select c.id, s.name, a.id, a.name, c.starts_at, c.duration_min::int, c.age_group,
         x.coach, p.full_name, x.coach <> c.coach_id,
         (select count(*) from public.children ch where ch.class_id = c.id)::int,
         public.lesson_state(p_date, c.starts_at, c.duration_min, l.status),
         l.reason
    from public.classes c
    join public.schools s on s.id = c.school_id
    join public.areas a on a.id = s.area_id
    cross join lateral (select public.coach_for(c.id, p_date) as coach) x
    join public.profiles p on p.id = x.coach
    left join public.lessons l on l.class_id = c.id and l.lesson_date = p_date
   where c.active and c.weekday = extract(isodow from p_date)
   order by a.name, c.starts_at;
end;
$$;

-- Hours this month and lessons waiting for confirmation, per coach.
create function public.coach_summary(p_month date default null)
returns table (coach_id uuid, full_name text, area_name text, minutes int, to_confirm int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := date_trunc('month', coalesce(p_month, public.local_today()))::date;
  v_to   date := (date_trunc('month', coalesce(p_month, public.local_today())) + interval '1 month - 1 day')::date;
begin
  if not public.is_manager() then
    raise exception 'Only managers can see all coaches';
  end if;
  return query
  select p.id, p.full_name, a.name,
         coalesce((select sum(c.duration_min) from public.lessons l join public.classes c on c.id = l.class_id
                    where l.coach_id = p.id and l.status = 'done' and l.lesson_date between v_from and v_to), 0)::int,
         (select count(*)
            from generate_series(public.local_today() - 7, public.local_today(), interval '1 day') d
            join public.classes c on c.weekday = extract(isodow from d) and c.active
           where public.coach_for(c.id, d::date) = p.id
             and not exists (select 1 from public.lessons l where l.class_id = c.id and l.lesson_date = d::date)
             and d::date + c.starts_at + make_interval(mins => c.duration_min) < public.local_now())::int
    from public.profiles p
    left join public.areas a on a.id = p.area_id
   where p.role = 'coach'
   order by a.name, p.full_name;
end;
$$;

-- Promote someone to coach or manager (or back to parent).
create function public.set_staff_role(p_user uuid, p_role public.user_role, p_area uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_manager() then
    raise exception 'Only managers can change roles';
  end if;
  if p_role = 'coach' and p_area is null then
    raise exception 'Choose an area for this coach';
  end if;
  update public.profiles set role = p_role, area_id = p_area where id = p_user;
  if not found then
    raise exception 'That person hasn''t made an account yet';
  end if;
end;
$$;

-- Internal helpers are not callable from the apps.
revoke execute on all functions in schema private from public, anon, authenticated;
-- Signed-out visitors can't call anything; signed-in users can call the
-- functions above, which check who they are.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
