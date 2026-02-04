/**
 * Haptics utilities for RoleRevealEffects
 *
 * Handles haptic feedback with graceful degradation.
 */
import { canUseHaptics } from './platform';

// Lazy-load haptics to avoid crashes on web
let Haptics: typeof import('expo-haptics') | null = null;

async function loadHaptics(): Promise<typeof import('expo-haptics') | null> {
  if (!canUseHaptics()) return null;
  if (Haptics) return Haptics;

  try {
    Haptics = await import('expo-haptics');
    return Haptics;
  } catch {
    return null;
  }
}

/**
 * Haptic feedback styles
 */
export type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

/**
 * Trigger haptic feedback
 * Silently fails on platforms without haptic support
 */
export async function triggerHaptic(
  style: HapticStyle,
  enabled: boolean = true
): Promise<void> {
  if (!enabled) return;
  if (!canUseHaptics()) return;

  try {
    const haptics = await loadHaptics();
    if (!haptics) return;

    switch (style) {
      case 'light':
        await haptics.impactAsync(haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await haptics.impactAsync(haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        await haptics.impactAsync(haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'selection':
        await haptics.selectionAsync();
        break;
      case 'success':
        await haptics.notificationAsync(haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        await haptics.notificationAsync(haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        await haptics.notificationAsync(haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // Silent fail - haptics are optional
  }
}

/**
 * Trigger a sequence of haptic feedbacks
 */
export async function triggerHapticSequence(
  styles: HapticStyle[],
  intervalMs: number = 100,
  enabled: boolean = true
): Promise<void> {
  if (!enabled) return;

  for (const style of styles) {
    await triggerHaptic(style, enabled);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
