/** Mini-program image sharing uploads real PNG data before requesting the WeChat preview. */

import { Platform } from 'react-native';

import { wxPreviewImage } from '@/utils/miniProgram';

import { shareImageBase64, shareImagesBase64 } from '../shareImage';
import { uploadShareImage } from '../uploadShareImage';

jest.mock('@/utils/miniProgram', () => ({ isMiniProgram: () => true, wxPreviewImage: jest.fn() }));
jest.mock('../uploadShareImage', () => ({ uploadShareImage: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
});

it('opens the uploaded PNG in WeChat instead of browser download or text sharing', async () => {
  jest.mocked(uploadShareImage).mockResolvedValue('https://test.local/share/story.png');
  await shareImageBase64(() => Promise.resolve('png-base64'), 'story.png', '文字接龙');
  expect(uploadShareImage).toHaveBeenCalledWith('png-base64');
  expect(wxPreviewImage).toHaveBeenCalledWith('https://test.local/share/story.png', [
    'https://test.local/share/story.png',
  ]);
});

it('previews all story images in order in one WeChat album', async () => {
  const urls = ['https://test.local/share/first.png', 'https://test.local/share/second.png'];
  jest.mocked(uploadShareImage).mockResolvedValueOnce(urls[0]!).mockResolvedValueOnce(urls[1]!);
  await shareImagesBase64(
    [
      { getBase64: () => Promise.resolve('first-png'), filename: 'first.png' },
      { getBase64: () => Promise.resolve('second-png'), filename: 'second.png' },
    ],
    '文字接龙',
  );
  expect(uploadShareImage).toHaveBeenNthCalledWith(1, 'first-png');
  expect(uploadShareImage).toHaveBeenNthCalledWith(2, 'second-png');
  expect(wxPreviewImage).toHaveBeenCalledTimes(1);
  expect(wxPreviewImage).toHaveBeenCalledWith(urls[0], urls);
});

it('propagates upload failures without opening a broken preview', async () => {
  const failure = new Error('upload failed');
  jest.mocked(uploadShareImage).mockRejectedValue(failure);
  await expect(
    shareImageBase64(() => Promise.resolve('png'), 'story.png', '文字接龙'),
  ).rejects.toBe(failure);
  expect(wxPreviewImage).not.toHaveBeenCalled();
});

it('rejects an empty capture before uploading', async () => {
  await expect(
    shareImageBase64(() => Promise.resolve(''), 'story.png', '文字接龙'),
  ).rejects.toThrow('Captured share image is empty');
  expect(uploadShareImage).not.toHaveBeenCalled();
});
