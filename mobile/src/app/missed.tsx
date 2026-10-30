import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Body, Choice, ErrorText, H2, Screen, SheetHeader, Stack } from '../components/ui';
import { confirmLesson } from '../lib/api';
import { shortDate } from '../lib/dates';

const REASONS = ['Rain', 'The school cancelled', 'Children were on an outing', 'I was sick', 'Something else'];

/** Coach: the lesson didn't happen. Asks why, then tells the manager. */
export default function Missed() {
  const { classId, date } = useLocalSearchParams<{ classId: string; date: string }>();
  const [error, setError] = useState<string | null>(null);

  async function save(reason: string) {
    setError(null);
    try {
      await confirmLesson(classId, date, false, reason);
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen top={false}>
      <SheetHeader />
      <H2>What happened?</H2>
      <Body muted>Lesson on {shortDate(date)}</Body>
      <Stack>{REASONS.map((r) => <Choice key={r} title={r} onPress={() => save(r)} />)}</Stack>
      <ErrorText text={error} />
      <Body small muted>This lesson won’t count towards your hours. Your manager will see why.</Body>
    </Screen>
  );
}
