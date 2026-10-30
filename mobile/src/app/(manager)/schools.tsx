import { router } from 'expo-router';

import { Body, Button, Empty, ErrorText, Greeting, Group, List, Loading, Row, Screen, Stack } from '../../components/ui';
import { getAreas, getChildCounts, getClasses, getCurrentTerm, getSchools } from '../../lib/api';
import { dayMonth } from '../../lib/dates';
import { useLoad } from '../../lib/useLoad';

export default function Schools() {
  const { data, error, refreshing, refresh } = useLoad(async () => {
    const [areas, schools, classes, counts, term] = await Promise.all([getAreas(), getSchools(), getClasses(), getChildCounts(), getCurrentTerm()]);
    return { areas, schools, classes, counts, term };
  }, []);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Greeting title="Schools" />
      <Body muted>Coaches can only swap lessons with coaches in the same area.</Body>
      <ErrorText text={error} />
      {!data && !error ? <Loading /> : null}
      {data?.areas.map((a) => {
        const list = data.schools.filter((s) => s.area_id === a.id);
        return (
          <Group key={a.id} label={a.name}>
            {list.length ? (
              <List>
                {list.map((s, i) => {
                  const ks = data.classes.filter((k) => k.school_id === s.id);
                  const kids = ks.reduce((n, k) => n + (data.counts[k.id] ?? 0), 0);
                  return (
                    <Row
                      key={s.id}
                      last={i === list.length - 1}
                      title={s.name}
                      subtitle={ks.length ? `${ks.length} class${ks.length > 1 ? 'es' : ''} · ${kids} children` : 'No classes yet'}
                      onPress={() => router.push({ pathname: '/school', params: { id: s.id } })}
                    />
                  );
                })}
              </List>
            ) : <Empty text="No schools in this area yet." />}
          </Group>
        );
      })}
      {data ? (
        <Stack gap={8}>
          <Button
            title={data.term ? `Term dates: ${dayMonth(data.term.starts_on)} – ${dayMonth(data.term.ends_on)}` : 'Set term dates'}
            variant="secondary"
            onPress={() => router.push('/term')}
          />
          <Button title="Add a school or area" variant="secondary" onPress={() => router.push('/add-school')} />
        </Stack>
      ) : null}
    </Screen>
  );
}
