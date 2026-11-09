/** URL builders for game-owned routes; the route table in app/routes.tsx declares the same shapes. */
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

export function gameConfigCreatePath(gameType: GameType): string {
  return `/game/${gameType}/config/create`;
}

export function gameConfigEditPath(gameType: GameType, roomCode: string): string {
  return `/game/${gameType}/config/edit/${roomCode}`;
}

export function gameGuidePath(gameType: GameType, roomCode: string | null): string {
  return roomCode === null ? `/game/${gameType}/guide` : `/game/${gameType}/guide/${roomCode}`;
}

/** Settings opened from a room keep the room code so the page applies room-aware rules. */
export function settingsPath(roomCode: string | null): string {
  return roomCode === null ? '/settings' : `/settings/${roomCode}`;
}
