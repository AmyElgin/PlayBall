import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  Body, Button, Choice, Done, ErrorText, Field, H2, Loading, Screen, SheetHeader, Stack, Steps,
} from '../components/ui';
import { cancelLessons, cancelPreview, scheduleForDay } from '../lib/api';
import { addDays, dayWord, hhmm, longDate, nextSchoolDay, today } from '../lib/dates';
import { useColors } from '../lib/theme';
import { REASONS, type DayLesson } from '../lib/types';

type Scope = 'area' | 'school' | 'lesson' | 'all';
type Step = 'what' | 'day' | 'which' | 'why' | 'check' | 'sent';

const canCancel = (l: DayLesson) => l.state !== 'cancelled' && l.state !== 'done';
function matches(l: DayLesson, scope: Scope, target: string | null) {
  if (scope === 'all') return true;
  if (scope === 'area') return l.area_id === target;
  if (scope === 'school') return l.school_id === target;
  return l.class_id === target;
}

/** Manager: cancel one lesson, a school, an area or a whole day, step by step. */
export default function Cancel() {
  const params = useLocalSearchParams<{ scope?: Scope; target?: string; date?: string }>();
  const fixed = !!params.target;
  const [step, setStep] = useState<Step>(fixed ? 'why' : 'what');
  const [history, setHistory] = useState<Step[]>([]);
  const [scope, setScope] = useState<Scope>(params.scope ?? 'area');
  const [date, setDate] = useState(params.date ?? '');
  const [target, setTarget] = useState<string | null>(params.target ?? null);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<{ lessons: number; parents: number } | null>(null);

  const go = (next: Step) => { setHistory((h) => [...h, step]); setStep(next); };
  const back = history.length ? () => { setStep(history[history.length - 1]); setHistory((h) => h.slice(0, -1)); } : undefined;
  const at = { what: 0, day: 1, which: 2, why: 3, check: 3, sent: 3 }[step];

  return (
    <Screen top={false}>
      <SheetHeader onBack={step === 'sent' ? undefined : back} />
      {!fixed && step !== 'sent' && step !== 'check' ? <Steps count={4} at={at} /> : null}

      {step === 'what' ? (
        <Stack>
          <H2>What do you want to cancel?</H2>
          <Choice title="Everything in an area" subtitle="For example, rain in Hillcrest" onPress={() => { setScope('area'); go('day'); }} />
          <Choice title="One school" onPress={() => { setScope('school'); go('day'); }} />
          <Choice title="One lesson" onPress={() => { setScope('lesson'); go('day'); }} />
          <Choice title="Every lesson" subtitle="All areas on one day" onPress={() => { setScope('all'); setTarget(null); go('day'); }} />
        </Stack>
      ) : null}

      {step === 'day' ? <PickDay onPick={(d) => { setDate(d); go(scope === 'all' ? 'why' : 'which'); }} /> : null}
      {step === 'which' ? <PickTarget scope={scope} date={date} onPick={(t) => { setTarget(t); go('why'); }} /> : null}

      {step === 'why' ? (
        <Stack>
          <H2>Why is it cancelled?</H2>
          {REASONS.map((r) => <Choice key={r.label} title={r.label} onPress={() => { setReason(r.label); go('check'); }} />)}
        </Stack>
      ) : null}

      {step === 'check' ? (
        <Check scope={scope} date={date} target={target} reason={reason} onSent={(r) => { setResult(r); setHistory([]); setStep('sent'); }} />
      ) : null}

      {step === 'sent' && result ? (
        <Done
          title="Parents have been told"
          text={`${result.lessons} lesson${result.lessons === 1 ? '' : 's'} cancelled. ${result.parents} parents and the coaches got a message.`}
        />
      ) : null}
    </Screen>
  );
}

function PickDay({ onPick }: { onPick: (d: string) => void }) {
  const days = [nextSchoolDay(today())];
  while (days.length < 5) days.push(nextSchoolDay(addDays(days[days.length - 1], 1)));
  return (
    <Stack>
      <H2>Which day?</H2>
      {days.map((d) => <Choice key={d} title={dayWord(d)} onPress={() => onPick(d)} />)}
    </Stack>
  );
}

function PickTarget({ scope, date, onPick }: { scope: Scope; date: string; onPick: (t: string) => void }) {
  const [lessons, setLessons] = useState<DayLesson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { scheduleForDay(date).then(setLessons, (e: Error) => setError(e.message)); }, [date]);

  // Group the day's lessons into areas, schools or single lessons, counting what can still be cancelled.
  const options = new Map<string, { title: string; n: number }>();
  for (const l of lessons ?? []) {
    const id = scope === 'area' ? l.area_id : scope === 'school' ? l.school_id : l.class_id;
    const title = scope === 'area' ? l.area_name : scope === 'school' ? l.school_name : `${hhmm(l.starts_at)} · ${l.school_name}`;
    const cur = options.get(id) ?? { title, n: 0 };
    cur.n += canCancel(l) ? 1 : 0;
    options.set(id, cur);
  }

  return (
    <Stack>
      <H2>{scope === 'area' ? 'Which area?' : scope === 'school' ? 'Which school?' : 'Which lesson?'}</H2>
      <Body muted>{dayWord(date)}</Body>
      <ErrorText text={error} />
      {!lessons && !error ? <Loading /> : null}
      {lessons && !lessons.length ? <Body muted>There are no lessons on this day.</Body> : null}
      {[...options.entries()].map(([id, o]) => (
        <Choice
          key={id}
          title={o.title}
          subtitle={!o.n ? 'Nothing left to cancel' : scope === 'lesson' ? undefined : `${o.n} lesson${o.n > 1 ? 's' : ''}`}
          disabled={!o.n}
          onPress={() => onPick(id)}
        />
      ))}
    </Stack>
  );
}

function Check({ scope, date, target, reason, onSent }: {
  scope: Scope; date: string; target: string | null; reason: string; onSent: (r: { lessons: number; parents: number }) => void;
}) {
  const c = useColors();
  const [preview, setPreview] = useState<{ lessons: number; parents: number } | null>(null);
  const [sample, setSample] = useState<DayLesson | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([scheduleForDay(date), cancelPreview(date, scope, target)]).then(
      ([day, p]) => {
        setSample(day.find((l) => matches(l, scope, target) && canCancel(l)) ?? null);
        setPreview(p);
      },
      (e: Error) => setError(e.message),
    );
  }, [date, scope, target]);

  const phrase = REASONS.find((r) => r.label === reason)?.phrase ?? '';
  const when = date === today() ? 'today' : `on ${longDate(date)}`;
  const message = sample
    ? `[Child]'s Playball at ${sample.school_name} ${when} (${hhmm(sample.starts_at)}) is cancelled${phrase}.${note.trim() ? ` ${note.trim()}` : ''}`
    : '';

  async function send() {
    setBusy(true);
    setError(null);
    try {
      onSent(await cancelLessons(date, scope, target, reason, note));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!preview && !error) return <Loading />;
  return (
    <Stack gap={16}>
      <H2>Check and send</H2>
      {preview ? (
        <Body>
          <Body bold>{preview.lessons} lesson{preview.lessons === 1 ? '' : 's'}</Body> {when}.{' '}
          <Body bold>{preview.parents} parents</Body> will get this message:
        </Body>
      ) : null}
      {message ? (
        <View style={{ backgroundColor: c.soft, borderRadius: 14, padding: 14 }}>
          <Body>{message}</Body>
        </View>
      ) : null}
      <Field label="Add a note (optional)" value={note} onChangeText={setNote} multiline placeholder="e.g. We will make it up at the end of term." />
      <ErrorText text={error} />
      <Button
        title={preview?.lessons ? `Send to ${preview.parents} parents` : 'Nothing left to cancel'}
        variant="danger"
        disabled={!preview?.lessons}
        loading={busy}
        onPress={send}
      />
    </Stack>
  );
}
