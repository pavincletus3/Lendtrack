import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { triggerHaptic } from '@/lib/haptics';

interface SwipeNavWrapperProps {
  children: React.ReactNode;
}

/**
 * Wrap a tab screen with this to enable left/right swipe navigation
 * between sibling tabs. Vibrates on switch (respects user setting).
 */
export function SwipeNavWrapper({ children }: SwipeNavWrapperProps) {
  const navigation = useNavigation();
  const state = useNavigationState((s) => s);

  function handleSwipe(direction: 'left' | 'right') {
    if (!state) return;
    const idx = state.index;
    const routes = state.routes;
    const newIdx = direction === 'left' ? idx + 1 : idx - 1;
    if (newIdx >= 0 && newIdx < routes.length) {
      triggerHaptic('light');
      navigation.navigate(routes[newIdx].name as never);
    }
  }

  const gesture = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      const dx = e.translationX;
      const vx = e.velocityX;
      if (Math.abs(dx) > 60 || Math.abs(vx) > 600) {
        handleSwipe(dx < 0 ? 'left' : 'right');
      }
    })
    .runOnJS(true);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}
