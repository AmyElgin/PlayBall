import {
  Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold, useFonts,
} from '@expo-google-fonts/figtree';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Body, Button, Loading } from '../components/ui';
import { AuthProvider, useAuth } from '../lib/auth';
import { useColors } from '../lib/theme';
import type { Role } from '../lib/types';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <Navigation />
    </AuthProvider>
  );
}

// Where tapping a push notification takes you.
function routeFor(kind: unknown, role: Role | undefined): string | null {
  if (role === 'coach') return kind === 'swap_request' || kind === 'swap_answer' ? '/swaps' : '/lessons';
  if (role === 'parent') return '/messages';
  if (role === 'manager') return '/schedule';
  return null;
}

function Navigation() {
  const c = useColors();
  const { session, profile, loading, signOut, refreshProfile } = useAuth();
  const [fontsLoaded] = useFonts({ Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold });
  const role = session ? profile?.role : undefined;

  useEffect(() => {
    if (fontsLoaded && !loading) SplashScreen.hideAsync();
  }, [fontsLoaded, loading]);

  useEffect(() => {
    if (!role) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const href = routeFor(response.notification.request.content.data?.kind, role);
      if (href) router.navigate(href as never);
    });
    return () => sub.remove();
  }, [role]);

  if (!fontsLoaded || loading) return null;

  if (session && !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Loading />
        <Body muted style={{ textAlign: 'center' }}>Loading your account…</Body>
        <Button title="Try again" variant="secondary" onPress={refreshProfile} />
        <Button title="Sign out" variant="secondary" onPress={signOut} />
      </View>
    );
  }

  const modal = { presentation: 'modal' as const };
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={role === 'manager'}>
          <Stack.Screen name="(manager)" />
          <Stack.Screen name="cancel" options={modal} />
          <Stack.Screen name="school" options={modal} />
          <Stack.Screen name="coach" options={modal} />
          <Stack.Screen name="add-coach" options={modal} />
          <Stack.Screen name="add-class" options={modal} />
          <Stack.Screen name="add-school" options={modal} />
          <Stack.Screen name="term" options={modal} />
        </Stack.Protected>
        <Stack.Protected guard={role === 'coach'}>
          <Stack.Screen name="(coach)" />
          <Stack.Screen name="give" options={modal} />
          <Stack.Screen name="missed" options={modal} />
          <Stack.Screen name="coach-cancel" options={modal} />
        </Stack.Protected>
        <Stack.Protected guard={role === 'coach' || role === 'manager'}>
          <Stack.Screen name="lesson" options={modal} />
        </Stack.Protected>
        <Stack.Protected guard={role === 'parent'}>
          <Stack.Screen name="(parent)" />
          <Stack.Screen name="add-child" options={modal} />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="account" options={modal} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
