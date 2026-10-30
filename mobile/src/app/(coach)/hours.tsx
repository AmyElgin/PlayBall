import { Text } from 'react-native';

import { ConfirmCard } from '../../components/ConfirmCard';
import { Body, Empty, ErrorText, Group, Hours, List, Loading, Row, Screen, Stack } from '../../components/ui';
import { coachMinutes, getDoneLessons, myLessonsToConfirm } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dayMonth, hhmm, hoursText, monthEnd, monthName, monthStart, parse, previousMonth, today } from '../../lib/dates';
import { font, useColors } from '../../lib/theme';
import { useLoad } from '../../lib/useLoad';

export default function HoursScreen() {
  const c = useColors();
  const { profile } = useAuth();
  const id = profile!.id;

  const { data, error, refreshing, refresh, reload } = useLoad(async () => {
    const from = monthStart(today());
    const last = previousMonth(today());
    const [minutes, lastMinutes, lessons, toConfirm] = await Promise.all([
      coachMinutes(id, from, monthEnd(today())),
      coachMinutes(id, last, monthEnd(last)),
      getDoneLessons(id, from, monthEnd(today())),
      myLessonsToConfirm(),
    ]);
    return { minutes, lastMinutes, lessons, toConfirm };
  }, [id]);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack gap={4}>
        <Body muted>{monthName(today())} {parse(today()).getFullYear()}</Body>
        {data ? <Hours minutes={data.minutes} /> : <Loading />}
        {data ? <Body muted>{data.lessons.length} lessons coached · last month {hoursText(data.lastMinutes)}</Body> : null}
      </Stack>
      <ErrorText text={error} />
      {data?.toConfirm[0] ? <ConfirmCard lesson={data.toConfirm[0]} onDone={reload} /> : null}
      {data ? (
        <Group label="Lessons this month">
          {data.lessons.length ? (
            <List>
              {data.lessons.map((l, i) => (
                <Row
                  key={l.lesson_date + l.class.starts_at + i}
                  last={i === data.lessons.length - 1}
                  time={dayMonth(l.lesson_date)}
                  title={l.class.school.name}
                  subtitle={`${hhmm(l.class.starts_at)} · ${l.class.age_group}`}
                  right={<Text style={{ color: c.green, fontFamily: font.bold, fontSize: 14 }}>{hoursText(l.class.duration_min)}</Text>}
                />
              ))}
            </List>
          ) : <Empty text="Nothing yet this month. Lessons appear here once you confirm them." />}
        </Group>
      ) : null}
    </Screen>
  );
}
