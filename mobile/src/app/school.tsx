import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import {
  Body, Button, Chip, Empty, ErrorText, Group, H2, List, Loading, Row, RowView, Screen, SheetHeader,
} from '../components/ui';
import { getAreas, getChildCounts, getClasses, getProfiles, getSchools, moveSchool } from '../lib/api';
import { DAYS, hhmm } from '../lib/dates';
import { useLoad } from '../lib/useLoad';

/** Manager: a school's classes, and which area it belongs to. */
export default function School() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const { data, error: loadError, reload } = useLoad(async () => {
    const [schools, areas, classes, counts, people] = await Promise.all([getSchools(), getAreas(), getClasses(), getChildCounts(), getProfiles()]);
    return { school: schools.find((s) => s.id === id)!, areas, classes: classes.filter((k) => k.school_id === id), counts, people };
  }, [id]);

  if (!data) return <Screen top={false}><SheetHeader />{loadError ? <ErrorText text={loadError} /> : <Loading />}</Screen>;
  const { school, areas, classes, counts, people } = data;
  const coachName = (cid: string) => people.find((p) => p.id === cid)?.full_name.split(' ')[0] ?? '';

  async function move(areaId: string) {
    setError(null);
    try {
      await moveSchool(id, areaId);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen top={false}>
      <SheetHeader />
      <H2>{school.name}</H2>
      <Group label="Area">
        <RowView>
          {areas.map((a) => <Chip key={a.id} label={a.name} selected={a.id === school.area_id} onPress={() => move(a.id)} />)}
        </RowView>
        <ErrorText text={error} />
      </Group>
      <Group label="Classes">
        {classes.length ? (
          <List>
            {classes.map((k, i) => (
              <Row
                key={k.id}
                last={i === classes.length - 1}
                time={hhmm(k.starts_at)}
                title={`${DAYS[k.weekday - 1]}s · ${k.age_group}`}
                subtitle={`${counts[k.id] ?? 0} children · Coach ${coachName(k.coach_id)}`}
              />
            ))}
          </List>
        ) : <Empty text="No classes at this school yet." />}
      </Group>
      <Button title="Add a class" variant="secondary" onPress={() => router.push({ pathname: '/add-class', params: { schoolId: id } })} />
      <Body small muted>Tap a lesson on the Schedule to see the children in it.</Body>
    </Screen>
  );
}
