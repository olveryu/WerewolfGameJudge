/** Room link sharing: the browser share sheet on touch devices, the clipboard elsewhere. */

import { shareLog } from '@/utils/logger';

import { isShareCancelled } from './shareImage';

export type RoomShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export function buildRoomUrl(roomCode: string): string {
  return `${window.location.origin}/room/${roomCode}`;
}

async function shareLink(title: string, url: string, label: string): Promise<RoomShareResult> {
  try {
    await navigator.share({ title, url });
    return 'shared';
  } catch (error) {
    if (isShareCancelled(error)) return 'cancelled';
    shareLog.warn(`${label} room share failed`, error);
    return 'failed';
  }
}

export async function shareOrCopyRoomLink(
  roomCode: string,
  gameDisplayName: string,
): Promise<RoomShareResult> {
  const url = buildRoomUrl(roomCode);
  const title = `加入${gameDisplayName}房间 ${roomCode}`;
  const canShare = 'share' in navigator;
  const isTouch = navigator.maxTouchPoints > 0;

  if (isTouch && canShare) return shareLink(title, url, 'Mobile');

  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch (error) {
    shareLog.warn('Room link clipboard write failed', error);
  }

  if (!isTouch && canShare) return shareLink(title, url, 'Desktop');
  return 'failed';
}
