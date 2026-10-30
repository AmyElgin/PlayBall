-- Playball: helper functions and row level security.
-- Parents see only their own children. Coaches see their own classes (and ones
-- they are covering). Managers see everything. All lesson, swap and
-- cancellation changes go through the functions in the next migration.

create function public.local_now()
returns timestamp
language sql
stable
as $$ select now() at time zone 'Africa/Johannesburg' $$;

create function public.local_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Africa/Johannesburg')::date $$;

create function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select role = 'manager' from public.profiles where id = auth.uid()), false) $$;

-- Who coaches a class on a date: the latest accepted swap covering that date,
-- otherwise the regular coach.
create function public.coach_for(p_class uuid, p_date date)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.to_coach
       from public.swaps s
      where s.class_id = p_class
        and s.status = 'accepted'
        and p_date between s.first_date and s.first_date + (s.weeks * 7 - 1)
      order by s.responded_at desc nulls last
      limit 1),
    (select c.coach_id from public.classes c where c.id = p_class)
  )
$$;

-- True if the signed-in coach is the regular coach or has covered the class.
create function public.coaches_class(p_class uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.classes where id = p_class and coach_id = auth.uid())
      or exists (select 1 from public.swaps where class_id = p_class and to_coach = auth.uid() and status = 'accepted')
$$;

create function public.parent_of_class(p_class uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.children where class_id = p_class and parent_id = auth.uid()) $$;

-- Lesson state for the apps: done / missed / cancelled / unconfirmed / live / upcoming.
create function public.lesson_state(p_date date, p_start time, p_minutes int, p_status public.lesson_status)
returns text
language sql
stable
as $$
  select case
    when p_status is not null then p_status::text
    when p_date + p_start + make_interval(mins => p_minutes) < public.local_now() then 'unconfirmed'
    when p_date + p_start <= public.local_now() then 'live'
    else 'upcoming'
  end
$$;

alter table public.areas enable row level security;
alter table public.schools enable row level security;
alter table public.terms enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.children enable row level security;
alter table public.lessons enable row level security;
alter table public.swaps enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.cancellations enable row level security;

-- Reference data: everyone signed in can read it, managers can change it.
create policy "Signed-in users read areas" on public.areas for select to authenticated using (true);
create policy "Managers manage areas" on public.areas for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "Signed-in users read schools" on public.schools for select to authenticated using (true);
create policy "Managers manage schools" on public.schools for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "Signed-in users read terms" on public.terms for select to authenticated using (true);
create policy "Managers manage terms" on public.terms for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "Signed-in users read classes" on public.classes for select to authenticated using (true);
create policy "Managers manage classes" on public.classes for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- Profiles: your own, plus coaches can see other staff (for swaps).
create policy "Read own or staff profiles" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_manager()
    or (public.my_role() = 'coach' and role in ('coach', 'manager'))
  );
create policy "Update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- People may only change their name, phone and consent. Role and area go
-- through set_staff_role().
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone, popia_consent_at) on public.profiles to authenticated;

-- Children
create policy "Read own, coached or all children" on public.children for select to authenticated
  using (parent_id = auth.uid() or public.is_manager() or public.coaches_class(class_id));
create policy "Parents add their children" on public.children for insert to authenticated
  with check (parent_id = auth.uid());
create policy "Parents update their children" on public.children for update to authenticated
  using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy "Parents remove their children" on public.children for delete to authenticated
  using (parent_id = auth.uid());
create policy "Managers manage children" on public.children for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- Lesson records: read-only from the apps. Written by functions.
create policy "Read relevant lessons" on public.lessons for select to authenticated
  using (
    public.is_manager()
    or coach_id = auth.uid()
    or public.coaches_class(class_id)
    or public.parent_of_class(class_id)
  );

create policy "Read own swaps" on public.swaps for select to authenticated
  using (public.is_manager() or from_coach = auth.uid() or to_coach = auth.uid());

create policy "Read own notifications" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "Mark own notifications read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

create policy "Manage own push tokens" on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Managers read cancellations" on public.cancellations for select to authenticated
  using (public.is_manager());

-- Nothing is visible without signing in.
revoke all on all tables in schema public from anon;
