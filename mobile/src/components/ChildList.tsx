import { useState } from 'react';
import { Text, View } from 'react-native';

import type { ChildWithParent } from '../lib/api';
import { font, useColors } from '../lib/theme';
import { TextButton } from './ui';

/** Children in a class, hidden until asked for. */
export function ChildList({ kids }: { kids: ChildWithParent[] }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <TextButton title={open ? 'Hide the children' : `See the ${kids.length} children`} onPress={() => setOpen(!open)} />
      {open
        ? kids.map((ch) => (
          <View key={ch.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <Text style={{ color: c.ink, fontFamily: font.medium, fontSize: 15 }}>{ch.first_name} {ch.last_name}</Text>
            {ch.parent ? <Text style={{ color: c.muted, fontFamily: font.regular, fontSize: 14 }}>{ch.parent.phone ?? ch.parent.full_name}</Text> : null}
          </View>
        ))
        : null}
      {open && kids.some((ch) => ch.medical_notes) ? (
        <View style={{ marginTop: 8, gap: 4 }}>
          <Text style={{ color: c.ink, fontFamily: font.bold, fontSize: 15 }}>Medical notes</Text>
          {kids.filter((ch) => ch.medical_notes).map((ch) => (
            <Text key={ch.id} style={{ color: c.ink, fontFamily: font.regular, fontSize: 14 }}>{ch.first_name}: {ch.medical_notes}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
