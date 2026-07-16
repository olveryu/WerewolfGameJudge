/** @jest-environment jsdom */

import type html2canvas from 'html2canvas';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { captureViewPngBase64 } from '../captureViewPngBase64';
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

function setPlatformOS(os: typeof Platform.OS): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

afterEach(() => {
  setPlatformOS(originalPlatformOS);
  jest.clearAllMocks();
});

describe('captureViewPngBase64', () => {
  it('captures an HTMLElement through the Web renderer', async () => {
    setPlatformOS('web');
    const element = document.createElement('div');
    const canvas = document.createElement('canvas');
    jest.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,captured');
    mockHtml2canvas.mockResolvedValue(canvas);
    mockLoadHtml2canvas.mockResolvedValue(mockHtml2canvas);

    await expect(captureViewPngBase64({ current: element })).resolves.toBe('captured');
    expect(mockHtml2canvas).toHaveBeenCalledWith(element, { backgroundColor: null });
    expect(mockCaptureRef).not.toHaveBeenCalled();
  });

  it('rejects a Web ref that is not an HTMLElement', async () => {
    setPlatformOS('web');

    await expect(captureViewPngBase64({ current: {} })).rejects.toThrow(
      '[FAIL-FAST] Capture view ref must resolve to an HTMLElement on Web',
    );
  });

  it('rejects a malformed Web capture result', async () => {
    setPlatformOS('web');
    const canvas = document.createElement('canvas');
    jest.spyOn(canvas, 'toDataURL').mockReturnValue('blob:capture');
    mockHtml2canvas.mockResolvedValue(canvas);
    mockLoadHtml2canvas.mockResolvedValue(mockHtml2canvas);

    await expect(captureViewPngBase64({ current: document.createElement('div') })).rejects.toThrow(
      '[FAIL-FAST] Captured view must be a base64 data URL',
    );
  });

  it('delegates native capture to react-native-view-shot', async () => {
    setPlatformOS('ios');
    const ref = { current: {} };
    mockCaptureRef.mockResolvedValue('native-base64');

    await expect(captureViewPngBase64(ref)).resolves.toBe('native-base64');
    expect(mockCaptureRef).toHaveBeenCalledWith(ref, {
      format: 'png',
      result: 'base64',
      quality: 1,
    });
    expect(mockHtml2canvas).not.toHaveBeenCalled();
  });

  it('rejects an unmounted ref before entering a platform adapter', async () => {
    await expect(captureViewPngBase64({ current: null })).rejects.toThrow(
      '[FAIL-FAST] Capture view ref is not mounted',
    );
  });
});
