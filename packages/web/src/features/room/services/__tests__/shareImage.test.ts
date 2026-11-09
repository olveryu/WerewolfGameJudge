/**
 * shareImagesBase64: the mini program uploads then opens WeChat's preview; the browser hands
 * files to Web Share ('handedOff'), reports a dismissed sheet ('cancelled'), downloads when the
 * sheet is missing or refuses ('downloaded'), and throws any other failure.
 */
import { isMiniProgram, wxPreviewImage } from '@/utils/miniProgram';

import {
  isShareCancelled,
  previewUploadedImages,
  shareImagesBase64,
  uploadShareImages,
} from '../shareImage';
import { uploadShareImage } from '../uploadShareImage';

vi.mock('@/utils/miniProgram', () => ({ isMiniProgram: vi.fn(), wxPreviewImage: vi.fn() }));
vi.mock('../uploadShareImage', () => ({ uploadShareImage: vi.fn() }));

const images = [{ filename: 'a.png', base64: btoa('png') }];

function stubShare(share: ((data: ShareData) => Promise<void>) | undefined, canShare = true) {
  vi.stubGlobal('navigator', share === undefined ? {} : { share, canShare: () => canShare });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isMiniProgram).mockReturnValue(false);
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shareImagesBase64 in the mini program', () => {
  beforeEach(() => {
    vi.mocked(isMiniProgram).mockReturnValue(true);
  });

  it('uploads every image in order and opens them as one WeChat album', async () => {
    vi.mocked(uploadShareImage)
      .mockResolvedValueOnce('https://test.local/1.png')
      .mockResolvedValueOnce('https://test.local/2.png');
    await expect(
      shareImagesBase64(
        [
          { filename: '1.png', base64: 'AA' },
          { filename: '2.png', base64: 'BB' },
        ],
        'title',
      ),
    ).resolves.toBe('previewed');
    expect(uploadShareImage).toHaveBeenNthCalledWith(1, 'AA');
    expect(uploadShareImage).toHaveBeenNthCalledWith(2, 'BB');
    expect(wxPreviewImage).toHaveBeenCalledWith('https://test.local/1.png', [
      'https://test.local/1.png',
      'https://test.local/2.png',
    ]);
  });

  it('splits upload from preview so a caller can stop between them', async () => {
    vi.mocked(uploadShareImage).mockResolvedValue('https://test.local/a.png');
    const urls = await uploadShareImages(images);
    expect(wxPreviewImage).not.toHaveBeenCalled();
    await expect(previewUploadedImages(urls)).resolves.toBe('previewed');
  });

  it('propagates an upload failure without opening a preview', async () => {
    vi.mocked(uploadShareImage).mockRejectedValue(new Error('413'));
    await expect(shareImagesBase64(images, 'title')).rejects.toThrow('413');
    expect(wxPreviewImage).not.toHaveBeenCalled();
  });
});

describe('shareImagesBase64 in the browser', () => {
  it('reports handedOff when the Web Share sheet completes', async () => {
    const share = vi.fn(async () => undefined);
    stubShare(share);
    await expect(shareImagesBase64(images, 'title')).resolves.toBe('handedOff');
    expect(share).toHaveBeenCalledWith({ title: 'title', files: [expect.any(File)] });
  });

  it('reports cancelled only for the Web Share AbortError', async () => {
    const abort = new DOMException('dismissed', 'AbortError');
    stubShare(vi.fn(async () => Promise.reject(abort)));
    await expect(shareImagesBase64(images, 'title')).resolves.toBe('cancelled');
    expect(isShareCancelled(abort)).toBe(true);
    expect(isShareCancelled(new Error('x'))).toBe(false);
  });

  it('downloads when the sheet refuses without a user gesture', async () => {
    stubShare(vi.fn(async () => Promise.reject(new DOMException('no gesture', 'NotAllowedError'))));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await expect(shareImagesBase64(images, 'title')).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('downloads when the browser cannot share files or has no Web Share', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    stubShare(vi.fn(), false);
    await expect(shareImagesBase64(images, 'title')).resolves.toBe('downloaded');
    stubShare(undefined);
    await expect(shareImagesBase64(images, 'title')).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('propagates any other share failure', async () => {
    stubShare(vi.fn(async () => Promise.reject(new Error('boom'))));
    await expect(shareImagesBase64(images, 'title')).rejects.toThrow('boom');
  });

  it('rejects an empty capture or image list before sharing', async () => {
    await expect(shareImagesBase64([], 'title')).rejects.toThrow('[FAIL-FAST] No images to share');
    await expect(shareImagesBase64([{ filename: 'a.png', base64: '' }], 'title')).rejects.toThrow(
      '[FAIL-FAST] Captured share image a.png is empty',
    );
  });
});
