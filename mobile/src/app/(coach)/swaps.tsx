import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import {
  Banner, Body, Button, ErrorText, Greeting, Group, List, Loading, Row, Screen,
} from '../../components/ui';
import { getAreas, getMySwaps, respondSwap, withdrawSwap } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { DAYS, dayMonth, hhmm } from '../../lib/dates';
import { useLoad } from '../../lib/useLoad';

const first = (name: string) => name.split(' ')[0];

export default function Swaps() {
  const { profile } = useAuth();
  const me = profile!.id;
  const [error, setError] = useState<string | null>(null);
  const { data, error: loadError, refreshing, refresh, reload } = useLoad(async () => {
    const [swaps, areas] = await Promise.all([getMySwaps(me), getAreas()]);
    return { swaps, areaName: areas.find((a) => a.id === profile?.area_id)?.name ?? 'your area' };
  }, [me]);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const incoming = data?.swaps.filter((s) => s.to_coach === me && s.status === 'pending') ?? [];
  const history = data?.swaps.filter((s) => !(s.to_coach === me && s.status === 'pending')) ?? [];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Greeting title="Swaps" />
      <Body muted>Give a lesson to another coach in {data?.areaName ?? 'your area'}.</Body>
      <ErrorText text={error ?? loadError} />
      {incoming.map((s) => (
        <Banner key={s.id} tone="info">
          <View style={{ gap: 2 }}>
            <Body bold>{first(s.from.full_name)} asked you to take a lesson</Body>
            <Body small>{s.class.school.name} · {DAYS[s.class.weekday - 1]}s at {hhmm(s.class.starts_at)}</Body>
            <Body small>{s.weeks} week{s.weeks > 1 ? 's' : ''}, starting {dayMonth(s.first_date)}</Body>
            {s.note ? <Body small muted>“{s.note}”</Body> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="Accept" onPress={() => act(() => respondSwap(s.id, true))} /></View>
            <View style={{ flex: 1 }}><Button title="Decline" variant="secondary" onPress={() => act(() => respondSwap(s.id, false))} /></View>
          </View>
        </Banner>
      ))}
      <Button title="Give a lesson away" onPress={() => router.push('/give')} />
      {!data && !loadError ? <Loading /> : null}
      {history.length ? (
        <Group label="History">
          <List>
            {history.map((s, i) => {
              const out = s.from_coach === me;
              const status = { accepted: 'Agreed', pending: 'Waiting', declined: 'Declined', withdrawn: 'Withdrawn' }[s.status];
              return (
                <Row
                  key={s.id}
                  last={i === history.length - 1}
                  title={out ? `To ${first(s.to.full_name)}` : `From ${first(s.from.full_name)}`}
                  subtitle={`${s.class.school.name} · ${s.weeks} wk from ${dayMonth(s.first_date)}${out && s.status === 'pending' ? ' · tap to withdraw' : ''}`}
                  right={<Body small bold muted={s.status !== 'accepted'}>{status}</Body>}
                  onPress={out && s.status === 'pending' ? () => Alert.alert('Withdraw this request?', `${first(s.to.full_name)} will no longer be asked.`, [
                    { text: 'Keep it', style: 'cancel' },
                    { text: 'Withdraw', style: 'destructive', onPress: () => act(() => withdrawSwap(s.id)) },
                  ]) : undefined}
                />
              );
            })}
          </List>
        </Group>
      ) : null}
    </Screen>
  );
}

