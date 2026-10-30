import { useColorScheme } from 'react-native';

// Same palette as the prototype: one blue for actions, red only for cancelling,
// Playball's four logo colours used only in the small brand mark.
const light = {
  bg: '#f5f6f8',
  surface: '#ffffff',
  soft: '#f0f2f5',
  line: '#e5e7eb',
  ink: '#171a21',
  muted: '#6a7180',
  primary: '#1667c4',
  primarySoft: '#e9f1fb',
  onPrimary: '#ffffff',
  red: '#d33a2c',
  redSoft: '#fcecea',
  green: '#1d8a44',
  greenSoft: '#e7f5ec',
  amber: '#8a5b00',
  amberSoft: '#fff3d6',
};

const dark: typeof light = {
  bg: '#0f1115',
  surface: '#181b21',
  soft: '#20242c',
  line: '#2a2f38',
  ink: '#eef0f3',
  muted: '#9aa1ad',
  primary: '#5ea8f2',
  primarySoft: '#1a2a3d',
  onPrimary: '#0f1115',
  red: '#f47366',
  redSoft: '#3a1f1d',
  green: '#5cc883',
  greenSoft: '#17301f',
  amber: '#f2c35b',
  amberSoft: '#352a12',
};

export const brand = { red: '#e5322d', yellow: '#ffcc1a', green: '#22a04b', blue: '#1b8fd6' };

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const font = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
};
