import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { useColors } from '../lib/theme';

export function AccountButton() {
  const c = useColors();
  return (
    <Pressable onPress={() => router.push('/account')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Your account">
      <Ionicons name="person-circle-outline" size={32} color={c.muted} />
    </Pressable>
  );
}
