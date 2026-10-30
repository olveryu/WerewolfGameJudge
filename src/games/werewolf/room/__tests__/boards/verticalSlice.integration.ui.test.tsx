/**
 * Vertical Slice Board Test
 *
 * Drives WerewolfRoomScreen UI rendering from real GameState produced by gameFactory.
 * Purpose: verify the full pipeline from integration state -> UI rendering,
 * catching UI behavior differences caused by mock vs. real-state shape mismatches.
 *
 * Strategy:
 * 1. gameFactory creates the game and advances to witchAction step
 * 2. Mount the room screen on the real snapshot through the fake link
 * 3. Render WerewolfRoomScreen and verify the correct dialog appears
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { doesRoleParticipateInWolfVote } from '@game-judge/game-engine/games/werewolf/public';
import { render, waitFor } from '@testing-library/react-native';

import { cleanupGame, createGame } from '@/games/werewolf/__tests__/engine/boards/gameFactory';
import { submitActionOrThrow } from '@/games/werewolf/__tests__/engine/boards/stepByStepRunner';
import {
  createShowAlertMock,
  mockNavigation,
  mockRoom,
  RoomScreenTestHarness,
  waitForRoomScreen,
} from '@/games/werewolf/room/__tests__/harness';
import {
  createWerewolfRoomMockFromState,
  type WerewolfRoomMock,
} from '@/games/werewolf/room/__tests__/harness/boardTestUtils';
import { WerewolfRoomScreen } from '@/games/werewolf/room/__tests__/harness/ReadyWerewolfRoomScreen';
import { showAlert } from '@/utils/alert';

// =============================================================================
// Mocks
// =============================================================================

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

// imActioner=true so we can verify action dialogs appear
// =============================================================================
// Test Setup
// =============================================================================

const TEMPLATE_NAME = '预女猎白';
const MY_SEAT = 9; // witch seat

function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  [
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
  ].forEach((role, idx) => map.set(idx, role as RoleId));
  return map;
}

let harness: RoomScreenTestHarness;
let mockUseWerewolfRoomReturn: WerewolfRoomMock;

jest.mock('@/games/werewolf/room/__tests__/harness/activeRoomMock', () => ({
  getActiveRoomMock: () => mockUseWerewolfRoomReturn,
}));

// =============================================================================
// Tests
// =============================================================================

describe('Vertical Slice: real state -> UI rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    jest.mocked(showAlert).mockImplementation(createShowAlertMock(harness));
  });

  afterEach(() => {
    cleanupGame();
  });

  it('witchAction step with real state -> shows witchSavePrompt', async () => {
    // 1. Create real game and walk to witchAction
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
    const s0 = ctx.getGameState();

    // Submit all wolf votes, then release the authoritative deadline gate
    for (const [seatStr, player] of Object.entries(s0.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        submitActionOrThrow(ctx, seat, { kind: 'target', target: 0 }, 'wolfKill');
      }
    }
    const wolfVoteState = ctx.getGameState();
    const wolfVoteDeadline =
      wolfVoteState.nightStep?.kind === 'inStep' ? wolfVoteState.nightStep.stepDeadline : undefined;
    if (wolfVoteDeadline === undefined) {
      throw new Error('[FAIL-FAST] Completed wolf vote must set a progression deadline');
    }
    ctx.dispatchOrThrow({ type: 'werewolf.phase.expire' }, 'past wolfKill deadline', undefined, {
      nowMs: wolfVoteDeadline,
    });
    ctx.assertStep('witchAction');
    ctx.acknowledgePendingAudioOrThrow('complete wolfKill to witchAction audio');

    // 2. Get real broadcast state at witchAction
    const realState = ctx.getGameState();

    // 3. Mount the room on the real state as the witch
    mockUseWerewolfRoomReturn = createWerewolfRoomMockFromState(realState, MY_SEAT);

    // 4. Render and verify
    const { getByTestId } = render(
      <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
    );

    await waitForRoomScreen(getByTestId);

    // Witch should see save prompt since seat 0 was killed and canSave=true
    await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
  });

  it('seerCheck step with real state -> shows actionPrompt', async () => {
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());
    const s0 = ctx.getGameState();

    // Walk to seerCheck
    for (const [seatStr, player] of Object.entries(s0.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        submitActionOrThrow(ctx, seat, { kind: 'target', target: 0 }, 'wolfKill');
      }
    }
    const wolfVoteState = ctx.getGameState();
    const wolfVoteDeadline =
      wolfVoteState.nightStep?.kind === 'inStep' ? wolfVoteState.nightStep.stepDeadline : undefined;
    if (wolfVoteDeadline === undefined) {
      throw new Error('[FAIL-FAST] Completed wolf vote must set a progression deadline');
    }
    ctx.dispatchOrThrow({ type: 'werewolf.phase.expire' }, 'past wolfKill deadline', undefined, {
      nowMs: wolfVoteDeadline,
    });
    ctx.acknowledgePendingAudioOrThrow('complete wolfKill to witchAction audio');
    submitActionOrThrow(ctx, 9, { kind: 'skip' }, 'witchAction');
    ctx.acknowledgePendingAudioOrThrow('complete witchAction to hunterConfirm audio');
    submitActionOrThrow(ctx, 10, { kind: 'confirm' }, 'hunterConfirm');
    ctx.assertStep('seerCheck');
    ctx.acknowledgePendingAudioOrThrow('complete hunterConfirm to seerCheck audio');

    const realState = ctx.getGameState();
    const seerSeat = 8;

    mockUseWerewolfRoomReturn = createWerewolfRoomMockFromState(realState, seerSeat);

    const { getByTestId } = render(
      <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
    );

    await waitForRoomScreen(getByTestId);

    // Seer should see action prompt
    await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
  });
});
