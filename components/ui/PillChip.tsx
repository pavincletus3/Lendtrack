import { TouchableOpacity, Text } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Type, Radius, Spacing } from '@/constants/Typography';

interface PillChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'primary' | 'neutral';
}

export function PillChip({ label, active, onPress, tone = 'neutral' }: PillChipProps) {
  const { colors } = useTheme();
  const activeBg = tone === 'primary' ? colors.primary : colors.text;
  const activeFg = tone === 'primary' ? colors.textOnPrimary : colors.background;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        paddingHorizontal: Spacing.lg,
        paddingVertical: 8,
        borderRadius: Radius.pill,
        backgroundColor: active ? activeBg : colors.surface,
      }}
    >
      <Text style={[Type.pill, { color: active ? activeFg : colors.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}
