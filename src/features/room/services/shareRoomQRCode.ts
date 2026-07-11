/** Room QR image sharing built on the shared image service. */

import { shareImageBase64 } from './shareImage';

export async function shareRoomQRCode(
  getBase64: () => Promise<string>,
  roomCode: string,
  gameDisplayName: string,
): Promise<void> {
  await shareImageBase64(
    getBase64,
    `room-${roomCode}-qr.png`,
    `${gameDisplayName}房间 ${roomCode} 二维码`,
  );
}
