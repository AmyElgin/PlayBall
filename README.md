# Playball Coach Hub

Backend for the Playball app: one Supabase project that serves the iPhone and
Android apps for managers, coaches and parents.

- `mobile/` is the iPhone app (Expo). See `mobile/README.md`.
- `prototype/index.html` is the clickable design the app follows.
- `supabase/migrations/` is the database: tables, security rules and the actions the apps call.
- `supabase/functions/send-push/` sends push notifications through Expo.
- `supabase/seed.sql` adds the Upper Highway areas, venues and the current term.
- `tests/` checks the rules against a real Postgres (`tests/run.sh`).

## How it works

| Who | Can see | Can do |
|---|---|---|
| Parent | Their own children, those classes' term dates, their messages | Sign up a child (with POPIA consent), edit their children |
| Coach | Their classes and lessons they cover, those children, other coaches' names | Confirm lessons (adds hours), give lessons to coaches in the same area, accept or decline requests, cancel a lesson they are taking |
| Manager | Everything | Cancel one lesson, a school, an area or a whole day; manage schools, areas, classes, terms; make people coaches or managers |

Scheduled lessons are not stored. Each class repeats weekly, and the database
only records what happened on a date (done, didn't happen, cancelled). That is
why the data stays around 20–25 MB a year for 3,000 children.

Every message the database creates is also sent as a push notification, in
batches of 500 per web request, so a rainy morning with thousands of parents
is a handful of calls.

### Actions the apps call (`supabase.rpc(...)`)

| Function | Used by | What it does |
|---|---|---|
| `schedule_for_day(date)` | Manager | Every lesson on a day with coach and status |
| `cancel_preview(date, scope, target)` | Manager, coach | How many lessons and parents a cancellation reaches |
| `cancel_lessons(date, scope, target, reason, note)` | Manager, coach | Cancels and messages parents and coaches. `scope` is `all`, `area`, `school` or `lesson` |
| `coach_summary(month)` | Manager | Hours per coach and lessons still to confirm |
| `set_staff_role(user, role, area)` | Manager | Turns an account into a coach or manager |
| `my_week(monday)` | Coach | The coach's lessons, including ones they cover or gave away |
| `my_lessons_to_confirm()` | Coach | "Did this lesson happen?" list |
| `confirm_lesson(class, date, happened, reason)` | Coach | Records the answer; yes adds the hours |
| `coach_minutes(coach, from, to)` | Coach, manager | Confirmed minutes in a date range |
| `request_swap(class, to_coach, first_date, weeks, note)` | Coach | Asks a coach in the same area to take a lesson |
| `respond_swap(swap, accept)` / `withdraw_swap(swap)` | Coach | Answers or withdraws a request |
| `sign_up_child(class, first, last, medical, consent)` | Parent | Adds a child to a class |
| `child_term_dates(child)` | Parent | Every lesson date this term and what happened |

Simple lists (areas, schools, classes, children, notifications) are read
straight from the tables; the security rules decide what each person sees.

## Setting it up on Supabase

1. Create a project at supabase.com. Choose the region closest to South Africa
   that is offered. Start on the free plan; move to Pro ($25/month) before
   launch, because free projects pause after a week without use.
2. Install the Supabase CLI, then from this folder set it up and link the project:
   ```bash
   supabase init
   ```
   ```bash
   supabase login
   ```
   ```bash
   supabase link --project-ref <your-project-ref>
   ```
3. Create the database and add the venues:
   ```bash
   supabase db push --include-seed
   ```
4. Deploy the push sender and give it a secret (any long random string):
   ```bash
   supabase functions deploy send-push --no-verify-jwt
   ```
   ```bash
   supabase secrets set PUSH_WEBHOOK_SECRET=<long-random-string>
   ```
5. In the Supabase SQL editor, tell the database where to send pushes:
   ```sql
   insert into private.settings values
     ('push_function_url', 'https://<your-project-ref>.supabase.co/functions/v1/send-push'),
     ('push_webhook_secret', '<the same long-random-string>');
   ```
6. Make the first manager. Sign up in the app (or under Authentication in the
   dashboard), then in the SQL editor:
   ```sql
   update public.profiles set role = 'manager'
   where id = (select id from auth.users where email = '<manager email>');
   ```
   After that, managers make coaches from the app.

## Before launch

- Confirm the term dates in `seed.sql` (placeholders) and which area each venue
  belongs to.
- POPIA: the app stores children's names and medical notes and parents' phone
  numbers. Parents agree at sign-up (`popia_consent_at`). Playball needs a
  privacy notice and a named information officer.
- Email sign-in is free. Avoid SMS one-time codes unless Playball accepts the
  per-message cost.

## Running the tests

```bash
tests/run.sh
```

Needs Postgres 15 or newer installed locally. The tests use small stand-ins
for Supabase's `auth` schema and `pg_net` (`tests/supabase_stubs.sql`).
