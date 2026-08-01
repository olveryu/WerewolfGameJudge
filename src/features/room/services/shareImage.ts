/** Share a base64 PNG through native or browser platform APIs. */

import { File as ExpoFile, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';

import { shareLog } from '@/utils/logger';

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
  shareLog.debug('shareImageBase64', { filename });
  const base64Data = await getBase64();
  if (base64Data.length === 0) {
    throw new Error('Captured share image is empty');
  }

  if (Platform.OS === 'web') {
    await shareImageWeb(base64Data, filename, title);
    return;
  }
  await shareImageNative(base64Data, filename, title);
}

async function shareImageWeb(base64Data: string, filename: string, title: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    const file = base64ToFile(base64Data, filename);
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      downloadImage(base64Data, filename);
      return;
    }
    try {
      await navigator.share({ title, files: [file] });
      return;
    } catch (error) {
      if (error instanceof DOMException) {
        if (error.name === 'AbortError') return;
        if (error.name === 'NotAllowedError') {
          downloadImage(base64Data, filename);
          return;
        }
      }
      if (error instanceof TypeError) {
        downloadImage(base64Data, filename);
        return;
      }
      throw error;
    }
  }

  downloadImage(base64Data, filename);
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
