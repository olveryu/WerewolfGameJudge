/**
 * shareNightReview - Share/copy night review report text directly.
 *
 * Native: React Native Share API.
 * Web mobile: navigator.share.
 * Web desktop/fallback: clipboard copy.
 */
import { Platform, Share } from 'react-native';

import type { NightReviewData } from './NightReview.helpers';

export type ShareNightReviewResult = 'shared' | 'copied' | 'cancelled' | 'failed';

function buildNightReviewText(roomNumber: string, data: NightReviewData): string {
  const actionLines = data.actionLines.length > 0 ? data.actionLines.join('\n') : '暂无数据';
  const identityLines = data.identityLines.length > 0 ? data.identityLines.join('\n') : '暂无数据';

  return [
    `狼人杀房间 ${roomNumber} 战报`,
    '',
    '【行动摘要】',
    actionLines,
    '',
    '【全员身份】',
    identityLines,
  ].join('\n');
}

export async function shareNightReviewReport(
  roomNumber: string,
  data: NightReviewData,
): Promise<ShareNightReviewResult> {
  const title = `房间 ${roomNumber} 战报`;
  const text = buildNightReviewText(roomNumber, data);

  if (Platform.OS !== 'web') {
    try {
      const result = await Share.share({ title, message: text });
      if (result.action === Share.dismissedAction) return 'cancelled';
      return 'shared';
    } catch {
      return 'failed';
    }
  }

  const isMobile =
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  if (isMobile && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // fall through
    }
  }

  if (!isMobile && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }

  return 'failed';
}
