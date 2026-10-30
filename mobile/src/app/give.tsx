import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Body, Button, Chip, Choice, Done, ErrorText, Field, Group, H2, Loading, RowView, Screen, SheetHeader, Stack, Stepper, Steps,
} from '../components/ui';
import { getClasses, getCoachesInArea, getCurrentTerm, getSchools, requestSwap } from '../lib/api';
import { useAuth } from '../lib/auth';
import { addDays, addMinutes, DAYS, dayMonth, daysBetween, hhmm, isoWeekday, longDate, today } from '../lib/dates';
import { useColors } from '../lib/theme';
import type { ClassRow, Profile } from '../lib/types';
import { useLoad } from '../lib/useLoad';

type Step = 'lesson' | 'who' | 'when' | 'sent';

/** Coach: give a lesson to another coach in the same area for a number of weeks. */
export default function Give() {
  const c = useColors();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ classId?: string; date?: string }>();
  const fixed = !!params.classId;
  const [step, setStep] = useState<Step>(fixed ? 'who' : 'lesson');
  const [classId, setClassId] = useState<string | null>(params.classId ?? null);
  const [to, setTo] = useState<Profile | null>(null);
  const [start, setStart] = useState<string | null>(params.date ?? null);
  const [weeks, setWeeks] = useState(1);
  const [restOfTerm, setRestOfTerm] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useLoad(async () => {
    const [classes, schools, term] = await Promise.all([getClasses(), getSchools(), getCurrentTerm()]);
    return { classes, schools, term };
  }, []);
  const k = data?.classes.find((x) => x.id === classId) ?? null;
  const school = k ? data!.schools.find((s) => s.id === k.school_id) : null;
  const { data: peers } = useLoad(
    async () => (school ? (await getCoachesInArea(school.area_id)).filter((p) => p.id !== profile?.id) : []),
    [school?.area_id],
  );

  if (!data) return <Screen top={false}><SheetHeader /><Loading /></Screen>;

  // Next six dates this class runs, from today.
  const dates: string[] = [];
  if (k) {
    let d = today();
    while (isoWeekday(d) !== k.weekday) d = addDays(d, 1);
    for (let i = 0; i < 6; i++) dates.push(addDays(d, i * 7));
  }
  const first = start && dates.includes(start) ? start : dates[0];
  const termWeeks = data.term && first ? Math.max(1, Math.floor(daysBetween(first, data.term.ends_on) / 7) + 1) : 1;
  const n = restOfTerm ? termWeeks : weeks;

  const clash = (p: Profile): ClassRow | undefined => k
    ? data.classes.find((x) => x.id !== k.id && x.coach_id === p.id && x.weekday === k.weekday
      && hhmm(x.starts_at) < addMinutes(k.starts_at, k.duration_min) && addMinutes(x.starts_at, x.duration_min) > hhmm(k.starts_at))
    : undefined;

  async function send() {
    if (!k || !to || !first) return;
    setBusy(true);
    setError(null);
    try {
      await requestSwap(k.id, to.id, first, n, note);
      setStep('sent');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const mine = data.classes.filter((x) => x.coach_id === profile?.id);
  const schoolName = (x: ClassRow) => data.schools.find((s) => s.id === x.school_id)?.name ?? '';

  return (
    <Screen top={false}>
      <SheetHeader
        onBack={step === 'when' ? () => setStep('who') : step === 'who' && !fixed ? () => setStep('lesson') : undefined}
      />
      {step !== 'sent' ? <Steps count={3} at={{ lesson: 0, who: 1, when: 2, sent: 2 }[step]} /> : null}

      {step === 'lesson' ? (
        <Stack>
          <H2>Which lesson?</H2>
          {mine.map((x) => (
            <Choice key={x.id} title={`${DAYS[x.weekday - 1]}s at ${hhmm(x.starts_at)}`} subtitle={`${schoolName(x)} · ${x.age_group}`}
              onPress={() => { setClassId(x.id); setStep('who'); }} />
          ))}
          {!mine.length ? <Body muted>You don’t have any regular lessons to give away.</Body> : null}
        </Stack>
      ) : null}

      {step === 'who' && k ? (
        <Stack>
          <H2>Who should take it?</H2>
          <Body muted>{schoolName(k)} · {DAYS[k.weekday - 1]}s at {hhmm(k.starts_at)}</Body>
          {!peers ? <Loading /> : null}
          {peers?.map((p) => {
            const x = clash(p);
            return (
              <Choice key={p.id} title={p.full_name}
                subtitle={x ? `Has ${schoolName(x)} at ${hhmm(x.starts_at)} that day` : 'Free at this time'} warn={!!x}
                onPress={() => { setTo(p); setStep('when'); }} />
            );
          })}
          {peers && !peers.length ? <Body muted>There are no other coaches in your area.</Body> : null}
          <Body small muted>Only coaches in your area are shown.</Body>
        </Stack>
      ) : null}

      {step === 'when' && k && to && first ? (
        <Stack gap={20}>
          <H2>For how long?</H2>
          <Group label="Starting">
            <RowView>{dates.map((d) => <Chip key={d} label={dayMonth(d)} selected={d === first} onPress={() => setStart(d)} />)}</RowView>
          </Group>
          <Group label="How many weeks">
            <RowView style={{ gap: 16 }}>
              <Stepper value={n} onChange={setWeeks} max={20} disabled={restOfTerm} format={(v) => `${v} week${v > 1 ? 's' : ''}`} />
              {data.term ? <Chip label="Rest of term" selected={restOfTerm} onPress={() => setRestOfTerm(!restOfTerm)} /> : null}
            </RowView>
          </Group>
          <View style={{ backgroundColor: c.soft, borderRadius: 14, padding: 14 }}>
            <Body>
              <Body bold>{to.full_name.split(' ')[0]}</Body> will coach {schoolName(k)}{' '}
              {n === 1 ? `on ${longDate(first)}` : `on ${n} ${DAYS[k.weekday - 1]}s, ${dayMonth(first)} to ${dayMonth(addDays(first, (n - 1) * 7))}`}.
            </Body>
          </View>
          <Field label={`Message to ${to.full_name.split(' ')[0]} (optional)`} value={note} onChangeText={setNote} placeholder="e.g. I’m away at a wedding" />
          <ErrorText text={error} />
          <Button title="Send request" onPress={send} loading={busy} />
        </Stack>
      ) : null}

      {step === 'sent' && to ? (
        <Done title="Request sent" text={`${to.full_name.split(' ')[0]} will get a notification to accept it. You’ll see the answer in Swaps.`} />
      ) : null}
    </Screen>
  );
}
