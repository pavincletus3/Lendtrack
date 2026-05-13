import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, Radius } from '@/constants/Typography';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Pulsing block used to suggest loading content. */
export function Skeleton({ width = '100%', height = 14, radius = 6, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.surface, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonRow() {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Skeleton width={44} height={44} radius={22} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width={'60%'} height={14} />
        <Skeleton width={'40%'} height={11} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Skeleton width={64} height={14} />
        <Skeleton width={40} height={11} />
      </View>
      <View style={{ width: 1, height: 1, backgroundColor: colors.border }} />
    </View>
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
});
