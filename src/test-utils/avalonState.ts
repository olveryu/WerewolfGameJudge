/** Canonical minimal Avalon state for client tests (AU-46). */

import type { AvalonState } from '@game-judge/game-engine/games/avalon/public';
import { avalonEngine, DEFAULT_AVALON_CONFIG } from '@game-judge/game-engine/games/avalon/public';

export function buildAvalonTestState(overrides: Partial<AvalonState> = {}): AvalonState {
  return {
    ...avalonEngine.createInitialState(DEFAULT_AVALON_CONFIG, {
      roomCode: 'ABCD',
      hostUserId: 'host-1',
      nowMs: 0,
      commandId: 'create',
    }),
    ...overrides,
  };
}
