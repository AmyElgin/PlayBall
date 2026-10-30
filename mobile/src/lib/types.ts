// Shapes returned by the database (see supabase/migrations).

export type Role = 'manager' | 'coach' | 'parent';
export type LessonState = 'done' | 'missed' | 'cancelled' | 'unconfirmed' | 'live' | 'upcoming';

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  area_id: string | null;
  popia_consent_at: string | null;
};

export type Area = { id: string; name: string };
export type School = { id: string; name: string; area_id: string; active: boolean };
export type Term = { id: string; name: string; starts_on: string; ends_on: string };

export type ClassRow = {
  id: string;
  school_id: string;
  weekday: number;
  starts_at: string;
  duration_min: number;
  age_group: string;
  coach_id: string;
  active: boolean;
};

export type Child = {
  id: string;
  parent_id: string;
  class_id: string;
  first_name: string;
  last_name: string;
  medical_notes: string | null;
};

export type DayLesson = {
  class_id: string;
  school_id: string;
  school_name: string;
  area_id: string;
  area_name: string;
  starts_at: string;
  duration_min: number;
  age_group: string;
  coach_id: string;
  coach_name: string;
  covering: boolean;
  child_count: number;
  state: LessonState;
  reason: string | null;
};

export type WeekLesson = {
  lesson_date: string;
  class_id: string;
  school_name: string;
  area_name: string;
  starts_at: string;
  duration_min: number;
  age_group: string;
  child_count: number;
  state: LessonState;
  reason: string | null;
  is_mine: boolean;
  covering_for: string | null;
  given_to: string | null;
};

export type ToConfirm = {
  lesson_date: string;
  class_id: string;
  school_name: string;
  starts_at: string;
  duration_min: number;
};

export type TermDate = {
  lesson_date: string;
  starts_at: string;
  duration_min: number;
  state: LessonState;
  reason: string | null;
  coach_name: string | null;
};

export type CoachSummary = {
  coach_id: string;
  full_name: string;
  area_name: string | null;
  minutes: number;
  to_confirm: number;
};

export type Swap = {
  id: string;
  class_id: string;
  from_coach: string;
  to_coach: string;
  first_date: string;
  weeks: number;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
  note: string | null;
  created_at: string;
};

export type Note = {
  id: number;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export const REASONS: { label: string; phrase: string }[] = [
  { label: 'Rain', phrase: ' because of rain' },
  { label: 'Too hot', phrase: ' because of the heat' },
  { label: 'Coach is sick', phrase: ' because the coach is unwell' },
  { label: 'School event', phrase: ' because of a school event' },
  { label: 'Other', phrase: '' },
];

export const AGE_ORDER = ['2–3 years', '3–4 years', '4–5 years', 'Grade R', 'Grade 1–2'];
