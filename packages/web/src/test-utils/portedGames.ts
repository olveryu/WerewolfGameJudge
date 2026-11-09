/**
 * Games whose web client has landed (docs/web-client-rewrite.md §8.2): the lazy loader map in
 * `games/clientModules.tsx` imports their module. Per-game contracts keep every game's entry and
 * check the ported ones, so each port turns its entries on.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { GAME_TYPES, type GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

const clientModulesSource = readFileSync(
  join(import.meta.dirname, '..', 'games', 'clientModules.tsx'),
  'utf8',
);

export const PORTED_GAME_TYPES: readonly GameType[] = GAME_TYPES.filter((gameType) =>
  clientModulesSource.includes(`import('@/games/${gameType}/module')`),
);

/** Whether a `games/<gameType>/…` path (relative to `src/`) belongs to a ported game. */
export function isPortedGamePath(relativePath: string): boolean {
  return PORTED_GAME_TYPES.some((gameType) => relativePath.startsWith(`games/${gameType}/`));
}
