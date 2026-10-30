// Dates are passed around as 'YYYY-MM-DD' strings, like the database uses.
// Names are written out by hand so they look the same on every phone.

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');

export function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const today = () => iso(new Date());
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
/** 1 = Monday … 7 = Sunday, as in Postgres isodow. */
export const isoWeekday = (s: string) => ((parse(s).getDay() + 6) % 7) + 1;
export const mondayOf = (s: string) => addDays(s, 1 - isoWeekday(s));
export const nextSchoolDay = (s: string) => {
  let d = s;
  while (isoWeekday(d) > 5) d = addDays(d, 1);
  return d;
};
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);

/** "Mon, 2 Nov" */
export function shortDate(s: string): string {
  const d = parse(s);
  return `${DAYS[isoWeekday(s) - 1].slice(0, 3)}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}
/** "2 Nov" */
export function dayMonth(s: string): string {
  const d = parse(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}
/** "Monday 2 November" */
export function longDate(s: string): string {
  const d = parse(s);
  return `${DAYS[isoWeekday(s) - 1]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export const monthName = (s: string) => MONTHS[parse(s).getMonth()];
export const dayWord = (s: string) => (s === today() ? 'Today' : s === addDays(today(), 1) ? 'Tomorrow' : longDate(s));

/** '08:30:00' → '08:30' */
export const hhmm = (t: string) => t.slice(0, 5);
export function addMinutes(t: string, mins: number): string {
  const [h, m] = t.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
export const timeRange = (start: string, mins: number) => `${hhmm(start)} – ${addMinutes(start, mins)}`;

/** 45 → "45 min", 135 → "2h 15m" */
export function hoursText(mins: number): string {
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`;
}

export const monthStart = (s: string) => s.slice(0, 8) + '01';
export function monthEnd(s: string): string {
  const d = parse(monthStart(s));
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
export function previousMonth(s: string): string {
  const d = parse(monthStart(s));
  return iso(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

export function timeAgo(ts: string): string {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}
