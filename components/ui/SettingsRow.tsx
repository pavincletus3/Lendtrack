import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Type, Spacing, Radius } from '@/constants/Typography';

interface SettingsRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg?: string;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
  compact?: boolean;
}

export function SettingsRow({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  onPress,
  right,
  destructive,
  compact,
}: SettingsRowProps) {
  const { colors } = useTheme();
  const labelColor = destructive ? colors.danger : colors.text;
  const finalIconBg = iconBg ?? (destructive ? colors.dangerTint : colors.surface);
  const finalIconColor = iconColor ?? (destructive ? colors.danger : colors.text);

  const iconSize = compact ? 32 : 40;
  const iconRadius = compact ? 10 : Radius.md;
  const iconGlyph = compact ? 16 : 20;
  const padY = compact ? 8 : 14;
  const labelStyle = compact ? Type.body : Type.bodyBold;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: padY, gap: Spacing.sm }}
    >
      <View style={{
        width: iconSize, height: iconSize, borderRadius: iconRadius,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: finalIconBg,
      }}>
        <Ionicons name={icon} size={iconGlyph} color={finalIconColor} />
      </View>
      <Text style={[labelStyle, { color: labelColor, flex: 1 }]}>{label}</Text>
      {right ?? (
        <>
          {value ? (
            <Text style={[Type.caption, { color: colors.textMuted, marginRight: 4 }]}>{value}</Text>
          ) : null}
          {onPress && !destructive ? (
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
}
