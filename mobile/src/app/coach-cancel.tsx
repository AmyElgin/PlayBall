import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Body, Choice, Done, ErrorText, H2, Screen, SheetHeader, Stack } from '../components/ui';
import { cancelLessons } from '../lib/api';
import { dayWord } from '../lib/dates';
import { REASONS } from '../lib/types';

/** Coach: cancel a lesson they are taking. Parents and the manager are told straight away. */
export default function CoachCancel() {
  const { classId, date } = useLocalSearchParams<{ classId: string; date: string }>();
  const [parents, setParents] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel(reason: string) {
    setBusy(true);
    setError(null);
    try {
      setParents((await cancelLessons(date, 'lesson', classId, reason, '')).parents);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (parents !== null) {
    return <Screen top={false}><Done title="Lesson cancelled" text={`${parents} parents and your manager have been told.`} /></Screen>;
  }
  return (
    <Screen top={false}>
      <SheetHeader />
      <H2>Why are you cancelling?</H2>
      <Body muted>{dayWord(date)}</Body>
      <Stack>{REASONS.map((r) => <Choice key={r.label} title={r.label} disabled={busy} onPress={() => cancel(r.label)} />)}</Stack>
      <ErrorText text={error} />
      <Body small muted>Parents get a message as soon as you choose a reason.</Body>
    </Screen>
  );
}
