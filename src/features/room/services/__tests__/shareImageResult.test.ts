/**
 * @jest-environment jsdom
 *
 * shareImagesBase64 result semantics on the web: a completed Web Share
 * is 'shared', a dismissed sheet (AbortError) is 'cancelled', a
 * download fallback is 'shared', and other failures throw.
 */
import { Platform } from 'react-native';

import { isShareCancelled, shareImagesBase64 } from '../shareImage';

jest.mock('@/utils/miniProgram', () => ({ isMiniProgram: () => false, wxPreviewImage: jest.fn() }));
jest.mock('../uploadShareImage', () => ({ uploadShareImage: jest.fn() }));

const images = [{ filename: 'a.png', getBase64: async () => btoa('png') }];

function installNavigatorShare(share: jest.Mock | undefined) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: share === undefined ? {} : { share, canShare: () => true },
  });
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  document.body.innerHTML = '';
});

describe('shareImagesBase64 on the web', () => {
  it('reports shared when the Web Share sheet completes', async () => {
    installNavigatorShare(jest.fn(async () => undefined));
    await expect(shareImagesBase64(images, '标题')).resolves.toBe('shared');
  });

  it('reports cancelled only for the Web Share AbortError', async () => {
    const abort = new DOMException('dismissed', 'AbortError');
    installNavigatorShare(jest.fn(async () => Promise.reject(abort)));
    await expect(shareImagesBase64(images, '标题')).resolves.toBe('cancelled');
    expect(isShareCancelled(abort)).toBe(true);
    expect(isShareCancelled(new Error('user cancelled'))).toBe(false);
  });

  it('falls back to a download and reports shared without a user gesture', async () => {
    installNavigatorShare(
      jest.fn(async () => Promise.reject(new DOMException('gesture', 'NotAllowedError'))),
    );
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await expect(shareImagesBase64(images, '标题')).resolves.toBe('shared');
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('propagates any other share failure', async () => {
    installNavigatorShare(jest.fn(async () => Promise.reject(new Error('network'))));
    await expect(shareImagesBase64(images, '标题')).rejects.toThrow('network');
  });
});
