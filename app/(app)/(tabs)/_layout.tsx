import { useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type {
  MaterialTopTabBarProps,
  MaterialTopTabNavigationEventMap,
  MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { triggerHaptic } from '@/lib/haptics';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

const TAB_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  dashboard: 'home',
  borrowers: 'people',
  monthly: 'calendar',
  settings: 'settings-sharp',
};

function FloatingTabBar({ state, navigation }: MaterialTopTabBarProps) {
  const { colors, isDark } = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.barWrap, { bottom: Math.max(bottom, 12) }]}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: isDark ? '#16161B' : '#FFFFFF',
            shadowColor: isDark ? '#000' : '#0F172A',
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const onPress = () => {
            if (!focused) navigation.navigate(route.name);
          };
          const icon = TAB_ICONS[route.name] ?? 'ellipse';
          return (
            <TouchableOpacity key={route.key} onPress={onPress} activeOpacity={0.8} style={styles.btn}>
              <View
                style={[
                  focused ? styles.dotActive : styles.dotInactive,
                  {
                    backgroundColor: focused
                      ? colors.primary
                      : isDark
                      ? '#27272A'
                      : '#F1F5F9',
                  },
                ]}
              >
                <Ionicons
                  name={icon}
                  size={focused ? 26 : 18}
                  color={focused ? colors.textOnPrimary : colors.tabIconDefault}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const lastIndex = useRef(0);

  return (
    <MaterialTopTabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        lazy: false,
      }}
      screenListeners={{
        state: (e) => {
          const idx = (e.data as any)?.state?.index;
          if (typeof idx === 'number' && idx !== lastIndex.current) {
            lastIndex.current = idx;
            triggerHaptic('light');
          }
        },
      }}
    >
      <MaterialTopTabs.Screen name="dashboard" options={{ title: t('dashboard.title') }} />
      <MaterialTopTabs.Screen name="borrowers" options={{ title: t('borrowers.title') }} />
      <MaterialTopTabs.Screen name="monthly" options={{ title: t('monthly.title') }} />
      <MaterialTopTabs.Screen name="settings" options={{ title: t('settings.title') }} />
    </MaterialTopTabs>
  );
}

const styles = StyleSheet.create({
  barWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 4,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
    ...(Platform.OS === 'android' && { paddingVertical: 8 }),
  },
  btn: { paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  dotInactive: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
