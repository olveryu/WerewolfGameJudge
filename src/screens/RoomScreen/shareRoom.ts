/**
 * shareRoom - Pure utility for sharing/copying the room link
 *
 * Web: navigator.share (mobile browsers) → navigator.clipboard fallback
 * Native: React Native Share API
 *
 * ✅ Allowed: browser/RN APIs only
 * ❌ Do NOT: import services, showAlert, navigation
 */
import { Platform, Share } from 'react-native';

/** Build the room URL from the current origin (web) or production URL (native). */
export function buildRoomUrl(roomNumber: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/room/${roomNumber}`;
  }
  return `https://werewolf-judge.vercel.app/room/${roomNumber}`;
}

/** Result of a share/copy attempt. */
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Attempt to share or copy the room link. */
export async function shareOrCopyRoomLink(roomNumber: string): Promise<ShareResult> {
  const url = buildRoomUrl(roomNumber);
  const text = `加入狼人杀房间 ${roomNumber}`;

  // Native: use RN Share API
  if (Platform.OS !== 'web') {
    try {
      const result = await Share.share({ message: `${text}\n${url}`, url });
      // iOS returns 'dismissedAction' when user cancels
      if (result.action === Share.dismissedAction) return 'cancelled';
      return 'shared';
    } catch {
      return 'failed';
    }
  }

  // Web: clipboard first (matches "复制链接" intent), share sheet as fallback
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch {
      // Clipboard blocked (e.g. non-secure context) — fall through to share
    }
  }

  // Fallback: navigator.share (mobile browsers without clipboard access)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: text, url });
      return 'shared';
    } catch {
      // User cancelled share sheet
      return 'cancelled';
    }
  }

  return 'failed';
}
