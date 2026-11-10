/**
 * captureElementPng: band planning, and the banded capture that rasterizes one SnapDOM clone
 * band by band, stitches the bands at device-pixel offsets and reports band progress.
 */
import { snapdom } from '@zumer/snapdom';

import {
  captureElementSegmentedPngBase64,
  planCaptureBands,
  SEGMENTED_CAPTURE_BAND_HEIGHT_PX,
} from '../captureElementPng';

vi.mock('@zumer/snapdom', () => ({ snapdom: vi.fn() }));

describe('planCaptureBands', () => {
  it('splits a height into full bands plus a short final band', () => {
    expect(planCaptureBands(2500, 1024)).toEqual([
      { y: 0, height: 1024 },
      { y: 1024, height: 1024 },
      { y: 2048, height: 452 },
    ]);
  });

  it('returns one band when the height fits a single band', () => {
    expect(planCaptureBands(600, 1024)).toEqual([{ y: 0, height: 600 }]);
  });

  it('rejects non-positive heights', () => {
    expect(() => planCaptureBands(0, 1024)).toThrow('positive element height');
    expect(() => planCaptureBands(100, 0)).toThrow('band height must be positive');
  });
});

describe('captureElementSegmentedPngBase64', () => {
  function bandCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  it('rasterizes each band from one capture, stitches at scaled offsets and reports progress', async () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const drawImage = vi.fn<(image: CanvasImageSource, x: number, y: number) => void>();
    // jsdom has no 2D context; the stitch only draws bands.
    const context2d = { drawImage } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((contextId: string) =>
      contextId === '2d' ? context2d : null) as HTMLCanvasElement['getContext']);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,QQ');
    const toCanvas = vi.fn(async (options: { crop: { height: number } }) =>
      bandCanvas(800, options.crop.height * 2),
    );
    const totalHeight = SEGMENTED_CAPTURE_BAND_HEIGHT_PX + 200;
    vi.mocked(snapdom).mockResolvedValue({
      meta: { contentX: 3, contentY: 5, w0: 400, h0: totalHeight },
      toCanvas,
    } as unknown as Awaited<ReturnType<typeof snapdom>>);
    const progress: [number, number][] = [];

    const base64 = await captureElementSegmentedPngBase64(
      document.createElement('div'),
      (done, total) => progress.push([done, total]),
    );

    expect(base64).toBe('QQ');
    expect(snapdom).toHaveBeenCalledTimes(1);
    expect(toCanvas.mock.calls.map(([options]) => options)).toEqual([
      { dpr: 2, crop: { x: 3, y: 5, width: 400, height: SEGMENTED_CAPTURE_BAND_HEIGHT_PX } },
      { dpr: 2, crop: { x: 3, y: 5 + SEGMENTED_CAPTURE_BAND_HEIGHT_PX, width: 400, height: 200 } },
    ]);
    expect(drawImage.mock.calls.map(([, x, y]) => [x, y])).toEqual([
      [0, 0],
      [0, SEGMENTED_CAPTURE_BAND_HEIGHT_PX * 2],
    ]);
    expect(progress).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
