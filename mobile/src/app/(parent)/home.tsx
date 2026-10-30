import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { AccountButton } from '../../components/AccountButton';
import { useChild } from '../../components/ChildPicker';
import {
  Banner, Body, Button, ErrorText, Flag, Greeting, Label, Loading, Screen, Stack, TextButton,
} from '../../components/ui';
import { childTermDates, getMessages } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { DAYS, dayWord, longDate, timeRange, today } from '../../lib/dates';
import { font, useColors } from '../../lib/theme';
import { useLoad } from '../../lib/useLoad';

export default function Home() {
  const c = useColors();
  const { profile } = useAuth();
  const { kids, child, picker, error: kidsError, refresh: refreshKids } = useChild();

  const { data, error, refreshing, refresh } = useLoad(async () => {
    const [dates, messages] = await Promise.all([
      child ? childTermDates(child.id) : Promise.resolve([]),
      getMessages(profile!.id),
    ]);
    return { dates, unread: messages.find((m) => !m.read_at && m.kind === 'cancelled') ?? null };
  }, [child?.id, profile?.id]);

  // The next lesson that hasn't finished yet, cancelled or not.
  const next = data?.dates.find((d) => d.lesson_date >= today() && ['upcoming', 'live', 'cancelled'].includes(d.state)) ?? null;
  const after = next?.state === 'cancelled'
    ? data?.dates.find((d) => d.lesson_date > next.lesson_date && d.state !== 'cancelled') ?? null
    : null;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { refresh(); refreshKids(); }}>
      <Greeting title={`Hi ${profile?.full_name.split(' ')[0] ?? ''}`} right={<AccountButton />} />
      <ErrorText text={error ?? kidsError} />
      {data?.unread ? (
        <Banner tone="danger" onPress={() => router.navigate('/messages')}>
          <Body bold>{data.unread.title}</Body>
          <Body small>{data.unread.body}</Body>
        </Banner>
      ) : null}

      {kids && !kids.length ? (
        <Stack>
          <Body>Sign your child up for Playball at their school. It takes under a minute.</Body>
          <Button title="Sign up my child" onPress={() => router.push('/add-child')} />
        </Stack>
      ) : null}
      {!kids ? <Loading /> : null}
      {picker}

      {child ? (
        <View style={{ backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: next?.state === 'cancelled' ? c.red : c.line, padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ color: c.ink, fontFamily: font.bold, fontSize: 17 }}>{child.first_name}</Text>
            <Text style={{ color: c.muted, fontFamily: font.regular, fontSize: 14, flexShrink: 1, textAlign: 'right' }}>{child.class.school.name}</Text>
          </View>
          {!data ? <Loading /> : next ? (
            <>
              <View style={{ gap: 4 }}>
                <Label>Next Playball</Label>
                <Text style={{ color: c.ink, fontFamily: font.extrabold, fontSize: 23, lineHeight: 29 }}>
                  {dayWord(next.lesson_date)}{'\n'}{timeRange(next.starts_at, next.duration_min)}
                </Text>
              </View>
              {next.state === 'cancelled' ? (
                <Stack gap={6}>
                  <Flag tone="bad" text={`Cancelled${next.reason ? ` · ${next.reason}` : ''}`} />
                  {after ? <Body small muted>The lesson after that is {longDate(after.lesson_date)}.</Body> : null}
                </Stack>
              ) : <Flag tone="ok" text={next.state === 'live' ? 'On now' : 'On as normal'} />}
            </>
          ) : <Body muted>No more lessons this term.</Body>}
          <Body small muted>
            Every {DAYS[child.class.weekday - 1]} · {child.class.age_group}{next?.coach_name ? ` · Coach ${next.coach_name}` : ''}
          </Body>
        </View>
      ) : null}

      {child ? <TextButton title={`See all of ${child.first_name}’s term dates ›`} onPress={() => router.navigate('/dates')} /> : null}
      {kids?.length ? <Button title="Add another child" variant="secondary" onPress={() => router.push('/add-child')} /> : null}
    </Screen>
  );
}
