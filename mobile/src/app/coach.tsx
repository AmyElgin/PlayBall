import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button, Chip, ErrorText, Group, H2, List, Loading, Row, RowView, Screen, SheetHeader,
} from '../components/ui';
import { coachMinutes, getAreas, getClasses, getProfiles, getSchools, setStaffRole } from '../lib/api';
import { DAYS, hhmm, hoursText, monthEnd, monthStart, previousMonth, today } from '../lib/dates';
import { font, useColors } from '../lib/theme';
import { useLoad } from '../lib/useLoad';

/** Manager: one coach's hours, area and weekly lessons. */
export default function CoachDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const { data, error: loadError, reload } = useLoad(async () => {
    const last = previousMonth(today());
    const [people, areas, classes, schools, thisMonth, lastMonth] = await Promise.all([
      getProfiles(), getAreas(), getClasses(), getSchools(),
      coachMinutes(id, monthStart(today()), monthEnd(today())),
      coachMinutes(id, last, monthEnd(last)),
    ]);
    return { coach: people.find((p) => p.id === id)!, areas, classes: classes.filter((k) => k.coach_id === id), schools, thisMonth, lastMonth };
  }, [id]);

  if (!data) return <Screen top={false}><SheetHeader />{loadError ? <ErrorText text={loadError} /> : <Loading />}</Screen>;
  const { coach, areas, classes, schools, thisMonth, lastMonth } = data;

  async function change(role: 'coach' | 'parent', areaId: string | null) {
    setError(null);
    try {
      await setStaffRole(id, role, areaId);
      if (role === 'parent') setRemoved(true);
      else await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const stat = (label: string, mins: number, dim?: boolean) => (
    <View style={{ gap: 2 }}>
      <Text style={{ color: c.muted, fontFamily: font.bold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ color: dim ? c.muted : c.ink, fontFamily: font.extrabold, fontSize: 30 }}>{hoursText(mins)}</Text>
    </View>
  );

  return (
    <Screen top={false}>
      <SheetHeader />
      <H2>{coach.full_name}</H2>
      <RowView style={{ gap: 32 }}>
        {stat('This month', thisMonth)}
        {stat('Last month', lastMonth, true)}
      </RowView>
      <Group label="Area">
        <RowView>{areas.map((a) => <Chip key={a.id} label={a.name} selected={coach.area_id === a.id} onPress={() => change('coach', a.id)} />)}</RowView>
      </Group>
      <Group label="Weekly lessons">
        <List>
          {classes.map((k, i) => (
            <Row
              key={k.id}
              last={i === classes.length - 1}
              time={hhmm(k.starts_at)}
              title={schools.find((s) => s.id === k.school_id)?.name ?? ''}
              subtitle={`${DAYS[k.weekday - 1]}s · ${k.age_group}`}
            />
          ))}
          {!classes.length ? <Row title="No regular lessons" /> : null}
        </List>
      </Group>
      {coach.phone ? <Text style={{ color: c.muted, fontFamily: font.regular, fontSize: 15 }} selectable>Phone: {coach.phone}</Text> : null}
      <ErrorText text={error} />
      {removed
        ? <Text style={{ color: c.muted, fontFamily: font.regular }}>Removed as a coach.</Text>
        : classes.length
          ? null
          : <Button title="Remove as a coach" variant="secondary" onPress={() => change('parent', null)} />}
    </Screen>
  );
}
