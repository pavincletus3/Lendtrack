import { View, Text, TextInput, TouchableOpacity, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Type, Spacing, Radius } from '@/constants/Typography';

interface FieldProps {
  label: string;
  children?: React.ReactNode;
  hint?: string;
  error?: string;
}

export function Field({ label, children, hint, error }: FieldProps) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={[Type.micro, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }]}>
        {label}
      </Text>
      {children}
      {hint && !error ? (
        <Text style={[Type.micro, { color: colors.textMuted, marginTop: 4 }]}>{hint}</Text>
      ) : null}
      {error ? (
        <Text style={[Type.micro, { color: colors.danger, marginTop: 4 }]}>{error}</Text>
      ) : null}
    </View>
  );
}

interface InputProps extends TextInputProps {
  rightIcon?: React.ComponentProps<typeof Ionicons>['name'];
  onRightIconPress?: () => void;
}

export function Input({ rightIcon, onRightIconPress, style, ...rest }: InputProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface }]}>
      <TextInput
        style={[styles.input, { color: colors.text }, style]}
        placeholderTextColor={colors.textMuted}
        {...rest}
      />
      {rightIcon ? (
        <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={rightIcon} size={20} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function PressableField({ value, placeholder, onPress, icon }: {
  value?: string;
  placeholder?: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={[styles.wrap, styles.pressable, { backgroundColor: colors.surface }]} activeOpacity={0.7}>
      <Text style={[Type.body, { color: value ? colors.text : colors.textMuted, flex: 1 }]}>
        {value ?? placeholder}
      </Text>
      {icon ? <Ionicons name={icon} size={18} color={colors.textMuted} /> : null}
    </TouchableOpacity>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segWrap, { backgroundColor: colors.surface }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segBtn, active && { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={[Type.pill, { color: active ? colors.textOnPrimary : colors.textMuted }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
  },
  rightIcon: { paddingLeft: Spacing.sm },
  pressable: { paddingVertical: 14, justifyContent: 'space-between' },
  segWrap: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    padding: 4,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
});
