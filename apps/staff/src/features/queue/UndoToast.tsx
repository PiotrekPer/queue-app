/**
 * UndoToast — the 5s „Cofnij" affordance shown after every staff mutation (§5,
 * §9.3A "Every action → toast with Cofnij (5s)"). Undo is a compensating
 * transition off the effect log, driven by the store's undoLast().
 *
 * Controlled: the rail bumps `nonce` after each mutation; the toast re-arms its
 * 5s timer and auto-dismisses. Reduce Motion: the entrance still uses a short
 * fade (no translation) via reanimated's layout defaults being avoided — we keep
 * it to opacity only, which is safe.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { darkTheme } from '@/lib/theme';

const VISIBLE_MS = 5000;

interface UndoToastProps {
  /** changes each time a new undoable mutation happens; 0 = nothing yet */
  nonce: number;
  /** human label of the action just performed (e.g. „Posadzono Ania") */
  message: string;
  onUndo: () => void;
}

export function UndoToast({ nonce, message, onUndo }: UndoToastProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    if (nonce <= 0) return;
    setShown(true);
    opacity.value = withTiming(1, { duration: 160 });
    translateY.value = reduceMotion ? 0 : withTiming(0, { duration: 160 });

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 160 });
      setShown(false);
    }, VISIBLE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // re-arm whenever a new mutation fires
  }, [nonce, opacity, translateY, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!shown) return null;

  const handleUndo = () => {
    if (timer.current) clearTimeout(timer.current);
    opacity.value = withTiming(0, { duration: 120 });
    setShown(false);
    onUndo();
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[style, { bottom: insets.bottom + 12 }]}
      className="absolute left-4 right-4"
    >
      <View
        className="flex-row items-center justify-between rounded-control px-4 py-3"
        style={{
          backgroundColor: darkTheme.cardElevated,
          borderColor: darkTheme.hairline,
          borderWidth: 1,
        }}
      >
        <Text className="mr-3 flex-1 font-ui text-body text-steam" numberOfLines={1}>
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={handleUndo}
          hitSlop={8}
          className="active:opacity-70"
        >
          <Text
            className="font-ui text-body"
            style={{ color: darkTheme.status.ready, fontWeight: '600' }}
          >
            {t('common.undo')}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
