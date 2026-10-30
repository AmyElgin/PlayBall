import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Chip, ErrorText, Field, Group, H2, RowView, Screen, Segmented, SheetHeader } from '../components/ui';
import { addArea, addSchool, getAreas } from '../lib/api';
import { useLoad } from '../lib/useLoad';

/** Manager: add a school or a new area. */
export default function AddSchool() {
  const [kind, setKind] = useState<'school' | 'area'>('school');
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: areas } = useLoad(getAreas, []);

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError(kind === 'school' ? 'Type the school’s name.' : 'Type the area’s name.');
      return;
    }
    if (kind === 'school' && !areaId) {
      setError('Choose an area.');
      return;
    }
    setBusy(true);
    try {
      if (kind === 'school') await addSchool(name.trim(), areaId!);
      else await addArea(name.trim());
      router.back();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg.includes('duplicate') ? 'That name is already in the list.' : msg);
      setBusy(false);
    }
  }

  return (
    <Screen top={false}>
      <SheetHeader />
      <H2>Add a {kind}</H2>
      <Segmented options={[{ value: 'school', label: 'School' }, { value: 'area', label: 'Area' }]} value={kind} onChange={setKind} />
      <Field
        label={kind === 'school' ? 'School name' : 'Area name'}
        value={name}
        onChangeText={setName}
        placeholder={kind === 'school' ? 'e.g. Simon Peter Pre-School' : 'e.g. Gillitts'}
      />
      {kind === 'school' ? (
        <Group label="Area">
          <RowView>{(areas ?? []).map((a) => <Chip key={a.id} label={a.name} selected={areaId === a.id} onPress={() => setAreaId(a.id)} />)}</RowView>
        </Group>
      ) : (
        <Body muted>Coaches can only swap lessons with coaches in the same area.</Body>
      )}
      <ErrorText text={error} />
      <Button title={`Add ${kind}`} onPress={save} loading={busy} />
    </Screen>
  );
}
