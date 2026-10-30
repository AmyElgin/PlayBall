import { Redirect } from 'expo-router';

import { useAuth } from '../lib/auth';

/** Sends each person to the right home screen. */
export default function Index() {
  const { session, profile } = useAuth();
  if (!session) return <Redirect href="/sign-in" />;
  if (profile?.role === 'manager') return <Redirect href="/schedule" />;
  if (profile?.role === 'coach') return <Redirect href="/lessons" />;
  return <Redirect href="/home" />;
}
