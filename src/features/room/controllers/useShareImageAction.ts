/**
 * useShareImageAction — the one image-share action every game shares
 * captured views through.
 *
 * `share` runs `shareImagesBase64` single-flight: a second call while one
 * is in flight throws (the button is disabled by `isSharing`, so a
 * re-entry is a wiring bug). The platform result (`'shared'` /
 * `'cancelled'`) is returned as-is; a failure goes through the error
 * pipeline with the caller's label and Chinese alert and resolves
 * `'failed'`, so callers never catch.
 */

import { useCallback, useRef, useState } from 'react';

import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import {
  type ShareImageResult,
  shareImagesBase64,
  type ShareImageSource,
} from '../services/shareImage';

export type ShareImageActionResult = ShareImageResult | 'failed';

export interface ShareImageActionOptions {
  /** Error-pipeline label, e.g. '分享故事图片'. */
  readonly label: string;
  /** Chinese alert shown when sharing fails. */
  readonly alertMessage: string;
}

export interface ShareImageAction {
  readonly isSharing: boolean;
  readonly share: (
    images: readonly ShareImageSource[],
    title: string,
  ) => Promise<ShareImageActionResult>;
}

export function useShareImageAction({
  label,
  alertMessage,
}: ShareImageActionOptions): ShareImageAction {
  const [isSharing, setIsSharing] = useState(false);
  const inFlightRef = useRef(false);

  const share = useCallback(
    async (images: readonly ShareImageSource[], title: string): Promise<ShareImageActionResult> => {
      if (inFlightRef.current) {
        throw new Error(`[FAIL-FAST] ${label} is already in progress`);
      }
      inFlightRef.current = true;
      setIsSharing(true);
      try {
        return await shareImagesBase64(images, title);
      } catch (error) {
        handleError(error, { label, logger: roomScreenLog, alertMessage });
        return 'failed';
      } finally {
        inFlightRef.current = false;
        setIsSharing(false);
      }
    },
    [label, alertMessage],
  );

  return { isSharing, share };
}
