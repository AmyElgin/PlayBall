import { useState } from 'react';

import {
  Body, Choice, Done, ErrorText, Field, H2, Loading, Screen, SheetHeader, Stack, Steps,
} from '../components/ui';
import { getAreas, getProfiles, setStaffRole } from '../lib/api';
import type { Profile } from '../lib/types';
import { useLoad } from '../lib/useLoad';

/** Manager: turn someone who has signed up into a coach, in two taps. */
export default function AddCoach() {
  const [search, setSearch] = useState('');
  const [person, setPerson] = useState<Profile | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data } = useLoad(async () => ({ people: await getProfiles(), areas: await getAreas() }), []);

  if (!data) return <Screen top={false}><SheetHeader /><Loading /></Screen>;

  if (done) return <Screen top={false}><Done title={`${done.split(' ')[0]} is a coach`} text="They will see their lessons next time they open the app." /></Screen>;

  if (person) {
    return (
      <Screen top={false}>
        <SheetHeader onBack={() => setPerson(null)} />
        <Steps count={2} at={1} />
        <H2>Which area will {person.full_name.split(' ')[0]} coach in?</H2>
        <ErrorText text={error} />
        <Stack>
          {data.areas.map((a) => (
            <Choice
              key={a.id}
              title={a.name}
              onPress={async () => {
                try {
                  await setStaffRole(person.id, 'coach', a.id);
                  setDone(person.full_name);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          ))}
        </Stack>
      </Screen>
    );
  }

  const q = search.trim().toLowerCase();
  const matches = data.people
    .filter((p) => p.role === 'parent' && (!q || p.full_name.toLowerCase().includes(q) || (p.phone ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, ''))))
    .slice(0, 20);

  return (
    <Screen top={false}>
      <SheetHeader />
      <Steps count={2} at={0} />
      <H2>Who is the new coach?</H2>
      <Body muted>Ask them to download the app and create an account first. Then find them here.</Body>
      <Field label="Search by name or cellphone" value={search} onChangeText={setSearch} autoCorrect={false} />
      <Stack>
        {matches.map((p) => <Choice key={p.id} title={p.full_name || 'No name'} subtitle={p.phone ?? undefined} onPress={() => setPerson(p)} />)}
        {q && !matches.length ? <Body muted>Nobody with that name has an account yet.</Body> : null}
      </Stack>
    </Screen>
  );
}
