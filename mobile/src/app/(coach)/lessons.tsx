import { router } from 'expo-router';
import { useState } from 'react';

import { AccountButton } from '../../components/AccountButton';
import { ConfirmCard } from '../../components/ConfirmCard';
import {
  Banner, Body, Empty, ErrorText, Greeting, Group, List, Loading, Row, Screen, Segmented, StateText,
} from '../../components/ui';
import { getMySwaps, myLessonsToConfirm, myWeek } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { addDays, DAYS, dayMonth, hhmm, isoWeekday, longDate, mondayOf, nextSchoolDay, today } from '../../lib/dates';
import type { WeekLesson } from '../../lib/types';
import { useLoad } from '../../lib/useLoad';

export default function Lessons() {
  const { profile } = useAuth();
  const [week, setWeek] = useState<'this' | 'next'>('this');
  const monday = addDays(mondayOf(nextSchoolDay(today())), week === 'next' ? 7 : 0);

  const { data, error, refreshing, refresh, reload } = useLoad(async () => {
    const [lessons, toConfirm, swaps] = await Promise.all([myWeek(monday), myLessonsToConfirm(), getMySwaps(profile!.id)]);
    return { lessons, toConfirm, requests: swaps.filter((s) => s.to_coach === profile!.id && s.status === 'pending') };
  }, [monday, profile?.id]);

  const days: { date: string; lessons: WeekLesson[] }[] = [];
  for (const l of data?.lessons ?? []) {
    if (week === 'this' && l.lesson_date < today()) continue;
    const g = days.find((d) => d.date === l.lesson_date);
    if (g) g.lessons.push(l);
    else days.push({ date: l.lesson_date, lessons: [l] });
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Greeting subtitle={longDate(today())} title={`Hi ${profile?.full_name.split(' ')[0] ?? ''}`} right={<AccountButton />} />
      <ErrorText text={error} />
      {data?.toConfirm.map((l) => <ConfirmCard key={l.class_id + l.lesson_date} lesson={l} onDone={reload} />)}
      {data?.requests.length ? (
        <Banner tone="info" onPress={() => router.navigate('/swaps')}>
          <Body bold>{data.requests[0].from.full_name.split(' ')[0]} asked you to take a lesson</Body>
          <Body small>Tap to see the request</Body>
        </Banner>
      ) : null}

      <Segmented options={[{ value: 'this', label: 'This week' }, { value: 'next', label: 'Next week' }]} value={week} onChange={setWeek} />
      {!data && !error ? <Loading /> : null}
      {data && !days.length ? <Empty text={week === 'this' ? 'No more lessons this week.' : 'No lessons next week.'} /> : null}
      {days.map((d) => (
        <Group key={d.date} label={d.date === today() ? 'Today' : `${DAYS[isoWeekday(d.date) - 1]} ${dayMonth(d.date)}`}>
          <List>
            {d.lessons.map((l, i) => (
              <Row
                key={l.class_id}
                last={i === d.lessons.length - 1}
                time={hhmm(l.starts_at)}
                title={l.school_name}
                subtitle={
                  !l.is_mine ? `Given to ${l.given_to?.split(' ')[0]}`
                    : l.covering_for ? `Covering for ${l.covering_for.split(' ')[0]}`
                      : `${l.age_group} · ${l.child_count} children`
                }
                dimmed={!l.is_mine || l.state === 'cancelled'}
                right={l.state === 'cancelled' || l.state === 'live' ? <StateText state={l.state} /> : undefined}
                onPress={() => router.push({ pathname: '/lesson', params: { classId: l.class_id, date: l.lesson_date } })}
              />
            ))}
          </List>
        </Group>
      ))}
    </Screen>
  );
}
