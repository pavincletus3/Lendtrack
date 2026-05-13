import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Type, Spacing } from '@/constants/Typography';
import { AvatarCircle } from './AvatarCircle';

interface ListRowProps {
  name: string;
  sublabel?: string;
  amount?: string;
  amountSub?: string;
  amountColor?: string;
  right?: React.ReactNode;
  leading?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  showChevron?: boolean;
}

export function ListRow({
  name,
  sublabel,
  amount,
  amountSub,
  amountColor,
  right,
  leading,
  onPress,
  onLongPress,
  showChevron,
}: ListRowProps) {
  const { colors } = useTheme();
  const Wrap: any = onPress || onLongPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} onLongPress={onLongPress} delayLongPress={400} activeOpacity={0.7} style={styles.row}>
      {leading ?? <AvatarCircle name={name} />}
      <View style={styles.meta}>
        <Text style={[Type.bodyBold, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        {sublabel ? (
          <Text style={[Type.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {right ?? (
        <View style={styles.amount}>
          {amount ? (
            <Text style={[Type.bodyBold, { color: amountColor ?? colors.text }]}>{amount}</Text>
          ) : null}
          {amountSub ? (
            <Text style={[Type.micro, { color: colors.textMuted, marginTop: 2 }]}>{amountSub}</Text>
          ) : null}
        </View>
      )}
      {showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 4 }} />
      ) : null}
    </Wrap>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  meta: { flex: 1 },
  amount: { alignItems: 'flex-end' },
});
