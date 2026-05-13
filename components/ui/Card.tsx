import { View, StyleSheet, ViewProps, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Radius } from '@/constants/Typography';

interface CardProps extends ViewProps {
  elevated?: boolean;
  padding?: number;
  radius?: number;
}

export function Card({ elevated = true, padding = 20, radius = Radius.xxl, style, children, ...rest }: CardProps) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius,
          padding,
        },
        elevated && !isDark && styles.shadowLight,
        elevated && isDark && styles.shadowDark,
        style as ViewStyle,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shadowLight: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  shadowDark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
});
