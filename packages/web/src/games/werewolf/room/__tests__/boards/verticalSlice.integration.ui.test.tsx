/**
 * Vertical Slice Board Test
 *
 * Drives WerewolfRoomScreen UI rendering from real GameState produced by the engine.
 * Purpose: verify the full pipeline from integration state -> UI rendering,
 * catching UI behavior differences caused by mock vs. real-state shape mismatches.
 *
 * Strategy:
 * 1. The engine game fixture creates the game and advances to the target step
 * 2. Mount the room screen on the real snapshot through the fake link
 * 3. Verify the correct dialog appears
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { doesRoleParticipateInWolfVote } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  createWerewolfRoomMockFromState,
  mountWerewolfRoom,
  recordAlerts,
  RoomScreenTestHarness,
} from '@/games/werewolf/room/__tests__/harness';
import {
  createEngineGame,
  type EngineGame,
} from '@/games/werewolf/room/__tests__/harness/engineGame';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const TEMPLATE_NAME = '预女猎白';
const MY_SEAT = 9; // witch seat
const SEAT_ROLES: readonly RoleId[] = [
  'villager',
  'villager',
  'villager',
  'villager',
  'wolf',
  'wolf',
  'wolf',
  'wolf',
  'seer',
  'witch',
  'hunter',
  'idiot',
];

function createRoleAssignment(): Map<number, RoleId> {
  return new Map(SEAT_ROLES.map((role, seat) => [seat, role]));
}

/** Every wolf knifes seat 0, then the authoritative deadline releases the wolf step. */
function completeWolfKill(game: EngineGame): void {
  for (const [seatText, player] of Object.entries(game.getGameState().players)) {
    if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
      game.submitActionOrThrow(
        Number.parseInt(seatText, 10),
        { kind: 'target', target: 0 },
        'wolfKill',
      );
    }
  }
  const wolfVoteState = game.getGameState();
  const wolfVoteDeadline =
    wolfVoteState.nightStep?.kind === 'inStep' ? wolfVoteState.nightStep.stepDeadline : undefined;
  if (wolfVoteDeadline === undefined) {
    throw new Error('[FAIL-FAST] Completed wolf vote must set a progression deadline');
  }
  game.dispatchSystemOrThrow({ type: 'werewolf.phase.settleExpired' }, 'past wolfKill deadline', {
    nowMs: wolfVoteDeadline,
  });
}

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe('Vertical Slice: real state -> UI rendering', () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  it('witchAction step with real state -> shows witchSavePrompt', async () => {
    const game = createEngineGame(TEMPLATE_NAME, createRoleAssignment());
    completeWolfKill(game);
    game.assertStep('witchAction');
    game.acknowledgePendingAudioOrThrow('complete wolfKill to witchAction audio');

    await mountWerewolfRoom(createWerewolfRoomMockFromState(game.getGameState(), MY_SEAT));

    // Witch should see save prompt since seat 0 was killed and canSave=true
    await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
  });

  it('seerCheck step with real state -> shows actionPrompt', async () => {
    const game = createEngineGame(TEMPLATE_NAME, createRoleAssignment());
    completeWolfKill(game);
    game.acknowledgePendingAudioOrThrow('complete wolfKill to witchAction audio');
    game.submitActionOrThrow(9, { kind: 'skip' }, 'witchAction');
    game.acknowledgePendingAudioOrThrow('complete witchAction to hunterConfirm audio');
    game.submitActionOrThrow(10, { kind: 'confirm' }, 'hunterConfirm');
    game.assertStep('seerCheck');
    game.acknowledgePendingAudioOrThrow('complete hunterConfirm to seerCheck audio');

    const seerSeat = 8;
    await mountWerewolfRoom(createWerewolfRoomMockFromState(game.getGameState(), seerSeat));

    // Seer should see action prompt
    await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
  });
});
