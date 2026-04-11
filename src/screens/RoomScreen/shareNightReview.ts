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

    // Clone the share card and append directly to <body> to escape ancestor
    // overflow:hidden clipping. The original card sits deep in the React tree
    // where RN Web sets overflow:hidden on every View. html2canvas renders in
    // a viewport-sized iframe with scrolling=no, so content taller than the
    // viewport gets clipped if any ancestor clips. Cloning to body avoids this.
    const clone = node.cloneNode(true) as HTMLElement;
    Object.assign(clone.style, { position: 'absolute', left: '-9999px', top: '0px' });
    document.body.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, {
        backgroundColor: null,
        // Ensure html2canvas iframe is tall enough for the full card content
        windowHeight: Math.max(clone.scrollHeight, window.innerHeight),
      });
      const dataUrl = canvas.toDataURL('image/png');
      const prefix = 'base64,';
      const idx = dataUrl.indexOf(prefix);
      return idx >= 0 ? dataUrl.slice(idx + prefix.length) : dataUrl;
    } finally {
      document.body.removeChild(clone);
    }
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
