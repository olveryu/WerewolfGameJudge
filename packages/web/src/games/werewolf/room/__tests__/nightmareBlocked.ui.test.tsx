/**
 * Nightmare Blocked UI Test (server-authoritative version)
 *
 * Behavior:
 * - UI does NOT intercept blocked players for chooseSeat/swap schemas
 * - UI shows skip button for confirm schemas when blocked
 * - Server returns ACTION_REJECTED with blocked reason
 * - UI shows error from gameState.actionRejected
 */

import { BLOCKED_UI_DEFAULTS } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
  confirmStep,
  mountRoomFor,
  recordAlerts,
  RoomScreenTestHarness,
  tapSeat,
  type WerewolfRoomMockOptions,
} from '@/games/werewolf/room/__tests__/harness';

vi.mock('@/contexts/AuthContext', () => import('./harness/testAuthContext'));

const BLOCKED_AT_SEAT_0 = { nightmareBlockedSeat: 0, currentNightResults: { blockedSeat: 0 } };

/** A nightmare-blocked actor at seat 0 (the engine hint follows from the blocked seat). */
const BLOCKED_SEER: WerewolfRoomMockOptions = {
  ...actorStep('seerCheck', 'seer', 0),
  gameStateOverrides: BLOCKED_AT_SEAT_0,
};

function confirmMockOptions(
  role: 'hunter' | 'darkWolfKing',
  isBlocked: boolean,
): WerewolfRoomMockOptions {
  const step = confirmStep(role === 'hunter' ? 'hunterConfirm' : 'darkWolfKingConfirm', role, 0, {
    role,
    canShoot: true,
  });
  return {
    ...step,
    gameStateOverrides: { ...step.gameStateOverrides, ...(isBlocked ? BLOCKED_AT_SEAT_0 : {}) },
  };
}

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe('Nightmare Blocked UI (server-authoritative)', () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  it('blocked player tapping a seat is inert: the engine hint leaves only the skip', async () => {
    const view = await mountRoomFor(BLOCKED_SEER);

    // The blocked prompt is the engine's override, shown once on entry.
    await waitFor(() =>
      expect(harness.events()).toContainEqual(
        expect.objectContaining({
          title: BLOCKED_UI_DEFAULTS.title,
          message: BLOCKED_UI_DEFAULTS.message,
        }),
      ),
    );
    expect(view.getByText(BLOCKED_UI_DEFAULTS.skipButtonText)).toBeInTheDocument();

    harness.clear();
    await tapSeat(view, 1);

    // No confirm, no client-side "blocked" alert: the client never re-judges the block.
    expect(harness.events()).toEqual([]);
  });

  it('actionRejected with blocked reason shows rejection alert on initial render', async () => {
    // The rejection reaches the UI through the projection (night.rejection),
    // so it must enter the mock as state.
    await mountRoomFor({
      ...actorStep('seerCheck', 'seer', 0),
      gameStateOverrides: {
        nightmareBlockedSeat: 0,
        actionRejected: {
          action: 'seerCheck',
          reason: BLOCKED_UI_DEFAULTS.message,
          targetSeat: 0,
          rejectionId: 'test-rejection-1',
        },
      },
    });

    await waitFor(() =>
      expect(harness.events()).toContainEqual(
        expect.objectContaining({ title: '操作失败', message: BLOCKED_UI_DEFAULTS.message }),
      ),
    );
  });

  it.each(['hunter', 'darkWolfKing'] as const)(
    'confirm schema (%s) shows the skip button when blocked',
    async (role) => {
      const view = await mountRoomFor(confirmMockOptions(role, true));

      // When blocked, the actor sees the skip button instead of the status confirm.
      await waitFor(() => {
        expect(view.queryByText(BLOCKED_UI_DEFAULTS.skipButtonText)).toBeInTheDocument();
        expect(view.getByRole('button', { name: '确认跳过' })).toBeInTheDocument();
      });
    },
  );

  it.each(['hunter', 'darkWolfKing'] as const)(
    'confirm schema (%s) does NOT show the skip button when not blocked',
    async (role) => {
      const view = await mountRoomFor(confirmMockOptions(role, false));

      await waitFor(() =>
        expect(view.queryByText(BLOCKED_UI_DEFAULTS.skipButtonText)).not.toBeInTheDocument(),
      );
    },
  );
});
