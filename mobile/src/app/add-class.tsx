import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import {
  Body, Button, Chip, ErrorText, Field, Group, H2, Loading, RowView, Screen, SheetHeader,
} from '../components/ui';
import { addClass, getCoachesInArea, getSchools } from '../lib/api';
import { DAYS } from '../lib/dates';
import { useLoad } from '../lib/useLoad';
import { AGE_ORDER } from '../lib/types';

/** Manager: add a weekly class to a school. */
export default function AddClass() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState('08:30');
  const [minutes, setMinutes] = useState(60);
  const [age, setAge] = useState(AGE_ORDER[1]);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useLoad(async () => {
    const school = (await getSchools()).find((s) => s.id === schoolId)!;
    return { school, coaches: await getCoachesInArea(school.area_id) };
  }, [schoolId]);

  async function save() {
    setError(null);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim())) {
      setError('Type the start time like 08:30.');
      return;
    }
    if (!coachId) {
      setError('Choose a coach.');
      return;
    }
    setBusy(true);
    try {
      await addClass({ school_id: schoolId, weekday, starts_at: time.trim(), duration_min: minutes, age_group: age, coach_id: coachId });
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!data) return <Screen top={false}><SheetHeader /><Loading /></Screen>;
  return (
    <Screen top={false}>
      <SheetHeader />
      <H2>Add a class</H2>
      <Body muted>{data.school.name}</Body>
      <Group label="Day">
        <RowView>{DAYS.slice(0, 5).map((d, i) => <Chip key={d} label={d.slice(0, 3)} selected={weekday === i + 1} onPress={() => setWeekday(i + 1)} />)}</RowView>
      </Group>
      <Field label="Start time" value={time} onChangeText={setTime} placeholder="08:30" keyboardType="numbers-and-punctuation" />
      <Group label="Length">
        <RowView>{[30, 45, 60].map((m) => <Chip key={m} label={`${m} min`} selected={minutes === m} onPress={() => setMinutes(m)} />)}</RowView>
      </Group>
      <Group label="Age group">
        <RowView>{AGE_ORDER.map((a) => <Chip key={a} label={a} selected={age === a} onPress={() => setAge(a)} />)}</RowView>
      </Group>
      <Group label="Coach">
        {data.coaches.length ? (
          <RowView>{data.coaches.map((co) => <Chip key={co.id} label={co.full_name} selected={coachId === co.id} onPress={() => setCoachId(co.id)} />)}</RowView>
        ) : <Body muted>There are no coaches in this area yet. Add one under Coaches first.</Body>}
      </Group>
      <ErrorText text={error} />
      <Button title="Add class" onPress={save} loading={busy} />
    </Screen>
  );
}
