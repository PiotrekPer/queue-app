/**
 * SwipeableTicketCard — the tactile layer over TicketCard (§9.3A).
 *
 *  - Swipe RIGHT  → reveals a full-height ready-fill „Posadź" zone (chair glyph);
 *                   past the threshold the card does a 240ms "tear-off"
 *                   (translateX off-screen + fade) then applyIntent('seat').
 *  - Swipe LEFT   → reveals „Pomiń" / „Usuń" (skip / staff_remove).
 *
 * Reduce Motion: skip the tear-off animation and fire the intent immediately.
 * The whole gesture layer is disabled for the hold-expired card (it owns the rail
 * with its 3-button decision row) to avoid a conflicting swipe.
 */
import { useCallback } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import type { TransitionIntent, Visit } from '@stoliq/core';
import { darkTheme } from '@/lib/theme';
import { TicketCard, isHoldExpired } from './TicketCard';

interface SwipeableTicketCardProps {
  visit: Visit;
  nowMs: number;
  holdMinutes: number;
  onIntent: (visitId: string, intent: TransitionIntent) => void;
}

/** px the finger must travel to commit the seat / reveal the left actions. */
const SEAT_THRESHOLD = 96;
const LEFT_REVEAL = 168;
const TEAR_OFF_MS = 240;

function ChairGlyph({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 3v8h12V3h2v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3h2Zm-1 12h2l.6 6H5.4L5 15Zm12 0h2l-.4 6h-2.2l.6-6Z"
        fill={color}
      />
    </Svg>
  );
}

export function SwipeableTicketCard({
  visit,
  nowMs,
  holdMinutes,
  onIntent,
}: SwipeableTicketCardProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const expired = isHoldExpired(visit, nowMs);

  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const commitSeat = useCallback(() => {
    onIntent(visit.id, 'seat');
  }, [onIntent, visit.id]);

  const fireIntent = useCallback(
    (intent: TransitionIntent) => {
      onIntent(visit.id, intent);
    },
    [onIntent, visit.id],
  );

  const tearOffThenSeat = useCallback(() => {
    if (reduceMotion) {
      commitSeat();
      return;
    }
    opacity.value = withTiming(0, { duration: TEAR_OFF_MS });
    translateX.value = withTiming(width, { duration: TEAR_OFF_MS }, (finished) => {
      if (finished) runOnJS(commitSeat)();
    });
  }, [commitSeat, opacity, reduceMotion, translateX, width]);

  const pan = Gesture.Pan()
    .enabled(!expired)
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      // clamp left reveal; allow right to run free (it becomes the tear-off)
      translateX.value = Math.max(e.translationX, -LEFT_REVEAL);
    })
    .onEnd((e) => {
      if (e.translationX > SEAT_THRESHOLD) {
        runOnJS(tearOffThenSeat)();
      } else if (e.translationX < -SEAT_THRESHOLD) {
        // snap open to the left action zone (buttons handle the intent on tap)
        translateX.value = withTiming(-LEFT_REVEAL, { duration: 160 });
      } else {
        translateX.value = withTiming(0, { duration: 160 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  // Right-swipe "Posadź" backdrop: fades in as the card slides right.
  const seatZoneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SEAT_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const resetSwipe = useCallback(() => {
    translateX.value = withTiming(0, { duration: 160 });
  }, [translateX]);

  const onLeftAction = useCallback(
    (intent: TransitionIntent) => {
      resetSwipe();
      fireIntent(intent);
    },
    [fireIntent, resetSwipe],
  );

  return (
    <View className="rounded-card">
      {/* Underlay: right = Posadź zone, left = Pomiń / Usuń */}
      <View className="absolute inset-0 flex-row overflow-hidden rounded-card">
        {/* seat zone (revealed on right swipe) */}
        <Animated.View
          style={seatZoneStyle}
          className="flex-1 flex-row items-center rounded-card bg-ready-fill pl-5"
        >
          <ChairGlyph color={darkTheme.background} />
          <Text
            className="ml-2 font-ui text-body text-espresso"
            style={{ fontWeight: '600' }}
          >
            {t('staff.actionSeat')}
          </Text>
        </Animated.View>

        {/* left actions (revealed on left swipe) */}
        <View className="flex-row items-stretch">
          <LeftAction
            label={t('staff.actionSkip')}
            bg={darkTheme.cardElevated}
            fg={darkTheme.text}
            onPress={() => onLeftAction('skip')}
          />
          <LeftAction
            label={t('staff.actionRemove')}
            bg={darkTheme.status.danger}
            fg={darkTheme.background}
            onPress={() => onLeftAction('staff_remove')}
          />
        </View>
      </View>

      {/* Foreground card */}
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          <TicketCard
            visit={visit}
            nowMs={nowMs}
            holdMinutes={holdMinutes}
            onIntent={onIntent}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function LeftAction({
  label,
  bg,
  fg,
  onPress,
}: {
  label: string;
  bg: string;
  fg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="items-center justify-center self-stretch active:opacity-80"
      style={{ backgroundColor: bg, width: 84 }}
    >
      <Text className="font-ui text-small" style={{ color: fg, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}
