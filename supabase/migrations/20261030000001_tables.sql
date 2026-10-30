-- Playball: core tables.
-- Scheduled lessons are not stored. A class repeats every week on its weekday,
-- and the `lessons` table only records what happened to a given date
-- (done, didn't happen, cancelled). That keeps the database tiny.

create type public.user_role as enum ('manager', 'coach', 'parent');
create type public.lesson_status as enum ('done', 'missed', 'cancelled');
create type public.swap_status as enum ('pending', 'accepted', 'declined', 'withdrawn');

-- Areas group schools. Coaches can only swap lessons inside their own area.
create table public.areas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.schools (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(trim(name)) > 0),
  area_id    uuid not null references public.areas (id) on delete restrict,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index schools_area_idx on public.schools (area_id);

create table public.terms (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  starts_on date not null,
  ends_on   date not null,
  check (ends_on > starts_on)
);

-- One row per signed-up person. Created automatically when someone makes an
-- account (see handle_new_user). Everyone starts as a parent; a manager
-- promotes coaches and other managers with set_staff_role().
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  role             public.user_role not null default 'parent',
  full_name        text not null default '',
  phone            text,
  area_id          uuid references public.areas (id) on delete set null,
  popia_consent_at timestamptz,
  created_at       timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

-- A class is a weekly slot: a school, a weekday, a time and an age group.
create table public.classes (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools (id) on delete cascade,
  weekday      smallint not null check (weekday between 1 and 5), -- 1 = Monday
  starts_at    time not null,
  duration_min smallint not null default 60 check (duration_min between 15 and 180),
  age_group    text not null,
  coach_id     uuid not null references public.profiles (id),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index classes_weekday_idx on public.classes (weekday) where active;
create index classes_coach_idx on public.classes (coach_id);
create index classes_school_idx on public.classes (school_id);

create table public.children (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid not null references public.profiles (id) on delete cascade,
  class_id      uuid not null references public.classes (id) on delete restrict,
  first_name    text not null check (length(trim(first_name)) > 0),
  last_name     text not null check (length(trim(last_name)) > 0),
  medical_notes text,
  created_at    timestamptz not null default now()
);
create index children_parent_idx on public.children (parent_id);
create index children_class_idx on public.children (class_id);

-- What happened to one class on one date. No row means "scheduled".
-- coach_id is who actually coached it, so hours follow the person.
create table public.lessons (
  class_id    uuid not null references public.classes (id) on delete cascade,
  lesson_date date not null,
  status      public.lesson_status not null,
  coach_id    uuid references public.profiles (id),
  reason      text,
  recorded_by uuid references public.profiles (id),
  recorded_at timestamptz not null default now(),
  primary key (class_id, lesson_date)
);
create index lessons_coach_idx on public.lessons (coach_id, lesson_date);

-- A coach handing a class to another coach for a number of weeks.
create table public.swaps (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes (id) on delete cascade,
  from_coach   uuid not null references public.profiles (id),
  to_coach     uuid not null references public.profiles (id),
  first_date   date not null,
  weeks        smallint not null check (weeks between 1 and 20),
  status       public.swap_status not null default 'pending',
  note         text,
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (from_coach <> to_coach)
);
create index swaps_class_accepted_idx on public.swaps (class_id) where status = 'accepted';
create index swaps_to_pending_idx on public.swaps (to_coach) where status = 'pending';
create index swaps_from_idx on public.swaps (from_coach);

-- In-app messages. Every insert is also sent as a push notification.
create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null,
  data       jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Expo push tokens, one per phone.
create table public.push_tokens (
  token      text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  platform   text check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- A record of every cancellation the manager or a coach sent.
create table public.cancellations (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid references public.profiles (id) on delete set null,
  lesson_date  date not null,
  scope        text not null,
  reason       text not null,
  note         text,
  lesson_count int not null,
  parent_count int not null,
  created_at   timestamptz not null default now()
);

-- Create a profile for every new account.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
