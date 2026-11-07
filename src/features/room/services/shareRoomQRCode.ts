/** Room QR image sharing built on the shared image service. */

import { shareImagesBase64 } from './shareImage';

export async function shareRoomQRCode(
  getBase64: () => Promise<string>,
  roomCode: string,
  gameDisplayName: string,
): Promise<void> {
  await shareImagesBase64(
    [{ base64: await getBase64(), filename: `room-${roomCode}-qr.png` }],
    `${gameDisplayName}房间号 ${roomCode}，扫码加入`,
  );
}
