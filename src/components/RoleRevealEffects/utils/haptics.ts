/**
 * haptics - 揭示动画触觉反馈工具
 *
 * 惰性加载 expo-haptics，Web 端优雅降级。
 * 提供触觉反馈 IO。不 import service，不含游戏业务逻辑。
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
export type HapticStyle =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

/**
 * Trigger haptic feedback
 * Silently fails on platforms without haptic support
 */
export async function triggerHaptic(style: HapticStyle, enabled: boolean = true): Promise<void> {
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
