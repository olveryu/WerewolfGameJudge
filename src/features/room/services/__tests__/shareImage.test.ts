/** Mini-program image sharing uploads real PNG data before requesting the WeChat preview. */

import { Platform } from 'react-native';

import { wxPreviewImage } from '@/utils/miniProgram';

import { previewUploadedImages, shareImagesBase64, uploadShareImages } from '../shareImage';
import { uploadShareImage } from '../uploadShareImage';

jest.mock('@/utils/miniProgram', () => ({ isMiniProgram: () => true, wxPreviewImage: jest.fn() }));
jest.mock('../uploadShareImage', () => ({ uploadShareImage: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
});

it('opens the uploaded PNG in WeChat and reports previewed', async () => {
  jest.mocked(uploadShareImage).mockResolvedValue('https://test.local/share/story.png');
  await expect(
    shareImagesBase64([{ base64: 'png-base64', filename: 'story.png' }], '文字接龙'),
  ).resolves.toBe('previewed');
  expect(uploadShareImage).toHaveBeenCalledWith('png-base64');
  expect(wxPreviewImage).toHaveBeenCalledWith('https://test.local/share/story.png', [
    'https://test.local/share/story.png',
  ]);
});

it('previews all images in order in one WeChat album', async () => {
  const urls = ['https://test.local/share/first.png', 'https://test.local/share/second.png'];
  jest.mocked(uploadShareImage).mockResolvedValueOnce(urls[0]!).mockResolvedValueOnce(urls[1]!);
  await shareImagesBase64(
    [
      { base64: 'first-png', filename: 'first.png' },
      { base64: 'second-png', filename: 'second.png' },
    ],
    '文字接龙',
  );
  expect(uploadShareImage).toHaveBeenNthCalledWith(1, 'first-png');
  expect(uploadShareImage).toHaveBeenNthCalledWith(2, 'second-png');
  expect(wxPreviewImage).toHaveBeenCalledTimes(1);
  expect(wxPreviewImage).toHaveBeenCalledWith(urls[0], urls);
});

it('splits upload from preview so a caller can stop between them', async () => {
  jest.mocked(uploadShareImage).mockResolvedValue('https://test.local/share/a.png');
  const uploaded = await uploadShareImages([{ base64: 'a', filename: 'a.png' }]);
  expect(uploaded).toEqual(['https://test.local/share/a.png']);
  expect(wxPreviewImage).not.toHaveBeenCalled();
  await expect(previewUploadedImages(uploaded)).resolves.toBe('previewed');
  expect(wxPreviewImage).toHaveBeenCalledWith(uploaded[0], uploaded);
});

it('propagates upload failures without opening a broken preview', async () => {
  const failure = new Error('upload failed');
  jest.mocked(uploadShareImage).mockRejectedValue(failure);
  await expect(
    shareImagesBase64([{ base64: 'png', filename: 'story.png' }], '文字接龙'),
  ).rejects.toBe(failure);
  expect(wxPreviewImage).not.toHaveBeenCalled();
});

it('rejects an empty capture before uploading', async () => {
  await expect(
    shareImagesBase64([{ base64: '', filename: 'story.png' }], '文字接龙'),
  ).rejects.toThrow('Captured share image story.png is empty');
  expect(uploadShareImage).not.toHaveBeenCalled();
});

it('rejects an empty image list', async () => {
  await expect(shareImagesBase64([], '文字接龙')).rejects.toThrow('No images to share');
});
