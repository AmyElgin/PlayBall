import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hoursText } from '../lib/dates';
import { brand, font, useColors } from '../lib/theme';
import type { LessonState } from '../lib/types';

// ------------------------------------------------------------------ layout

/** A scrolling screen with pull-to-refresh and safe-area padding. */
export function Screen({
  children, refreshing = false, onRefresh, top = true,
}: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; top?: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 18, paddingTop: (top ? insets.top : 0) + 20, paddingBottom: 40, gap: 22 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Header for modal screens: Back on the left (if any), close on the right. */
export function SheetHeader({ onBack }: { onBack?: () => void }) {
  const c = useColors();
  return (
    <View style={styles.sheetHeader}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.textButton, { color: c.primary }]}>‹ Back</Text>
        </Pressable>
      ) : <View />}
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={[styles.close, { backgroundColor: c.soft }]}
      >
        <Text style={{ color: c.muted, fontSize: 16, fontFamily: font.bold }}>✕</Text>
      </Pressable>
    </View>
  );
}

export function Stack({ gap = 12, children, style }: { gap?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function RowView({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, style]}>{children}</View>;
}

// -------------------------------------------------------------------- text

export function H1({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.h1, { color: c.ink }]} accessibilityRole="header">{children}</Text>;
}
export function H2({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.h2, { color: c.ink }]} accessibilityRole="header">{children}</Text>;
}
export function Body({ children, muted, small, bold, style }: {
  children: ReactNode; muted?: boolean; small?: boolean; bold?: boolean; style?: StyleProp<TextStyle>;
}) {
  const c = useColors();
  return (
    <Text style={[{
      color: muted ? c.muted : c.ink,
      fontSize: small ? 14 : 16,
      lineHeight: small ? 19 : 22,
      fontFamily: bold ? font.bold : font.regular,
    }, style]}>
      {children}
    </Text>
  );
}
export function Label({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.label, { color: c.muted }]}>{children}</Text>;
}
export function Big({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.big, { color: c.ink }]}>{children}</Text>;
}

export function Greeting({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        {subtitle ? <Body muted>{subtitle}</Body> : null}
        <H1>{title}</H1>
      </View>
      {right}
    </View>
  );
}

/** Playball's four colours as a small mark, used next to the name. */
export function BrandDots() {
  return (
    <View style={{ width: 17, flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      {[brand.red, brand.yellow, brand.green, brand.blue].map((col) => (
        <View key={col} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: col }} />
      ))}
    </View>
  );
}

// ----------------------------------------------------------------- buttons

type Variant = 'primary' | 'secondary' | 'danger' | 'success';

export function Button({ title, onPress, variant = 'primary', disabled, loading, small }: {
  title: string; onPress: () => void; variant?: Variant; disabled?: boolean; loading?: boolean; small?: boolean;
}) {
  const c = useColors();
  const bg = { primary: c.primary, secondary: c.surface, danger: c.red, success: c.green }[variant];
  const fg = variant === 'secondary' ? c.ink : c.onPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        small && { minHeight: 40, paddingHorizontal: 14 },
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: c.line },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function TextButton({ title, onPress }: { title: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
      <Text style={[styles.textButton, { color: c.primary }]}>{title}</Text>
    </Pressable>
  );
}

/** A full-width option in a step-by-step flow. */
export function Choice({ title, subtitle, onPress, disabled, warn }: {
  title: string; subtitle?: string; onPress: () => void; disabled?: boolean; warn?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: pressed ? c.soft : c.surface, borderColor: c.line, opacity: disabled ? 0.45 : 1 },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.ink, fontFamily: font.bold, fontSize: 16 }}>{title}</Text>
        {subtitle ? <Text style={{ color: warn ? c.amber : c.muted, fontSize: 14, fontFamily: font.regular }}>{subtitle}</Text> : null}
      </View>
      <Chevron />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, { borderColor: selected ? c.ink : c.line, backgroundColor: selected ? c.ink : c.surface }]}
    >
      <Text style={{ color: selected ? c.bg : c.ink, fontFamily: font.semibold, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

/** Two or more options side by side, e.g. This week | Next week, or children's names. */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: c.soft }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && { backgroundColor: c.surface, shadowOpacity: 0.12 }]}
          >
            <Text style={{ color: on ? c.ink : c.muted, fontFamily: font.semibold, fontSize: 15 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ value, onChange, min = 1, max = 20, disabled, format }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; disabled?: boolean; format: (v: number) => string;
}) {
  const c = useColors();
  const btn = (label: string, next: number, a11y: string) => (
    <Pressable
      onPress={() => onChange(Math.min(max, Math.max(min, next)))}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={[styles.stepBtn, { borderColor: c.line, backgroundColor: c.surface, opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={{ color: c.ink, fontSize: 22, fontFamily: font.semibold }}>{label}</Text>
    </Pressable>
  );
  return (
    <RowView style={{ gap: 14, flexWrap: 'nowrap' }}>
      {btn('−', value - 1, 'Fewer')}
      <Text style={{ color: c.ink, fontFamily: font.bold, fontSize: 20, minWidth: 96, textAlign: 'center', opacity: disabled ? 0.4 : 1 }}>
        {format(value)}
      </Text>
      {btn('+', value + 1, 'More')}
    </RowView>
  );
}

// ------------------------------------------------------------------- lists

export function Group({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      {label ? <Label>{label}</Label> : null}
      {children}
    </View>
  );
}

export function List({ children }: { children: ReactNode }) {
  const c = useColors();
  return <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.line }]}>{children}</View>;
}

export function Row({ time, title, subtitle, right, onPress, dimmed, last }: {
  time?: string; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; dimmed?: boolean; last?: boolean;
}) {
  const c = useColors();
  const inner = (
    <>
      {time ? <Text style={[styles.rowTime, { color: c.ink, opacity: dimmed ? 0.5 : 1 }]}>{time}</Text> : null}
      <View style={{ flex: 1, gap: 2, opacity: dimmed ? 0.5 : 1 }}>
        <Text style={{ color: c.ink, fontFamily: font.bold, fontSize: 16 }}>{title}</Text>
        {subtitle ? <Text style={{ color: c.muted, fontSize: 14, fontFamily: font.regular }}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? <Chevron /> : null}
    </>
  );
  const style = [styles.row, { borderBottomColor: c.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }];
  if (!onPress) return <View style={style}>{inner}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [style, pressed && { backgroundColor: c.soft }]}>
      {inner}
    </Pressable>
  );
}

export function KeyValue({ k, v, last }: { k: string; v: ReactNode; last?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.kv, { borderBottomColor: c.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
      <Text style={{ color: c.muted, fontSize: 15, fontFamily: font.regular }}>{k}</Text>
      {typeof v === 'string' ? <Text style={{ color: c.ink, fontFamily: font.bold, fontSize: 15, flexShrink: 1, textAlign: 'right' }}>{v}</Text> : v}
    </View>
  );
}

export function Chevron() {
  const c = useColors();
  return <Text style={{ color: c.muted, fontSize: 22, marginLeft: 2 }}>›</Text>;
}

const STATE_TEXT: Record<LessonState, [keyof ReturnType<typeof useColors>, string]> = {
  done: ['green', 'Done'],
  missed: ['amber', 'Didn’t happen'],
  cancelled: ['red', 'Cancelled'],
  unconfirmed: ['amber', 'Not confirmed'],
  live: ['primary', 'On now'],
  upcoming: ['muted', ''],
};

export function StateText({ state }: { state: LessonState }) {
  const c = useColors();
  const [color, text] = STATE_TEXT[state];
  if (!text) return null;
  return <Text style={{ color: c[color], fontFamily: font.bold, fontSize: 14 }}>{text}</Text>;
}

export function Flag({ text, tone }: { text: string; tone: 'ok' | 'bad' }) {
  const c = useColors();
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: tone === 'ok' ? c.greenSoft : c.redSoft }}>
      <Text style={{ color: tone === 'ok' ? c.green : c.red, fontFamily: font.bold, fontSize: 13 }}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- feedback

export function Banner({ tone, children, onPress }: { tone: 'ask' | 'info' | 'danger'; children: ReactNode; onPress?: () => void }) {
  const c = useColors();
  const bg = { ask: c.amberSoft, info: c.primarySoft, danger: c.redSoft }[tone];
  const body = <View style={[styles.banner, { backgroundColor: bg }]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{body}</Pressable> : body;
}

export function Empty({ text }: { text: string }) {
  const c = useColors();
  return (
    <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.line, padding: 28 }]}>
      <Text style={{ color: c.muted, textAlign: 'center', fontFamily: font.regular, fontSize: 15 }}>{text}</Text>
    </View>
  );
}

export function ErrorText({ text }: { text: string | null }) {
  const c = useColors();
  if (!text) return null;
  return <Text style={{ color: c.red, fontFamily: font.semibold, fontSize: 15 }} accessibilityRole="alert">{text}</Text>;
}

export function Loading() {
  const c = useColors();
  return <View style={{ padding: 40 }}><ActivityIndicator color={c.muted} /></View>;
}

export function Steps({ count, at }: { count: number; at: number }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`Step ${at + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: i <= at ? c.primary : c.line }} />
      ))}
    </View>
  );
}

export function Done({ title, text }: { title: string; text: string }) {
  const c = useColors();
  return (
    <Stack gap={18}>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 16 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.green, fontSize: 30, fontFamily: font.bold }}>✓</Text>
        </View>
        <H2>{title}</H2>
        <Body muted style={{ textAlign: 'center' }}>{text}</Body>
      </View>
      <Button title="Done" onPress={() => router.back()} />
    </Stack>
  );
}

export function Hours({ minutes }: { minutes: number }) {
  return <Big>{hoursText(minutes)}</Big>;
}

// ------------------------------------------------------------------ inputs

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.ink, fontFamily: font.semibold, fontSize: 15 }}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted}
        {...props}
        style={[styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }, props.multiline && { minHeight: 80, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <RowView style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
      <Body small style={{ flex: 1 }}>{label}</Body>
    </RowView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, lineHeight: 34, fontFamily: font.extrabold, letterSpacing: -0.3 },
  h2: { fontSize: 21, lineHeight: 26, fontFamily: font.bold },
  label: { fontSize: 13, fontFamily: font.bold, letterSpacing: 0.6, textTransform: 'uppercase' },
  big: { fontSize: 48, lineHeight: 52, fontFamily: font.extrabold, letterSpacing: -0.5 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  textButton: { fontFamily: font.bold, fontSize: 16, paddingVertical: 6 },
  button: { minHeight: 50, borderRadius: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  buttonText: { fontFamily: font.bold, fontSize: 16 },
  choice: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9, shadowColor: '#000', shadowOpacity: 0, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  stepBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 13, minHeight: 64 },
  rowTime: { width: 54, fontFamily: font.bold, fontSize: 16, fontVariant: ['tabular-nums'] },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 11 },
  banner: { borderRadius: 16, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, fontFamily: font.regular },
});
