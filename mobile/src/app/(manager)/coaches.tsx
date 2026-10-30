import { router } from 'expo-router';
import { Text } from 'react-native';

import { Body, Button, Empty, ErrorText, Greeting, Group, List, Loading, Row, Screen } from '../../components/ui';
import { coachSummary } from '../../lib/api';
import { hoursText, monthName, today } from '../../lib/dates';
import { font, useColors } from '../../lib/theme';
import type { CoachSummary } from '../../lib/types';
import { useLoad } from '../../lib/useLoad';

export default function Coaches() {
  const c = useColors();
  const { data, error, refreshing, refresh } = useLoad(() => coachSummary(today()), []);

  const areas: { name: string; coaches: CoachSummary[] }[] = [];
  for (const co of data ?? []) {
    const name = co.area_name ?? 'No area';
    const g = areas.find((a) => a.name === name);
    if (g) g.coaches.push(co);
    else areas.push({ name, coaches: [co] });
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Greeting title="Coaches" />
      <Body muted>Hours for {monthName(today())}. Only lessons the coach confirmed count.</Body>
      <ErrorText text={error} />
      {!data && !error ? <Loading /> : null}
      {data && !data.length ? <Empty text="No coaches yet. Add your first coach below." /> : null}
      {areas.map((a) => (
        <Group key={a.name} label={a.name}>
          <List>
            {a.coaches.map((co, i) => (
              <Row
                key={co.coach_id}
                last={i === a.coaches.length - 1}
                title={co.full_name}
                subtitle={co.to_confirm ? `${co.to_confirm} lesson${co.to_confirm > 1 ? 's' : ''} to confirm` : undefined}
                right={<Text style={{ color: c.ink, fontFamily: font.bold, fontSize: 16 }}>{hoursText(co.minutes)}</Text>}
                onPress={() => router.push({ pathname: '/coach', params: { id: co.coach_id } })}
              />
            ))}
          </List>
        </Group>
      ))}
      <Button title="Add a coach" variant="secondary" onPress={() => router.push('/add-coach')} />
    </Screen>
  );
}
