import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ChildList } from '../components/ChildList';
import {
  Banner, Body, Button, ErrorText, H2, KeyValue, List, Loading, Screen, SheetHeader, Stack, StateText,
} from '../components/ui';
import { coachFor, confirmLesson, getChildrenOfClass, getClass, getLessonRecord, getProfileName } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dayWord, hoursText, parse, timeRange, today } from '../lib/dates';
import type { LessonState } from '../lib/types';
import { useLoad } from '../lib/useLoad';

function stateOf(date: string, start: string, mins: number, status: string | undefined): LessonState {
  if (status) return status as LessonState;
  const [h, m] = start.split(':').map(Number);
  const begins = parse(date);
  begins.setHours(h, m, 0, 0);
  const ends = new Date(begins.getTime() + mins * 60000);
  const now = new Date();
  return ends < now ? 'unconfirmed' : begins <= now ? 'live' : 'upcoming';
}

/** One lesson on one date. Managers can cancel it; coaches can confirm, give away or cancel. */
export default function Lesson() {
  const { classId, date } = useLocalSearchParams<{ classId: string; date: string }>();
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, reload } = useLoad(async () => {
    const [k, record, coachId, children] = await Promise.all([
      getClass(classId), getLessonRecord(classId, date), coachFor(classId, date), getChildrenOfClass(classId),
    ]);
    const coach = await getProfileName(coachId);
    return { k, record, coachId, coachName: coach?.full_name ?? '', children };
  }, [classId, date]);

  if (!data) {
    return <Screen top={false}><SheetHeader />{error ? <ErrorText text={error} /> : <Loading />}</Screen>;
  }

  const { k, record, coachId, coachName, children } = data;
  const state = stateOf(date, k.starts_at, k.duration_min, record?.status);
  const isManager = profile?.role === 'manager';
  const mine = coachId === profile?.id;
  const covering = coachId !== k.coach_id;

  async function answer(happened: boolean) {
    if (!happened) {
      router.replace({ pathname: '/missed', params: { classId, date } });
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await confirmLesson(classId, date, true);
      await reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <Screen top={false}>
      <SheetHeader />
      <H2>{k.school.name}</H2>
      <List>
        <View style={{ paddingHorizontal: 16 }}>
          <KeyValue k="When" v={`${dayWord(date)}, ${timeRange(k.starts_at, k.duration_min)}`} />
          <KeyValue k="Age group" v={k.age_group} />
          <KeyValue k="Coach" v={`${coachName}${covering ? ' (covering)' : ''}`} />
          <KeyValue k="Status" v={state === 'upcoming' ? 'Scheduled' : <StateText state={state} />} last />
        </View>
      </List>
      {record?.reason ? <Body muted>Reason: {record.reason}</Body> : null}

      {mine && state === 'unconfirmed' ? (
        <Banner tone="ask">
          <Body bold>Did this lesson happen?</Body>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="Yes" variant="success" loading={busy} onPress={() => answer(true)} /></View>
            <View style={{ flex: 1 }}><Button title="No" variant="secondary" onPress={() => answer(false)} /></View>
          </View>
        </Banner>
      ) : null}
      {mine && state === 'done' ? <Body muted>Confirmed. {hoursText(k.duration_min)} added to your hours.</Body> : null}
      <ErrorText text={actionError} />

      <Stack gap={8}>
        {!isManager && mine && !covering && state === 'upcoming' ? (
          <Button title="Give this lesson away" onPress={() => router.replace({ pathname: '/give', params: { classId, date } })} />
        ) : null}
        {!isManager && mine && (state === 'upcoming' || state === 'live') ? (
          <Button title="Cancel this lesson" variant="secondary" onPress={() => router.replace({ pathname: '/coach-cancel', params: { classId, date } })} />
        ) : null}
        {isManager && date >= today() && ['upcoming', 'live', 'unconfirmed'].includes(state) ? (
          <Button
            title="Cancel this lesson"
            variant="danger"
            onPress={() => router.replace({ pathname: '/cancel', params: { scope: 'lesson', target: classId, date } })}
          />
        ) : null}
      </Stack>

      <ChildList kids={children} />
    </Screen>
  );
}
