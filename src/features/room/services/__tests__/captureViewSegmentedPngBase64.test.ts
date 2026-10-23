/** @jest-environment jsdom */

import type html2canvas from 'html2canvas';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import {
  captureViewSegmentedPngBase64,
  planCaptureBands,
  SEGMENTED_CAPTURE_BAND_HEIGHT_PX,
} from '../captureViewSegmentedPngBase64';
import { loadHtml2canvas } from '../loadHtml2canvas';

jest.mock('../loadHtml2canvas', () => ({
  loadHtml2canvas: jest.fn(),
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
}));

const mockLoadHtml2canvas = jest.mocked(loadHtml2canvas);
const mockHtml2canvas = jest.fn<ReturnType<typeof html2canvas>, Parameters<typeof html2canvas>>();
const mockCaptureRef = jest.mocked(captureRef);
const originalPlatformOS = Platform.OS;

const drawImage = jest.fn<void, [CanvasImageSource, number, number]>();
let stitchedSize: { width: number; height: number } | null = null;

function setPlatformOS(os: typeof Platform.OS): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

function makeElement(width: number, height: number): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'scrollWidth', { value: width, configurable: true });
  Object.defineProperty(element, 'scrollHeight', { value: height, configurable: true });
  return element;
}

beforeEach(() => {
  stitchedSize = null;
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({
    drawImage,
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext);
  jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    stitchedSize = { width: this.width, height: this.height };
    return 'data:image/png;base64,stitched';
  });
  mockHtml2canvas.mockImplementation(async (element, options) => {
    const canvas = document.createElement('canvas');
    const scale = options?.scale ?? 1;
    canvas.width = Math.round(element.scrollWidth * scale);
    canvas.height = Math.round((options?.height ?? 0) * scale);
    return canvas;
  });
  mockLoadHtml2canvas.mockResolvedValue(mockHtml2canvas);
});

afterEach(() => {
  setPlatformOS(originalPlatformOS);
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('planCaptureBands', () => {
  it('splits a height into full bands plus a short final band', () => {
    expect(planCaptureBands(2500, SEGMENTED_CAPTURE_BAND_HEIGHT_PX)).toEqual([
      { y: 0, height: 1024 },
      { y: 1024, height: 1024 },
      { y: 2048, height: 452 },
    ]);
  });

  it('returns exact bands when the height divides evenly', () => {
    expect(planCaptureBands(2048, SEGMENTED_CAPTURE_BAND_HEIGHT_PX)).toEqual([
      { y: 0, height: 1024 },
      { y: 1024, height: 1024 },
    ]);
  });

  it('returns one band when the height fits inside a single band', () => {
    expect(planCaptureBands(300, SEGMENTED_CAPTURE_BAND_HEIGHT_PX)).toEqual([
      { y: 0, height: 300 },
    ]);
  });

  it('rejects a non-positive total height', () => {
    expect(() => planCaptureBands(0, SEGMENTED_CAPTURE_BAND_HEIGHT_PX)).toThrow(
      '[FAIL-FAST] Segmented capture needs a positive element height',
    );
  });

  it('rejects a non-positive band height', () => {
    expect(() => planCaptureBands(100, 0)).toThrow(
      '[FAIL-FAST] Segmented capture band height must be positive',
    );
  });
});

describe('captureViewSegmentedPngBase64', () => {
  it('renders each band with its crop offset and stitches them at scaled offsets', async () => {
    setPlatformOS('web');
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    const element = makeElement(400, 2500);

    await expect(captureViewSegmentedPngBase64({ current: element })).resolves.toBe('stitched');

    expect(mockHtml2canvas).toHaveBeenCalledTimes(3);
    expect(mockHtml2canvas.mock.calls.map((call) => call[1])).toEqual([
      expect.objectContaining({ y: 0, height: 1024, scale: 2 }),
      expect.objectContaining({ y: 1024, height: 1024, scale: 2 }),
      expect.objectContaining({ y: 2048, height: 452, scale: 2 }),
    ]);
    expect(drawImage).toHaveBeenCalledTimes(3);
    expect(drawImage.mock.calls.map((call) => [call[1], call[2]])).toEqual([
      [0, 0],
      [0, 2048],
      [0, 4096],
    ]);
    expect(stitchedSize).toEqual({ width: 800, height: 5000 });
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  });

  it('excludes unrelated images before cloning, like the whole-view capture', async () => {
    setPlatformOS('web');
    const element = makeElement(400, 300);
    const image = document.createElement('img');
    element.appendChild(image);

    await captureViewSegmentedPngBase64({ current: element });

    const options = mockHtml2canvas.mock.calls[0]![1]!;
    expect(options.ignoreElements!(document.createElement('img'))).toBe(true);
    expect(options.ignoreElements!(image)).toBe(false);
  });

  it('rejects an element with zero height', async () => {
    setPlatformOS('web');

    await expect(captureViewSegmentedPngBase64({ current: makeElement(400, 0) })).rejects.toThrow(
      '[FAIL-FAST] Segmented capture needs a positive element height',
    );
    expect(mockHtml2canvas).not.toHaveBeenCalled();
  });

  it('rejects an empty band instead of stitching a partial image', async () => {
    setPlatformOS('web');
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = 0;
    emptyCanvas.height = 0;
    mockHtml2canvas.mockResolvedValue(emptyCanvas);

    await expect(captureViewSegmentedPngBase64({ current: makeElement(400, 300) })).rejects.toThrow(
      '[FAIL-FAST] Segmented capture produced an empty band',
    );
  });

  it('rejects a Web ref that is not an HTMLElement', async () => {
    setPlatformOS('web');

    await expect(captureViewSegmentedPngBase64({ current: {} })).rejects.toThrow(
      '[FAIL-FAST] Capture view ref must resolve to an HTMLElement on Web',
    );
  });

  it('rejects an unmounted ref before entering a platform adapter', async () => {
    await expect(captureViewSegmentedPngBase64({ current: null })).rejects.toThrow(
      '[FAIL-FAST] Capture view ref is not mounted',
    );
  });

  it('delegates native capture to the whole-view capture unchanged', async () => {
    setPlatformOS('ios');
    const ref = { current: {} };
    mockCaptureRef.mockResolvedValue('native-base64');

    await expect(captureViewSegmentedPngBase64(ref)).resolves.toBe('native-base64');
    expect(mockHtml2canvas).not.toHaveBeenCalled();
  });

  it('reports band progress from zero to the band total across a Web capture', async () => {
    setPlatformOS('web');
    const element = makeElement(400, 2500);
    const progress: [number, number][] = [];

    await expect(
      captureViewSegmentedPngBase64(
        { current: element },
        { onProgress: (done, total) => progress.push([done, total]) },
      ),
    ).resolves.toBe('stitched');

    expect(progress).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('reports a single-band Web capture as (0, 1) then (1, 1)', async () => {
    setPlatformOS('web');
    const progress: [number, number][] = [];

    await captureViewSegmentedPngBase64(
      { current: makeElement(400, 300) },
      { onProgress: (done, total) => progress.push([done, total]) },
    );

    expect(progress).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it('stops reporting progress when a band fails and never reports completion', async () => {
    setPlatformOS('web');
    const element = makeElement(400, 2500);
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = 0;
    emptyCanvas.height = 0;
    let callCount = 0;
    mockHtml2canvas.mockImplementation(async (el, options) => {
      callCount += 1;
      if (callCount === 2) return emptyCanvas;
      const canvas = document.createElement('canvas');
      canvas.width = el.scrollWidth;
      canvas.height = options?.height ?? 0;
      return canvas;
    });
    const progress: [number, number][] = [];

    await expect(
      captureViewSegmentedPngBase64(
        { current: element },
        { onProgress: (done, total) => progress.push([done, total]) },
      ),
    ).rejects.toThrow('[FAIL-FAST] Segmented capture produced an empty band');

    expect(progress).toEqual([
      [0, 3],
      [1, 3],
    ]);
  });

  it('reports no progress when band planning rejects the element height', async () => {
    setPlatformOS('web');
    const onProgress = jest.fn<void, [number, number]>();

    await expect(
      captureViewSegmentedPngBase64({ current: makeElement(400, 0) }, { onProgress }),
    ).rejects.toThrow('[FAIL-FAST] Segmented capture needs a positive element height');

    expect(onProgress).not.toHaveBeenCalled();
  });

  it('reports the native delegation as one indivisible band', async () => {
    setPlatformOS('ios');
    mockCaptureRef.mockResolvedValue('native-base64');
    const progress: [number, number][] = [];

    await expect(
      captureViewSegmentedPngBase64(
        { current: {} },
        { onProgress: (done, total) => progress.push([done, total]) },
      ),
    ).resolves.toBe('native-base64');

    expect(progress).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it('does not report completion when the native delegation fails', async () => {
    setPlatformOS('ios');
    mockCaptureRef.mockRejectedValue(new Error('native capture failed'));
    const progress: [number, number][] = [];

    await expect(
      captureViewSegmentedPngBase64(
        { current: {} },
        { onProgress: (done, total) => progress.push([done, total]) },
      ),
    ).rejects.toThrow('native capture failed');

    expect(progress).toEqual([[0, 1]]);
  });
});
