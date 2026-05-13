import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Type, Spacing } from '@/constants/Typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PageHeaderProps {
  title: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
  subtitle?: string;
}

export function PageHeader({ title, right, left, subtitle }: PageHeaderProps) {
  const { colors } = useTheme();
  const { top } = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: top + Spacing.sm }]}>
      <View style={styles.row}>
        <View style={styles.titleWrap}>
          {left ? <View style={styles.left}>{left}</View> : null}
          <Text style={[Type.titleLg, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {subtitle ? (
        <Text style={[Type.caption, { color: colors.textMuted, marginTop: 4 }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  left: { marginRight: 4 },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
