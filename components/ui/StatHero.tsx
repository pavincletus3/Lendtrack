import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Type, Spacing } from '@/constants/Typography';
import { Card } from './Card';

interface StatHeroProps {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  action?: React.ReactNode;
  accent?: string;
  caption?: string;
}

export function StatHero({ label, value, delta, deltaPositive, action, accent, caption }: StatHeroProps) {
  const { colors } = useTheme();
  return (
    <Card>
      <Text style={[Type.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[Type.heroXL, { color: accent ?? colors.text, marginTop: 4 }]} numberOfLines={1}>
        {value}
      </Text>
      {delta ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm }}>
          <Ionicons
            name={deltaPositive ? 'trending-up' : 'trending-down'}
            size={14}
            color={deltaPositive ? colors.success : colors.danger}
          />
          <Text style={[Type.caption, { color: deltaPositive ? colors.success : colors.danger }]}>
            {delta}
          </Text>
        </View>
      ) : null}
      {caption ? (
        <Text style={[Type.caption, { color: colors.textMuted, marginTop: Spacing.sm }]}>
          {caption}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: Spacing.lg }}>{action}</View> : null}
    </Card>
  );
}
