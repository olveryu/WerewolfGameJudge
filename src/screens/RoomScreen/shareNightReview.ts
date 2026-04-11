/**
 * shareNightReview - Share night review as screenshot image.
 *
 * Capture source is provided by caller (typically a hidden share card view).
 */
import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { log } from '@/utils/logger';

import { shareImageBase64 } from './shareImage';

type ShareNightReviewResult = 'shared' | 'cancelled' | 'failed';

export async function captureNightReviewCard(ref: RefObject<View | null>): Promise<string> {
  if (Platform.OS === 'web') {
    const html2canvas = (await import('html2canvas')).default;
    const node = ref.current as unknown as HTMLElement;
    if (!node) throw new Error('Night review share card ref not ready');
    const canvas = await html2canvas(node, {
      backgroundColor: null,
      // Walk all ancestors in the *cloned* DOM and clear overflow clipping.
      // RN Web sets overflow:hidden on View by default; the RoomScreen container
      // clips the off-screen share card. onclone modifies only the clone.
      onclone: (_doc: Document, clonedEl: HTMLElement) => {
        let el: HTMLElement | null = clonedEl;
        while (el) {
          el.style.overflow = 'visible';
          el = el.parentElement;
        }
      },
    });
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
    log.warn('Share night review failed:', error);
    return 'failed';
  }
}
