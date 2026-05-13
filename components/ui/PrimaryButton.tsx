import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Type, Radius, Spacing } from '@/constants/Typography';

interface PrimaryButtonProps {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  variant = 'primary',
  size = 'md',
  fullWidth,
}: PrimaryButtonProps) {
  const { colors } = useTheme();

  const palette = {
    primary: { bg: colors.primary, fg: colors.textOnPrimary, border: 'transparent' },
    secondary: { bg: colors.surface, fg: colors.text, border: 'transparent' },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.border },
    danger: { bg: colors.dangerTint, fg: colors.danger, border: 'transparent' },
  }[variant];

  const padY = size === 'sm' ? 10 : size === 'lg' ? 18 : 14;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 15;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || loading}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderWidth: variant === 'ghost' ? 1 : 0,
        paddingVertical: padY,
        paddingHorizontal: Spacing.xl,
        borderRadius: Radius.pill,
        gap: Spacing.sm,
        opacity: disabled ? 0.5 : 1,
        alignSelf: fullWidth ? 'stretch' : 'auto',
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={fontSize + 3} color={palette.fg} /> : null}
          <Text style={[Type.bodyBold, { color: palette.fg, fontSize }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
