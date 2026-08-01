/** Platform-specific room link sharing and clipboard behavior. */

import { Platform, Share } from 'react-native';

import { SITE_URL } from '@/config/api';
import { shareLog } from '@/utils/logger';

export type RoomShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

function isShareCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function buildRoomUrl(roomCode: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/room/${roomCode}`;
  }
  return `${SITE_URL}/room/${roomCode}`;
}

export async function shareOrCopyRoomLink(
  roomCode: string,
  gameDisplayName: string,
): Promise<RoomShareResult> {
  const url = buildRoomUrl(roomCode);
  const text = `加入${gameDisplayName}房间 ${roomCode}`;

  if (Platform.OS !== 'web') {
    try {
      const result = await Share.share({ message: `${text}\n${url}`, url });
      return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
    } catch (error) {
      shareLog.warn('Native room share failed', error);
      return 'failed';
    }
  }

  const isMobile =
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  if (isMobile && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: text, url });
      return 'shared';
    } catch (error) {
      if (isShareCancelled(error)) return 'cancelled';
      shareLog.warn('Mobile web room share failed', error);
      return 'failed';
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch (error) {
      shareLog.warn('Room link clipboard write failed', error);
    }
  }

  if (!isMobile && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: text, url });
      return 'shared';
    } catch (error) {
      if (isShareCancelled(error)) return 'cancelled';
      shareLog.warn('Desktop web room share failed', error);
      return 'failed';
    }
  }

  return 'failed';
}
