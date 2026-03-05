/**
 * shareQRCode - Share QR code as an image via system share sheet
 *
 * Native: base64 → temp PNG (expo-file-system File class) → expo-sharing → delete temp file.
 * Web: base64 → Blob → navigator.share({ files }) → fallback: trigger download.
 *
 * Users never see a "save" step — the image goes directly to the share sheet.
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
 * Web fallback: trigger a download of the QR image.
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
 * Share a QR code image via the system share sheet (native + web).
 *
 * @param getBase64 - Async function returning the base64-encoded PNG data from QRCode ref
 * @param roomNumber - Room number for the temp filename
 */
export async function shareQRCodeImage(
  getBase64: () => Promise<string>,
  roomNumber: string,
): Promise<void> {
  const base64Data = await getBase64();
  const filename = `room-${roomNumber}-qr.png`;

  if (Platform.OS === 'web') {
    await shareQRCodeWeb(base64Data, filename, roomNumber);
    return;
  }

  await shareQRCodeNative(base64Data, filename, roomNumber);
}

/** Web: navigator.share with files → download fallback. */
async function shareQRCodeWeb(
  base64Data: string,
  filename: string,
  roomNumber: string,
): Promise<void> {
  // Try Web Share API Level 2 (files support)
  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    typeof navigator.canShare === 'function'
  ) {
    const file = base64ToFile(base64Data, filename);
    const shareData = {
      title: `狼人杀房间 ${roomNumber} 二维码`,
      files: [file],
    };
    if (navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return;
    }
  }

  // Fallback: download the image
  downloadImage(base64Data, filename);
}

/** Native: expo-file-system File class + expo-sharing. */
async function shareQRCodeNative(
  base64Data: string,
  _filename: string,
  roomNumber: string,
): Promise<void> {
  const tempFile = new ExpoFile(Paths.cache, `room-${roomNumber}-qr.png`);

  try {
    // Decode base64 to Uint8Array and write to file
    const byteChars = globalThis.atob(base64Data);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    tempFile.write(byteArray);

    // Open system share sheet
    await shareAsync(tempFile.uri, {
      mimeType: 'image/png',
      dialogTitle: `狼人杀房间 ${roomNumber} 二维码`,
    });
  } finally {
    // Clean up temp file (best-effort)
    try {
      tempFile.delete();
    } catch {
      // Ignore cleanup errors
    }
  }
}
