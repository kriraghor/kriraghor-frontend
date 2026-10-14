import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

/** Form primitives on the Kriraghor tokens: 48px targets, square corners (shape lock). */
export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | null }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: error ? theme.danger : theme.line, backgroundColor: theme.backgroundElement }]}
        {...input}
      />
    </View>
  );
}

export function Button({ title, onPress, busy, variant = 'primary' }: { title: string; onPress: () => void; busy?: boolean; variant?: 'primary' | 'outline' }) {
  const theme = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: !!busy, disabled: !!busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: theme.brand } : { borderWidth: 2, borderColor: theme.text },
        pressed && { opacity: 0.85 },
      ]}>
      {busy ? <ActivityIndicator color={primary ? theme.onBrand : theme.text} /> : <Text style={[styles.buttonText, { color: primary ? theme.onBrand : theme.text }]}>{title}</Text>}
    </Pressable>
  );
}

export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'error' }) {
  const theme = useTheme();
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.notice, { borderLeftColor: tone === 'error' ? theme.danger : theme.brand, color: tone === 'error' ? theme.danger : theme.text }]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  label: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 2, paddingHorizontal: 12, fontSize: 16 },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  notice: { borderLeftWidth: 4, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
});
