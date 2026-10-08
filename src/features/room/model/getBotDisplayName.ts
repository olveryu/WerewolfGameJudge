/**
 * Shared bot display name.
 *
 * Unified format for implicit bot seats across all games.
 * Previously drifted: "机器人 3" (undercover) vs "机器人3号" (storyrelay).
 * Canonical: "机器人3号" (no space, with 号 suffix).
 */

/** Returns the display name for a bot seat (0-indexed). */
export function getBotDisplayName(seat: number): string {
  return `机器人${seat + 1}号`;
}
