import { useState } from 'react';

import { Body, Button, ErrorText, Field, H2, Screen, SheetHeader, Stack } from '../components/ui';
import { updateMyProfile } from '../lib/api';
import { useAuth } from '../lib/auth';

const ROLE_TEXT = { manager: 'Manager', coach: 'Coach', parent: 'Parent' };

/** Name, cellphone and signing out. */
export default function Account() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateMyProfile(profile.id, name.trim(), phone.trim());
      await refreshProfile();
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <Screen top={false}>
      <SheetHeader />
      <H2>Your account</H2>
      <Body muted>{session?.user.email} · {profile ? ROLE_TEXT[profile.role] : ''}</Body>
      <Stack gap={14}>
        <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" />
        <Field label="Cellphone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <ErrorText text={error} />
        {saved ? <Body muted>Saved.</Body> : null}
        <Button title="Save" onPress={save} loading={busy} />
      </Stack>
      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
