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

/** Attempt to share or copy the room link. Returns true on success. */
export async function shareOrCopyRoomLink(roomNumber: string): Promise<boolean> {
  const url = buildRoomUrl(roomNumber);
  const text = `加入狼人杀房间 ${roomNumber}`;

  // Native: use RN Share API
  if (Platform.OS !== 'web') {
    try {
      await Share.share({ message: `${text}\n${url}`, url });
      return true;
    } catch {
      return false;
    }
  }

  // Web: try navigator.share first (mobile browsers), then clipboard fallback
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: text, url });
      return true;
    } catch {
      // User cancelled share sheet — not an error
      return true;
    }
  }

  // Clipboard fallback
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
