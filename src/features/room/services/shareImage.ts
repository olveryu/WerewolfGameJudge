/**
 * Share base64 PNGs through native or browser platform APIs.
 *
 * Result semantics: `'shared'` once the platform share surface was
 * presented (the Web Share sheet completed, the WeChat preview opened,
 * the native sheet returned, or a download was triggered where no sheet
 * exists); `'cancelled'` only when the platform reports the user
 * dismissed the sheet — the Web Share `AbortError`. `expo-sharing`'s
 * `shareAsync` resolves void on dismissal and completion alike, so a
 * native share is never reported cancelled. Any other failure throws.
 */

import { File as ExpoFile, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';

import { shareLog } from '@/utils/logger';
import { isMiniProgram, wxPreviewImage } from '@/utils/miniProgram';

import { uploadShareImage } from './uploadShareImage';

function base64ToFile(base64: string, filename: string): globalThis.File {
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let index = 0; index < byteChars.length; index += 1) {
    byteArray[index] = byteChars.charCodeAt(index);
  }
  return new globalThis.File([byteArray], filename, { type: 'image/png' });
}

function downloadImage(base64: string, filename: string): void {
  const link = document.createElement('a');
  link.href = `data:image/png;base64,${base64}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export type ShareImageResult = 'shared' | 'cancelled';

export interface ShareImageSource {
  readonly getBase64: () => Promise<string>;
  readonly filename: string;
}

/** The one cancellation judgement for platform share sheets: the Web Share `AbortError`. */
export function isShareCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function shareImageBase64(
  getBase64: () => Promise<string>,
  filename: string,
  title: string,
): Promise<ShareImageResult> {
  return shareImagesBase64([{ getBase64, filename }], title);
}

/** Shares ordered PNGs together in WeChat or a supported browser file-share sheet. */
export async function shareImagesBase64(
  images: readonly ShareImageSource[],
  title: string,
): Promise<ShareImageResult> {
  if (images.length === 0) throw new Error('No images to share');
  const captured: { base64Data: string; filename: string }[] = [];
  for (const image of images) {
    const base64Data = await image.getBase64();
    if (base64Data.length === 0) throw new Error('Captured share image is empty');
    captured.push({ base64Data, filename: image.filename });
  }

  if (Platform.OS === 'web') {
    if (isMiniProgram()) {
      const urls: string[] = [];
      for (const image of captured) urls.push(await uploadShareImage(image.base64Data));
      await wxPreviewImage(urls[0]!, urls);
      return 'shared';
    }
    return shareImagesWeb(captured, title);
  }
  for (const image of captured) await shareImageNative(image.base64Data, image.filename, title);
  return 'shared';
}

async function shareImagesWeb(
  images: readonly { readonly base64Data: string; readonly filename: string }[],
  title: string,
): Promise<ShareImageResult> {
  const download = (): ShareImageResult => {
    for (const image of images) downloadImage(image.base64Data, image.filename);
    return 'shared';
  };
  if (typeof navigator !== 'undefined' && navigator.share) {
    const files = images.map((image) => base64ToFile(image.base64Data, image.filename));
    if (navigator.canShare && !navigator.canShare({ files })) return download();
    try {
      await navigator.share({ title, files });
      return 'shared';
    } catch (error) {
      if (isShareCancelled(error)) return 'cancelled';
      // No user gesture / unsupported payload: fall back to a download.
      if (error instanceof DOMException && error.name === 'NotAllowedError') return download();
      if (error instanceof TypeError) return download();
      throw error;
    }
  }

  return download();
}

async function shareImageNative(
  base64Data: string,
  filename: string,
  title: string,
): Promise<void> {
  const tempFile = new ExpoFile(Paths.cache, filename);
  try {
    const byteChars = globalThis.atob(base64Data);
    const byteArray = new Uint8Array(byteChars.length);
    for (let index = 0; index < byteChars.length; index += 1) {
      byteArray[index] = byteChars.charCodeAt(index);
    }
    tempFile.write(byteArray);
    await shareAsync(tempFile.uri, { mimeType: 'image/png', dialogTitle: title });
  } finally {
    try {
      tempFile.delete();
    } catch (error) {
      shareLog.warn('Temporary share image cleanup failed', error);
    }
  }
}
