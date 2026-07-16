/**
 * Haptics map (§9.3): add=light · seat=success · guest on_way=medium ·
 * hold expired=warning · undo=selection. Driven by the state machine's
 * `TransitionEffect.haptic`, so the feel always matches the action. Never more.
 */
import type { Haptic } from '@stoliq/core';
import * as Haptics from 'expo-haptics';

export async function fireHaptic(h: Haptic | null): Promise<void> {
  switch (h) {
    case 'light':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'medium':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'selection':
      return Haptics.selectionAsync();
    default:
      return;
  }
}
