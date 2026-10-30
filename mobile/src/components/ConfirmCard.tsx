import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { confirmLesson } from '../lib/api';
import { hhmm, shortDate } from '../lib/dates';
import type { ToConfirm } from '../lib/types';
import { Banner, Body, Button, ErrorText } from './ui';

/** "Did this lesson happen?" with Yes / No. */
export function ConfirmCard({ lesson, onDone }: { lesson: ToConfirm; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function yes() {
    setBusy(true);
    setError(null);
    try {
      await confirmLesson(lesson.class_id, lesson.lesson_date, true);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Banner tone="ask">
      <View style={{ gap: 2 }}>
        <Body bold>Did this lesson happen?</Body>
        <Body small>{lesson.school_name} · {shortDate(lesson.lesson_date)} at {hhmm(lesson.starts_at)}</Body>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Button title="Yes" variant="success" loading={busy} onPress={yes} /></View>
        <View style={{ flex: 1 }}>
          <Button
            title="No"
            variant="secondary"
            onPress={() => router.push({ pathname: '/missed', params: { classId: lesson.class_id, date: lesson.lesson_date } })}
          />
        </View>
      </View>
      <ErrorText text={error} />
    </Banner>
  );
}
