/**
 * Guidance matrix registry contract: every game in the client
 * catalog declares a (phase × viewer) guidance matrix, and every
 * declaration is well-formed — each phase row covers exactly the
 * three viewers, and each cell is either a message promise or an
 * exemption with a non-empty reason naming the carrying surface.
 * A new game that registers in the catalog without declaring its
 * matrix fails here; per-game matrix tests hold each cell true
 * against the game's real bottom-action production.
 */
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import type { RoomGuidanceMatrix } from '@/features/room/model/RoomGuidanceMatrix';
import { AVALON_GUIDANCE_MATRIX } from '@/games/avalon/room/avalonGuidanceMatrix';
import { CLIENT_GAME_PLUGIN_CATALOG } from '@/games/catalog';
import { DEMO_GUIDANCE_MATRIX } from '@/games/demo/room/demoGuidanceMatrix';
import { DRAWGUESS_GUIDANCE_MATRIX } from '@/games/drawguess/room/drawGuessGuidanceMatrix';
import { FIBKING_GUIDANCE_MATRIX } from '@/games/fibking/room/fibGuidanceMatrix';
import { PICTIONARY_GUIDANCE_MATRIX } from '@/games/pictionary/room/pictionaryGuidanceMatrix';
import { STORY_RELAY_GUIDANCE_MATRIX } from '@/games/storyrelay/room/storyRelayGuidanceMatrix';
import { UNDERCOVER_GUIDANCE_MATRIX } from '@/games/undercover/room/undercoverGuidanceMatrix';
import { WEREWOLF_GUIDANCE_MATRIX } from '@/games/werewolf/room/werewolfGuidanceMatrix';

const GUIDANCE_MATRICES: Record<GameType, RoomGuidanceMatrix<string>> = {
  werewolf: WEREWOLF_GUIDANCE_MATRIX,
  avalon: AVALON_GUIDANCE_MATRIX,
  fibking: FIBKING_GUIDANCE_MATRIX,
  undercover: UNDERCOVER_GUIDANCE_MATRIX,
  pictionary: PICTIONARY_GUIDANCE_MATRIX,
  storyrelay: STORY_RELAY_GUIDANCE_MATRIX,
  drawguess: DRAWGUESS_GUIDANCE_MATRIX,
  demo: DEMO_GUIDANCE_MATRIX,
};

const VIEWERS = ['host', 'seated', 'spectator'];

describe('guidance matrix registry', () => {
  it('covers exactly the games registered in the client catalog', () => {
    expect(Object.keys(GUIDANCE_MATRICES).sort()).toEqual(
      Object.keys(CLIENT_GAME_PLUGIN_CATALOG).sort(),
    );
  });

  it.each(Object.entries(GUIDANCE_MATRICES))(
    '%s: every row covers the three viewers and every cell is well-formed',
    (_gameType, matrix) => {
      const phases = Object.keys(matrix);
      expect(phases.length).toBeGreaterThan(0);
      for (const phase of phases) {
        const row = matrix[phase];
        if (row === undefined) throw new Error(`missing row for phase ${phase}`);
        expect(Object.keys(row).sort()).toEqual([...VIEWERS].sort());
        for (const cell of Object.values(row)) {
          if (cell.kind === 'exempt') {
            expect(typeof cell.reason).toBe('string');
            expect(cell.reason.trim().length).toBeGreaterThan(0);
          } else {
            expect(cell.kind).toBe('message');
          }
        }
      }
    },
  );
});
