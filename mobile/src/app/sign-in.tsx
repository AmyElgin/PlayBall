import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Body, BrandDots, Button, ErrorText, Field, H1, RowView, Screen, Segmented, Stack } from '../components/ui';
import { supabase } from '../lib/supabase';
import { font, useColors } from '../lib/theme';

export default function SignIn() {
  const c = useColors();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setInfo(null);
    if (!email.trim() || password.length < 8) {
      setError('Enter your email and a password of at least 8 characters.');
      return;
    }
    if (mode === 'up' && (!name.trim() || !phone.trim())) {
      setError('Enter your name and cellphone number.');
      return;
    }
    setBusy(true);
    if (mode === 'in') {
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (e) setError(e.message === 'Invalid login credentials' ? 'That email and password don’t match.' : e.message);
    } else {
      const { data, error: e } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim(), phone: phone.trim() } },
      });
      if (e) setError(e.message);
      else if (!data.session) setInfo('Check your email and tap the link to finish creating your account.');
    }
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <RowView>
          <BrandDots />
          <Text style={{ color: c.ink, fontFamily: font.extrabold, fontSize: 20 }}>Playball</Text>
        </RowView>
        <View style={{ gap: 4 }}>
          <H1>{mode === 'in' ? 'Welcome back' : 'Create your account'}</H1>
          <Body muted>Lesson days, cancellations and sign-ups in one place.</Body>
        </View>
        <Segmented
          options={[{ value: 'in', label: 'Sign in' }, { value: 'up', label: 'New here' }]}
          value={mode}
          onChange={(m) => { setMode(m); setError(null); setInfo(null); }}
        />
        <Stack gap={14}>
          {mode === 'up' ? (
            <>
              <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
              <Field label="Cellphone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" />
            </>
          ) : null}
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={mode === 'in' ? 'password' : 'newPassword'}
            onSubmitEditing={submit}
          />
          <ErrorText text={error} />
          {info ? <Body>{info}</Body> : null}
          <Button title={mode === 'in' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} />
        </Stack>
        {mode === 'up' ? (
          <Body small muted>Coaches: create an account here, then ask your manager to add you as a coach.</Body>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
