/**
 * Capture a mounted element as raw PNG base64 with SnapDOM.
 *
 * The element is cloned once; rasterization either covers the whole element or
 * runs band by band and is stitched into one canvas. The mini-program web-view
 * overflows on one tall raster, so it uses bands; whether bands are still needed
 * with SnapDOM is a P3 real-device check (docs/web-client-rewrite.md §5.8).
 */

import { snapdom } from '@zumer/snapdom';

/**
 * Height of one rasterized band in CSS pixels: far below the mini-program
 * web-view failure while a report card still spans only a few bands.
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

const BASE64_MARKER = 'base64,';

function canvasToPngBase64(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL('image/png');
  const markerIndex = dataUrl.indexOf(BASE64_MARKER);
  if (markerIndex < 0) throw new Error('[FAIL-FAST] Canvas did not encode a base64 data URL');
  return dataUrl.slice(markerIndex + BASE64_MARKER.length);
}

/** Split a total height into consecutive bands of at most `bandHeightPx`. */
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

/** Captures the whole element at the device pixel ratio. */
export async function captureElementPngBase64(element: HTMLElement): Promise<string> {
  return canvasToPngBase64(await snapdom.toCanvas(element, { dpr: devicePixelRatio }));
}

/**
 * Captures the element band by band and stitches the bands into one PNG.
 * `onProgress` reports (0, total) once bands are planned and (total, total) on success.
 */
export async function captureElementSegmentedPngBase64(
  element: HTMLElement,
  onProgress: (done: number, total: number) => void,
): Promise<string> {
  const capture = await snapdom(element);
  const { contentX, contentY, w0, h0 } = capture.meta;
  const bands = planCaptureBands(h0, SEGMENTED_CAPTURE_BAND_HEIGHT_PX);
  const scale = devicePixelRatio;
  const stitched = document.createElement('canvas');
  stitched.width = Math.round(w0 * scale);
  stitched.height = Math.round(h0 * scale);
  const context = stitched.getContext('2d');
  if (context === null) {
    throw new Error('[FAIL-FAST] Canvas 2D context is unavailable for segmented capture');
  }
  onProgress(0, bands.length);
  for (const [index, band] of bands.entries()) {
    const bandCanvas = await capture.toCanvas({
      dpr: scale,
      crop: { x: contentX, y: contentY + band.y, width: w0, height: band.height },
    });
    if (bandCanvas.width <= 0 || bandCanvas.height <= 0) {
      throw new Error('[FAIL-FAST] Segmented capture produced an empty band');
    }
    context.drawImage(bandCanvas, 0, Math.round(band.y * scale));
    onProgress(index + 1, bands.length);
  }
  return canvasToPngBase64(stitched);
}
