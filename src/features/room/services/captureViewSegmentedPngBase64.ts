/** Capture a tall Web view as stacked horizontal bands stitched into one PNG base64. */

import type { RefObject } from 'react';
import { Platform } from 'react-native';

import { captureViewPngBase64, parseBase64DataUrl } from './captureViewPngBase64';
import { loadHtml2canvas } from './loadHtml2canvas';

/**
 * Height of one rendered band in CSS pixels. A whole-element html2canvas render
 * of a tall card is what overflows in the mini-program web-view; each band stays
 * far below that failure while a report card still spans only a few bands.
 */
export const SEGMENTED_CAPTURE_BAND_HEIGHT_PX = 1024;

export interface CaptureBand {
  readonly y: number;
  readonly height: number;
}

/** Band-count progress of one capture: `done` of `total` bands are rendered. */
export interface CaptureProgress {
  readonly done: number;
  readonly total: number;
}

/**
 * Reports capture progress as (done, total) band counts. The sequence always
 * starts at (0, total) once bands are planned and ends at (total, total) on
 * success; a failed capture never reports completion.
 */
export type CaptureProgressCallback = (done: number, total: number) => void;

export interface SegmentedCaptureOptions {
  readonly onProgress?: CaptureProgressCallback;
}

/** Split a total height into consecutive bands of at most bandHeightPx. */
export function planCaptureBands(totalHeightPx: number, bandHeightPx: number): CaptureBand[] {
  if (totalHeightPx <= 0) {
    throw new Error('[FAIL-FAST] Segmented capture needs a positive element height');
  }
  if (bandHeightPx <= 0) {
    throw new Error('[FAIL-FAST] Segmented capture band height must be positive');
  }
  const bands: CaptureBand[] = [];
  for (let y = 0; y < totalHeightPx; y += bandHeightPx) {
    bands.push({ y, height: Math.min(bandHeightPx, totalHeightPx - y) });
  }
  return bands;
}

/**
 * Capture a mounted Web view band by band and stitch the bands into one PNG.
 * @remarks Web-only mechanism: native capture has no overflow failure, so
 * non-Web platforms delegate to the whole-view capture unchanged; that path
 * reports progress as a single indivisible band, (0, 1) then (1, 1).
 */
export async function captureViewSegmentedPngBase64(
  ref: RefObject<unknown>,
  options?: SegmentedCaptureOptions,
): Promise<string> {
  if (ref.current === null) {
    throw new Error('[FAIL-FAST] Capture view ref is not mounted');
  }
  const onProgress = options?.onProgress;
  if (Platform.OS !== 'web') {
    onProgress?.(0, 1);
    const base64 = await captureViewPngBase64(ref);
    onProgress?.(1, 1);
    return base64;
  }
  if (typeof HTMLElement === 'undefined' || !(ref.current instanceof HTMLElement)) {
    throw new Error('[FAIL-FAST] Capture view ref must resolve to an HTMLElement on Web');
  }

  const element = ref.current;
  const totalWidth = element.scrollWidth;
  const totalHeight = element.scrollHeight;
  const bands = planCaptureBands(totalHeight, SEGMENTED_CAPTURE_BAND_HEIGHT_PX);
  const scale = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1;

  const stitched = document.createElement('canvas');
  stitched.width = Math.round(totalWidth * scale);
  stitched.height = Math.round(totalHeight * scale);
  const ctx = stitched.getContext('2d');
  if (ctx === null) {
    throw new Error('[FAIL-FAST] Canvas 2D context is unavailable for segmented capture');
  }

  const html2canvas = await loadHtml2canvas();
  onProgress?.(0, bands.length);
  let doneBands = 0;
  for (const band of bands) {
    const bandCanvas = await html2canvas(element, {
      backgroundColor: null,
      ignoreElements: (node) => node.tagName === 'IMG' && !element.contains(node),
      y: band.y,
      height: band.height,
      scale,
    });
    if (bandCanvas.width <= 0 || bandCanvas.height <= 0) {
      throw new Error('[FAIL-FAST] Segmented capture produced an empty band');
    }
    ctx.drawImage(bandCanvas, 0, Math.round(band.y * scale));
    doneBands += 1;
    onProgress?.(doneBands, bands.length);
  }
  return parseBase64DataUrl(stitched.toDataURL('image/png'));
}
