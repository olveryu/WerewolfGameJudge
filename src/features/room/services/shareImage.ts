/**
 * Hand captured PNGs to the platform.
 *
 * The outcome says honestly what happened: `'handedOff'` — the system
 * share sheet took the images (Web Share completed, or the native sheet
 * returned: `expo-sharing` resolves alike on dismissal and completion, so
 * a native share is never reported cancelled); `'downloaded'` — no share
 * sheet could take them and the browser saved them instead; `'previewed'`
 * — the WeChat mini program opened its image preview after the upload;
 * `'cancelled'` — the reader dismissed the Web Share sheet (`AbortError`).
 * Any other failure throws.
 */

import { File as ExpoFile, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';

import { shareLog } from '@/utils/logger';
import { isMiniProgram, wxPreviewImage } from '@/utils/miniProgram';

import { uploadShareImage } from './uploadShareImage';

export type ShareImageOutcome = 'handedOff' | 'downloaded' | 'previewed' | 'cancelled';

export interface ShareImage {
  readonly base64: string;
  readonly filename: string;
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const byteChars = globalThis.atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let index = 0; index < byteChars.length; index += 1) {
    bytes[index] = byteChars.charCodeAt(index);
  }
  return bytes;
}

function downloadImage(image: ShareImage): void {
  const link = document.createElement('a');
  link.href = `data:image/png;base64,${image.base64}`;
  link.download = image.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** The one cancellation judgement for platform share sheets: the Web Share `AbortError`. */
export function isShareCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function assertShareImages(images: readonly ShareImage[]): void {
  if (images.length === 0) throw new Error('[FAIL-FAST] No images to share');
  for (const image of images) {
    if (image.base64.length === 0) {
      throw new Error(`[FAIL-FAST] Captured share image ${image.filename} is empty`);
    }
  }
}

/** Mini program: uploads the PNGs in order and returns their temporary public URLs. */
export async function uploadShareImages(images: readonly ShareImage[]): Promise<string[]> {
  assertShareImages(images);
  const urls: string[] = [];
  for (const image of images) urls.push(await uploadShareImage(image.base64));
  return urls;
}

/** Mini program: opens the uploaded images as one WeChat preview album, first image current. */
export async function previewUploadedImages(urls: readonly string[]): Promise<'previewed'> {
  const [first] = urls;
  if (first === undefined) throw new Error('[FAIL-FAST] No uploaded images to preview');
  await wxPreviewImage(first, urls);
  return 'previewed';
}

/** Shares ordered PNGs together: WeChat preview, the browser file-share sheet, or the native sheet. */
export async function shareImagesBase64(
  images: readonly ShareImage[],
  title: string,
): Promise<ShareImageOutcome> {
  assertShareImages(images);
  if (Platform.OS === 'web') {
    if (isMiniProgram()) return previewUploadedImages(await uploadShareImages(images));
    return shareImagesWeb(images, title);
  }
  for (const image of images) await shareImageNative(image, title);
  return 'handedOff';
}

async function shareImagesWeb(
  images: readonly ShareImage[],
  title: string,
): Promise<ShareImageOutcome> {
  const download = (): ShareImageOutcome => {
    for (const image of images) downloadImage(image);
    return 'downloaded';
  };
  if (typeof navigator === 'undefined' || !navigator.share) return download();
  const files = images.map(
    (image) =>
      new globalThis.File([base64ToBytes(image.base64)], image.filename, { type: 'image/png' }),
  );
  if (navigator.canShare && !navigator.canShare({ files })) return download();
  try {
    await navigator.share({ title, files });
    return 'handedOff';
  } catch (error) {
    if (isShareCancelled(error)) return 'cancelled';
    // No user activation left, or a payload the sheet refuses: save instead.
    if (
      (error instanceof DOMException && error.name === 'NotAllowedError') ||
      error instanceof TypeError
    ) {
      shareLog.warn('Web Share refused the images; downloading instead', error);
      return download();
    }
    throw error;
  }
}

async function shareImageNative(image: ShareImage, title: string): Promise<void> {
  const tempFile = new ExpoFile(Paths.cache, image.filename);
  try {
    tempFile.write(base64ToBytes(image.base64));
    await shareAsync(tempFile.uri, { mimeType: 'image/png', dialogTitle: title });
  } finally {
    try {
      tempFile.delete();
    } catch (error) {
      shareLog.warn('Temporary share image cleanup failed', error);
    }
  }
}
