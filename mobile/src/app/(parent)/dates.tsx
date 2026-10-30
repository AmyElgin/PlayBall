import { Text, View } from 'react-native';

import { useChild } from '../../components/ChildPicker';
import {
  Body, Empty, ErrorText, Greeting, Group, KeyValue, List, Loading, Row, Screen, StateText,
} from '../../components/ui';
import { childTermDates, getCurrentTerm } from '../../lib/api';
import { DAYS, dayMonth, monthName, shortDate, timeRange, today } from '../../lib/dates';
import { font, useColors } from '../../lib/theme';
import type { TermDate } from '../../lib/types';
import { useLoad } from '../../lib/useLoad';

/** Every lesson date this term for the chosen child, grouped by month. */
export default function Dates() {
  const c = useColors();
  const { child, picker, kids } = useChild();
  const { data, error, refreshing, refresh } = useLoad(async () => {
    const [dates, term] = await Promise.all([child ? childTermDates(child.id) : Promise.resolve([]), getCurrentTerm()]);
    return { dates, term };
  }, [child?.id]);

  const next = data?.dates.find((d) => d.lesson_date >= today() && ['upcoming', 'live'].includes(d.state));
  const toCome = data?.dates.filter((d) => d.lesson_date >= today() && d.state !== 'cancelled').length ?? 0;
  const months: { name: string; dates: TermDate[] }[] = [];
  for (const d of data?.dates ?? []) {
    const name = monthName(d.lesson_date);
    const g = months.find((m) => m.name === name);
    if (g) g.dates.push(d);
    else months.push({ name, dates: [d] });
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Greeting title="Term dates" />
      {data?.term ? (
        <Body muted>{dayMonth(data.term.starts_on)} – {dayMonth(data.term.ends_on)} · {data.dates.length} lessons, {toCome} still to come</Body>
      ) : null}
      {picker}
      <ErrorText text={error} />
      {kids && !kids.length ? <Empty text="Sign up a child on the Home tab to see their lesson dates." /> : null}
      {child ? (
        <List>
          <View style={{ paddingHorizontal: 16 }}>
            <KeyValue k="School" v={child.class.school.name} />
            <KeyValue k="Group" v={child.class.age_group} />
            <KeyValue k="When" v={`${DAYS[child.class.weekday - 1]}s, ${timeRange(child.class.starts_at, child.class.duration_min)}`} last />
          </View>
        </List>
      ) : null}
      {child && !data && !error ? <Loading /> : null}
      {data && child && !data.dates.length ? <Empty text="Term dates haven’t been set yet." /> : null}
      {months.map((m) => (
        <Group key={m.name} label={m.name}>
          <List>
            {m.dates.map((d, i) => {
              const past = d.lesson_date < today() || d.state === 'done';
              return (
                <Row
                  key={d.lesson_date}
                  last={i === m.dates.length - 1}
                  title={d.lesson_date === today() ? 'Today' : shortDate(d.lesson_date)}
                  subtitle={d.state === 'cancelled' ? `Cancelled${d.reason ? ` · ${d.reason}` : ''}` : past ? 'Done' : d.coach_name ? `Coach ${d.coach_name}` : undefined}
                  dimmed={past && d.state !== 'cancelled'}
                  right={d.state === 'cancelled' ? <StateText state="cancelled" /> : d === next ? <Text style={{ color: c.primary, fontFamily: font.bold, fontSize: 14 }}>Next</Text> : undefined}
                />
              );
            })}
          </List>
        </Group>
      ))}
    </Screen>
  );
}
