import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AccountButton } from '../../components/AccountButton';
import {
  Body, Button, Empty, ErrorText, Greeting, Group, H2, List, Loading, Row, Screen, StateText,
} from '../../components/ui';
import { scheduleForDay } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { addDays, DAYS, dayMonth, dayWord, hhmm, longDate, mondayOf, nextSchoolDay, parse, today } from '../../lib/dates';
import { font, useColors } from '../../lib/theme';
import type { DayLesson } from '../../lib/types';
import { useLoad } from '../../lib/useLoad';

export default function Schedule() {
  const c = useColors();
  const { profile } = useAuth();
  const thisMonday = mondayOf(nextSchoolDay(today()));
  const [day, setDay] = useState(nextSchoolDay(today()));
  const monday = mondayOf(day);
  const weekOffset = Math.round((parse(monday).getTime() - parse(thisMonday).getTime()) / (7 * 86400000));

  const { data, error, refreshing, refresh } = useLoad(() => scheduleForDay(day), [day]);

  const areas: { name: string; lessons: DayLesson[] }[] = [];
  for (const l of data ?? []) {
    const g = areas.find((a) => a.name === l.area_name);
    if (g) g.lessons.push(l);
    else areas.push({ name: l.area_name, lessons: [l] });
  }

  const hour = new Date().getHours();
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Greeting
        subtitle={longDate(today())}
        title={`Good ${hour < 12 ? 'morning' : 'afternoon'}${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`}
        right={<AccountButton />}
      />
      <Button title="Cancel lessons" variant="danger" onPress={() => router.push('/cancel')} />

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <WeekArrow label="‹" a11y="Previous week" onPress={() => setDay(addDays(monday, -7))} />
          <Text style={{ color: c.ink, fontFamily: font.bold, fontSize: 15 }}>
            {weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Next week' : weekOffset === -1 ? 'Last week' : `Week of ${dayMonth(monday)}`}
          </Text>
          <WeekArrow label="›" a11y="Next week" onPress={() => setDay(addDays(monday, 7))} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[0, 1, 2, 3, 4].map((i) => {
            const d = addDays(monday, i);
            const on = d === day;
            return (
              <Pressable
                key={d}
                onPress={() => setDay(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={longDate(d)}
                style={{
                  flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1,
                  backgroundColor: on ? c.ink : c.surface,
                  borderColor: on ? c.ink : d === today() ? c.primary : c.line,
                }}
              >
                <Text style={{ color: on ? c.bg : c.muted, fontFamily: font.semibold, fontSize: 13 }}>{DAYS[i].slice(0, 3)}</Text>
                <Text style={{ color: on ? c.bg : c.ink, fontFamily: font.bold, fontSize: 18 }}>{parse(d).getDate()}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <H2>{dayWord(day)}</H2>
      <ErrorText text={error} />
      {!data && !error ? <Loading /> : null}
      {data && !data.length ? <Empty text="No lessons on this day." /> : null}
      {areas.map((a) => (
        <Group key={a.name} label={a.name}>
          <List>
            {a.lessons.map((l, i) => (
              <Row
                key={l.class_id}
                last={i === a.lessons.length - 1}
                time={hhmm(l.starts_at)}
                title={l.school_name}
                subtitle={`${l.age_group} · ${l.coach_name.split(' ')[0]}${l.covering ? ' (covering)' : ''}`}
                right={<StateText state={l.state} />}
                onPress={() => router.push({ pathname: '/lesson', params: { classId: l.class_id, date: day } })}
              />
            ))}
          </List>
        </Group>
      ))}
      {data?.length ? <Body small muted>{data.reduce((n, l) => n + l.child_count, 0)} children have Playball on this day.</Body> : null}
    </Screen>
  );
}

function WeekArrow({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={a11y} style={{ width: 40, height: 36, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.muted, fontSize: 26 }}>{label}</Text>
    </Pressable>
  );
}
