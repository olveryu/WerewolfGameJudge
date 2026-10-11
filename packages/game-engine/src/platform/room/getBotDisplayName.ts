/**
 * getBotDisplayName — the one canonical display name for a bot seat.
 *
 * Unified format across all games: "机器人3号" (no space, 号 suffix).
 * Previously seven copies of the same template drifted across the
 * engines and the client; every game-specific helper now delegates here.
 */

import { formatSeat } from './formatSeat';

/** Returns the display name for a bot seat (0-indexed). */
export function getBotDisplayName(seat: number): string {
  return `机器人${formatSeat(seat)}`;
}
