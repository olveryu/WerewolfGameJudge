/** Share a base64 PNG through native or browser platform APIs. */

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

export async function shareImageBase64(
  getBase64: () => Promise<string>,
  filename: string,
  title: string,
): Promise<void> {
  await shareImagesBase64([{ getBase64, filename }], title);
}

/** Shares ordered PNGs together in WeChat or a supported browser file-share sheet. */
export async function shareImagesBase64(
  images: readonly { readonly getBase64: () => Promise<string>; readonly filename: string }[],
  title: string,
): Promise<void> {
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
      return;
    }
    await shareImagesWeb(captured, title);
    return;
  }
  for (const image of captured) await shareImageNative(image.base64Data, image.filename, title);
}

async function shareImagesWeb(
  images: readonly { readonly base64Data: string; readonly filename: string }[],
  title: string,
): Promise<void> {
  const download = () => {
    for (const image of images) downloadImage(image.base64Data, image.filename);
  };
  if (typeof navigator !== 'undefined' && navigator.share) {
    const files = images.map((image) => base64ToFile(image.base64Data, image.filename));
    if (navigator.canShare && !navigator.canShare({ files })) {
      download();
      return;
    }
    try {
      await navigator.share({ title, files });
      return;
    } catch (error) {
      if (error instanceof DOMException) {
        if (error.name === 'AbortError') return;
        if (error.name === 'NotAllowedError') {
          download();
          return;
        }
      }
      if (error instanceof TypeError) {
        download();
        return;
      }
      throw error;
    }
  }

  download();
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
