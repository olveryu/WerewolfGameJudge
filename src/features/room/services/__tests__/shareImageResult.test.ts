/**
 * @jest-environment jsdom
 *
 * shareImagesBase64 outcomes on the web: a completed Web Share is
 * 'handedOff', a dismissed sheet (AbortError) is 'cancelled', a refused or
 * missing sheet falls back to a download reported as 'downloaded', and any
 * other failure throws.
 */
import { Platform } from 'react-native';

import { isShareCancelled, shareImagesBase64 } from '../shareImage';

jest.mock('@/utils/miniProgram', () => ({ isMiniProgram: () => false, wxPreviewImage: jest.fn() }));
jest.mock('../uploadShareImage', () => ({ uploadShareImage: jest.fn() }));

const images = [{ filename: 'a.png', base64: btoa('png') }];

function installNavigatorShare(share: jest.Mock | undefined, canShare = true) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: share === undefined ? {} : { share, canShare: () => canShare },
  });
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  document.body.innerHTML = '';
});

describe('shareImagesBase64 on the web', () => {
  it('reports handedOff when the Web Share sheet completes', async () => {
    installNavigatorShare(jest.fn(async () => undefined));
    await expect(shareImagesBase64(images, '标题')).resolves.toBe('handedOff');
  });

  it('reports cancelled only for the Web Share AbortError', async () => {
    const abort = new DOMException('dismissed', 'AbortError');
    installNavigatorShare(jest.fn(async () => Promise.reject(abort)));
    await expect(shareImagesBase64(images, '标题')).resolves.toBe('cancelled');
    expect(isShareCancelled(abort)).toBe(true);
    expect(isShareCancelled(new Error('user cancelled'))).toBe(false);
  });

  it('downloads and reports downloaded when the sheet refuses without a user gesture', async () => {
    installNavigatorShare(
      jest.fn(async () => Promise.reject(new DOMException('gesture', 'NotAllowedError'))),
    );
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await expect(shareImagesBase64(images, '标题')).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('downloads when the browser cannot share files', async () => {
    installNavigatorShare(jest.fn(), false);
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await expect(shareImagesBase64(images, '标题')).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('downloads when the browser has no Web Share', async () => {
    installNavigatorShare(undefined);
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await expect(shareImagesBase64(images, '标题')).resolves.toBe('downloaded');
    click.mockRestore();
  });

  it('propagates any other share failure', async () => {
    installNavigatorShare(jest.fn(async () => Promise.reject(new Error('network'))));
    await expect(shareImagesBase64(images, '标题')).rejects.toThrow('network');
  });
});
