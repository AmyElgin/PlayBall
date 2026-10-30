import { today } from './dates';
import { supabase } from './supabase';
import type {
  Area, Child, ClassRow, CoachSummary, DayLesson, Note, Profile, School, Swap, Term, TermDate, ToConfirm, WeekLesson,
} from './types';

// Thin wrappers around the database so screens read like plain English.
// Every function throws an Error with a message that can be shown as-is.

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as T;
}

// ---- shared
export const getAreas = () => rows<Area[]>(supabase.from('areas').select('id, name').order('name'));
export const getSchools = () => rows<School[]>(supabase.from('schools').select('id, name, area_id, active').order('name'));
export const getClasses = () =>
  rows<ClassRow[]>(supabase.from('classes').select('*').eq('active', true).order('weekday').order('starts_at'));
export const getCurrentTerm = () =>
  rows<Term | null>(
    supabase.from('terms').select('*').gte('ends_on', today()).order('starts_on').limit(1).maybeSingle(),
  );
export type ChildWithParent = Child & { parent: { full_name: string; phone: string | null } | null };
/** Parent details only come back for managers; coaches see names. */
export const getChildrenOfClass = (classId: string) =>
  rows<ChildWithParent[]>(
    supabase.from('children').select('*, parent:profiles!children_parent_id_fkey(full_name, phone)').eq('class_id', classId).order('first_name'),
  );
export type ClassWithSchool = ClassRow & { school: { name: string; area_id: string } };
export const getClass = (id: string) =>
  rows<ClassWithSchool>(supabase.from('classes').select('*, school:schools(name, area_id)').eq('id', id).single());
export const coachFor = (classId: string, date: string) => rpc<string>('coach_for', { p_class: classId, p_date: date });
export const getLessonRecord = (classId: string, date: string) =>
  rows<{ status: string; reason: string | null } | null>(
    supabase.from('lessons').select('status, reason').eq('class_id', classId).eq('lesson_date', date).maybeSingle(),
  );
export const getProfileName = (id: string) =>
  rows<{ full_name: string } | null>(supabase.from('profiles').select('full_name').eq('id', id).maybeSingle());

export const cancelPreview = (date: string, scope: string, target: string | null) =>
  rpc<{ lessons: number; parents: number }>('cancel_preview', { p_date: date, p_scope: scope, p_target: target });
export const cancelLessons = (date: string, scope: string, target: string | null, reason: string, note: string) =>
  rpc<{ lessons: number; parents: number }>('cancel_lessons', {
    p_date: date, p_scope: scope, p_target: target, p_reason: reason, p_note: note,
  });

export const getMessages = (userId: string) =>
  rows<Note[]>(
    supabase.from('notifications').select('id, kind, title, body, data, read_at, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
  );
export const markMessagesRead = (userId: string) =>
  rows<null>(supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null));

// ---- manager
export const scheduleForDay = (date: string) => rpc<DayLesson[]>('schedule_for_day', { p_date: date });
export const coachSummary = (month: string) => rpc<CoachSummary[]>('coach_summary', { p_month: month });
export const coachMinutes = (coachId: string, from: string, to: string) =>
  rpc<number>('coach_minutes', { p_coach: coachId, p_from: from, p_to: to });
export const setStaffRole = (userId: string, role: 'coach' | 'manager' | 'parent', areaId: string | null) =>
  rpc<null>('set_staff_role', { p_user: userId, p_role: role, p_area: areaId });
export const getProfiles = () =>
  rows<Profile[]>(supabase.from('profiles').select('id, role, full_name, phone, area_id, popia_consent_at').order('full_name'));
export const getChildCounts = async () => {
  const list = await rows<{ class_id: string }[]>(supabase.from('children').select('class_id'));
  const counts: Record<string, number> = {};
  for (const c of list) counts[c.class_id] = (counts[c.class_id] ?? 0) + 1;
  return counts;
};
export const addArea = (name: string) => rows<null>(supabase.from('areas').insert({ name }));
export const addSchool = (name: string, areaId: string) => rows<null>(supabase.from('schools').insert({ name, area_id: areaId }));
export const moveSchool = (id: string, areaId: string) => rows<null>(supabase.from('schools').update({ area_id: areaId }).eq('id', id));
export const addClass = (c: Omit<ClassRow, 'id' | 'active'>) => rows<null>(supabase.from('classes').insert(c));
export const setClassCoach = (id: string, coachId: string) => rows<null>(supabase.from('classes').update({ coach_id: coachId }).eq('id', id));
export const saveTerm = async (term: Term | null, startsOn: string, endsOn: string) =>
  term
    ? rows<null>(supabase.from('terms').update({ starts_on: startsOn, ends_on: endsOn }).eq('id', term.id))
    : rows<null>(supabase.from('terms').insert({ name: 'Term', starts_on: startsOn, ends_on: endsOn }));

// ---- coach
export const myWeek = (monday: string) => rpc<WeekLesson[]>('my_week', { p_monday: monday });
export const myLessonsToConfirm = () => rpc<ToConfirm[]>('my_lessons_to_confirm');
export const confirmLesson = (classId: string, date: string, happened: boolean, reason?: string) =>
  rpc<null>('confirm_lesson', { p_class: classId, p_date: date, p_happened: happened, p_reason: reason ?? null });
export const requestSwap = (classId: string, toCoach: string, firstDate: string, weeks: number, note: string) =>
  rpc<string>('request_swap', { p_class: classId, p_to_coach: toCoach, p_first_date: firstDate, p_weeks: weeks, p_note: note });
export const respondSwap = (swapId: string, accept: boolean) => rpc<null>('respond_swap', { p_swap: swapId, p_accept: accept });
export const withdrawSwap = (swapId: string) => rpc<null>('withdraw_swap', { p_swap: swapId });

export type SwapWithNames = Swap & {
  class: { weekday: number; starts_at: string; school: { name: string } };
  from: { full_name: string };
  to: { full_name: string };
};
export const getMySwaps = (userId: string) =>
  rows<SwapWithNames[]>(
    supabase.from('swaps')
      .select('*, class:classes(weekday, starts_at, school:schools(name)), from:profiles!swaps_from_coach_fkey(full_name), to:profiles!swaps_to_coach_fkey(full_name)')
      .or(`from_coach.eq.${userId},to_coach.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(30),
  );

export type DoneLesson = {
  lesson_date: string;
  class: { starts_at: string; duration_min: number; age_group: string; school: { name: string } };
};
export const getDoneLessons = (coachId: string, from: string, to: string) =>
  rows<DoneLesson[]>(
    supabase.from('lessons')
      .select('lesson_date, class:classes(starts_at, duration_min, age_group, school:schools(name))')
      .eq('coach_id', coachId).eq('status', 'done').gte('lesson_date', from).lte('lesson_date', to)
      .order('lesson_date', { ascending: false }),
  );
export const getCoachesInArea = (areaId: string) =>
  rows<Profile[]>(supabase.from('profiles').select('id, role, full_name, phone, area_id, popia_consent_at').eq('role', 'coach').eq('area_id', areaId).order('full_name'));

// ---- parent
export type ChildWithClass = Child & {
  class: { weekday: number; starts_at: string; duration_min: number; age_group: string; school: { name: string } };
};
export const getMyChildren = (userId: string) =>
  rows<ChildWithClass[]>(
    supabase.from('children')
      .select('*, class:classes(weekday, starts_at, duration_min, age_group, school:schools(name))')
      .eq('parent_id', userId).order('created_at'),
  );
export const childTermDates = (childId: string) => rpc<TermDate[]>('child_term_dates', { p_child: childId });
export const signUpChild = (classId: string, first: string, last: string, medical: string, consent: boolean) =>
  rpc<string>('sign_up_child', {
    p_class: classId, p_first_name: first, p_last_name: last, p_medical_notes: medical, p_popia_consent: consent,
  });
export const updateMyProfile = (userId: string, fullName: string, phone: string) =>
  rows<null>(supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', userId));
