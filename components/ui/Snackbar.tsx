import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useUiStore } from '@/store/uiStore';
import { Type, Spacing, Radius } from '@/constants/Typography';

export function Snackbar() {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const snackbar = useUiStore((s) => s.snackbar);
  const translate = useRef(new Animated.Value(120)).current;

  const visible = !!snackbar;

  useEffect(() => {
    Animated.timing(translate, {
      toValue: visible ? 0 : 120,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, translate]);

  if (!snackbar) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom: Math.max(bottom, 12) + 88, transform: [{ translateY: translate }] },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: colors.primary }]}>
        <Text style={[Type.bodyBold, { color: colors.textOnPrimary, flex: 1 }]} numberOfLines={2}>
          {snackbar.message}
        </Text>
        {snackbar.actionLabel && snackbar.onAction ? (
          <TouchableOpacity
            onPress={snackbar.onAction}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[Type.pill, { color: colors.textOnPrimary, letterSpacing: 1 }]}>
              {snackbar.actionLabel.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'stretch',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
});
