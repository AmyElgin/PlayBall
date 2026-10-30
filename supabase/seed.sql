-- Starting data: Upper Highway areas and Playball venues.
-- The areas each school sits in are a best guess; managers can move schools
-- in the app. Term dates are placeholders until Playball confirms them.

insert into public.areas (name) values ('Kloof'), ('Hillcrest'), ('Waterfall')
on conflict (name) do nothing;

insert into public.schools (name, area_id)
select v.school, a.id
  from (values
    ('Kloof Pre-Primary', 'Kloof'),
    ('Thomas More Primary', 'Kloof'),
    ('Little Lambs Preschool', 'Kloof'),
    ('Ladybird Pre-School', 'Kloof'),
    ('Highbury Preparatory School (Weavers Nest)', 'Hillcrest'),
    ('Tiny Achievers', 'Hillcrest'),
    ('Little Red Hen Pre-Primary', 'Hillcrest'),
    ('Smarty Box Pre-Primary', 'Hillcrest'),
    ('Simon Peter Pre-School', 'Hillcrest'),
    ('Little Heroes Preschool', 'Hillcrest'),
    ('Waterfall Pre-Primary', 'Waterfall'),
    ('Waterfall Educare', 'Waterfall'),
    ('Waterfall Edufarm', 'Waterfall'),
    ('Bright Buttons', 'Waterfall'),
    ('Small World Pre-Primary', 'Waterfall'),
    ('Little Poppets Daycare & Nursery School', 'Waterfall'),
    ('Jean''s Playglen', 'Kloof'),
    ('Kids Kingdom Pre-Primary School', 'Hillcrest')
  ) as v(school, area)
  join public.areas a on a.name = v.area
on conflict (name) do nothing;

insert into public.terms (name, starts_on, ends_on)
select 'Term 4 2026', date '2026-10-06', date '2026-12-09'
 where not exists (select 1 from public.terms where name = 'Term 4 2026');
