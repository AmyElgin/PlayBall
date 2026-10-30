import { useState } from 'react';

import {
  Body, Button, Choice, Done, ErrorText, Field, H2, Loading, Screen, SheetHeader, Stack, Steps, Toggle,
} from '../components/ui';
import { getAreas, getClasses, getSchools, signUpChild } from '../lib/api';
import { useAuth } from '../lib/auth';
import { DAYS, timeRange } from '../lib/dates';
import { AGE_ORDER } from '../lib/types';
import { useLoad } from '../lib/useLoad';

type Step = 'school' | 'age' | 'time' | 'child' | 'sent';

/** Parent: school → age group → lesson time → child's name. */
export default function AddChild() {
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>('school');
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [age, setAge] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState(profile?.full_name.split(' ').slice(1).join(' ') ?? '');
  const [medical, setMedical] = useState('');
  const [consent, setConsent] = useState(!!profile?.popia_consent_at);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, error: loadError } = useLoad(async () => {
    const [areas, schools, classes] = await Promise.all([getAreas(), getSchools(), getClasses()]);
    return { areas, schools, classes };
  }, []);

  if (!data) return <Screen top={false}><SheetHeader />{loadError ? <ErrorText text={loadError} /> : <Loading />}</Screen>;

  const school = data.schools.find((s) => s.id === schoolId);
  const atSchool = data.classes.filter((k) => k.school_id === schoolId);
  const ages = [...new Set(atSchool.map((k) => k.age_group))].sort((a, b) => AGE_ORDER.indexOf(a) - AGE_ORDER.indexOf(b));
  const times = atSchool.filter((k) => k.age_group === age);
  const k = data.classes.find((x) => x.id === classId);
  const back = { school: undefined, age: () => setStep('school'), time: () => setStep('age'), child: () => setStep('time'), sent: undefined }[step];

  async function save() {
    setError(null);
    if (!first.trim() || !last.trim()) {
      setError('Please add your child’s first name and surname.');
      return;
    }
    if (!consent) {
      setError('Please agree to how Playball uses your information.');
      return;
    }
    setBusy(true);
    try {
      await signUpChild(classId!, first.trim(), last.trim(), medical.trim(), consent);
      await refreshProfile();
      setStep('sent');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Screen top={false}>
      <SheetHeader onBack={back} />
      {step !== 'sent' ? <Steps count={4} at={{ school: 0, age: 1, time: 2, child: 3, sent: 3 }[step]} /> : null}

      {step === 'school' ? (
        <Stack>
          <H2>Which school?</H2>
          {data.areas.flatMap((a) =>
            data.schools
              .filter((s) => s.area_id === a.id && data.classes.some((x) => x.school_id === s.id))
              .map((s) => <Choice key={s.id} title={s.name} subtitle={a.name} onPress={() => { setSchoolId(s.id); setStep('age'); }} />),
          )}
          {!data.classes.length ? <Body muted>There are no classes open for sign-up yet.</Body> : null}
        </Stack>
      ) : null}

      {step === 'age' ? (
        <Stack>
          <H2>How old is your child?</H2>
          <Body muted>{school?.name}</Body>
          {ages.map((a) => <Choice key={a} title={a} onPress={() => { setAge(a); setStep('time'); }} />)}
        </Stack>
      ) : null}

      {step === 'time' ? (
        <Stack>
          <H2>Pick a lesson time</H2>
          <Body muted>{school?.name} · {age}</Body>
          {times.map((x) => (
            <Choice key={x.id} title={`${DAYS[x.weekday - 1]}s`} subtitle={timeRange(x.starts_at, x.duration_min)} onPress={() => { setClassId(x.id); setStep('child'); }} />
          ))}
        </Stack>
      ) : null}

      {step === 'child' && k ? (
        <Stack gap={14}>
          <H2>About your child</H2>
          <Body muted>{school?.name} · {DAYS[k.weekday - 1]}s at {k.starts_at.slice(0, 5)}</Body>
          <Field label="Child’s first name" value={first} onChangeText={setFirst} autoCapitalize="words" />
          <Field label="Surname" value={last} onChangeText={setLast} autoCapitalize="words" />
          <Field label="Allergies or medical notes (optional)" value={medical} onChangeText={setMedical} multiline />
          {!profile?.popia_consent_at ? (
            <Toggle
              label="I agree that Playball may keep my child’s name, class and medical notes, and my contact details, to run lessons and tell me about changes."
              value={consent}
              onChange={setConsent}
            />
          ) : null}
          <ErrorText text={error} />
          <Button title="Sign up" onPress={save} loading={busy} />
        </Stack>
      ) : null}

      {step === 'sent' && k ? (
        <Done title={`${first.trim()} is signed up`} text={`See you on ${DAYS[k.weekday - 1]}! You’ll get a notification if a lesson is ever cancelled.`} />
      ) : null}
    </Screen>
  );
}
