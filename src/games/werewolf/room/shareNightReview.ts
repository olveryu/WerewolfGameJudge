/**
 * shareNightReview - Share night review as screenshot image.
 *
 * Capture source is provided by caller (typically a hidden share card view).
 * Every platform shares the same segmented screenshot of the report card;
 * there is no hand-drawn rendering path.
 */
import type { RefObject } from 'react';
import type { View } from 'react-native';

import { captureViewPngBase64 } from '@/features/room/services/captureViewPngBase64';
import {
  type CaptureProgressCallback,
  captureViewSegmentedPngBase64,
} from '@/features/room/services/captureViewSegmentedPngBase64';
import { shareImageBase64 } from '@/features/room/services/shareImage';
import { log } from '@/utils/logger';

type ShareNightReviewResult = 'shared' | 'cancelled' | 'failed';

export async function captureNightReviewCard(ref: RefObject<View | null>): Promise<string> {
  return captureViewPngBase64(ref);
}

export async function captureNightReviewCardSegmented(
  ref: RefObject<View | null>,
  onProgress?: CaptureProgressCallback,
): Promise<string> {
  return captureViewSegmentedPngBase64(ref, { onProgress });
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
  roomCode: string,
): Promise<ShareNightReviewResult> {
  try {
    await shareImageBase64(getBase64, `room-${roomCode}-review.png`, `狼人杀房间 ${roomCode} 战报`);
    return 'shared';
  } catch (error) {
    if (isShareCancelledError(error)) return 'cancelled';
    log.warn('Share night review failed', error);
    return 'failed';
  }
}
