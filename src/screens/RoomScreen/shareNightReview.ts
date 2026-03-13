/**
 * shareNightReview - Share night review as screenshot image.
 *
 * Capture source is provided by caller (typically a hidden share card view).
 */
import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { shareImageBase64 } from './shareImage';

export type ShareNightReviewResult = 'shared' | 'cancelled' | 'failed';

export async function captureNightReviewCard(ref: RefObject<View | null>): Promise<string> {
  if (Platform.OS === 'web') {
    const html2canvas = (await import('html2canvas')).default;
    const node = ref.current as unknown as HTMLElement;
    if (!node) throw new Error('Night review share card ref not ready');
    const canvas = await html2canvas(node, { backgroundColor: null });
    const dataUrl = canvas.toDataURL('image/png');
    const prefix = 'base64,';
    const idx = dataUrl.indexOf(prefix);
    return idx >= 0 ? dataUrl.slice(idx + prefix.length) : dataUrl;
  }

  return captureRef(ref, { format: 'png', result: 'base64', quality: 1 });
}

function isShareCancelledError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const normalized = `${error.name} ${error.message}`.toLowerCase();
  return (
    normalized.includes('abort') || normalized.includes('cancel') || normalized.includes('dismiss')
  );
}

export async function shareNightReviewReportImage(
  getBase64: () => Promise<string>,
  roomNumber: string,
): Promise<ShareNightReviewResult> {
  try {
    await shareImageBase64(
      getBase64,
      `room-${roomNumber}-review.png`,
      `狼人杀房间 ${roomNumber} 战报`,
    );
    return 'shared';
  } catch (error) {
    if (isShareCancelledError(error)) return 'cancelled';
    return 'failed';
  }
}
