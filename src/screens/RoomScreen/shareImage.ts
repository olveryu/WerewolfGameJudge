/**
 * shareImage - Share a captured image via system share sheet
 *
 * Native: base64 → temp PNG (expo-file-system File class) → expo-sharing → delete temp file.
 * Web: base64 → Blob → navigator.share({ files }) → fallback: trigger download.
 *
 * Shared by QRCodeModal and NightReviewModal.
 * Does not import services, showAlert, or navigation.
 */
import { File as ExpoFile, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Convert a base64 string to a web File object (web only).
 */
function base64ToFile(base64: string, filename: string): globalThis.File {
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i);
  }
  return new globalThis.File([byteArray], filename, { type: 'image/png' });
}

/**
 * Web fallback: trigger a download of the image.
 */
function downloadImage(base64: string, filename: string): void {
  const link = document.createElement('a');
  link.href = `data:image/png;base64,${base64}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Share an image (base64 PNG) via the system share sheet.
 *
 * @param getBase64 - Async function returning the base64-encoded PNG data
 * @param filename - Filename for the temporary file (e.g. 'room-1234-review.png')
 * @param title - Title shown in the share dialog
 */
export async function shareImageBase64(
  getBase64: () => Promise<string>,
  filename: string,
  title: string,
): Promise<void> {
  const base64Data = await getBase64();

  if (Platform.OS === 'web') {
    await shareImageWeb(base64Data, filename, title);
    return;
  }

  await shareImageNative(base64Data, filename, title);
}

/** Web: navigator.share with files → download fallback. */
async function shareImageWeb(base64Data: string, filename: string, title: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    const file = base64ToFile(base64Data, filename);
    const shareData: ShareData = { title, files: [file] };

    // Always attempt navigator.share() directly — canShare() is unreliable
    // (Chrome iOS returns false for files even though share() works via WKWebView).
    // Rely on error handling to fall through to download.
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error instanceof DOMException) {
        // User cancelled the share sheet — not an error
        if (error.name === 'AbortError') return;
        // User activation expired (async capture too slow) — fall through to download
        if (error.name === 'NotAllowedError') {
          downloadImage(base64Data, filename);
          return;
        }
      }
      // TypeError = file sharing unsupported → fall through to download
      if (error instanceof TypeError) {
        downloadImage(base64Data, filename);
        return;
      }
      throw error;
    }
  }

  downloadImage(base64Data, filename);
}

/** Native: expo-file-system File class + expo-sharing. */
async function shareImageNative(
  base64Data: string,
  filename: string,
  title: string,
): Promise<void> {
  const tempFile = new ExpoFile(Paths.cache, filename);

  try {
    const byteChars = globalThis.atob(base64Data);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    tempFile.write(byteArray);

    await shareAsync(tempFile.uri, {
      mimeType: 'image/png',
      dialogTitle: title,
    });
  } finally {
    try {
      tempFile.delete();
    } catch {
      // Ignore cleanup errors
    }
  }
}
