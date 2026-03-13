/**
 * shareQRCode - Share QR code as an image via system share sheet
 *
 * Thin wrapper around shareImageBase64 with QR-specific filename/title.
 * Does not import services, showAlert, or navigation.
 */
import { shareImageBase64 } from './shareImage';

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
  await shareImageBase64(getBase64, `room-${roomNumber}-qr.png`, `狼人杀房间 ${roomNumber} 二维码`);
}
