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
import { fireEvent, waitFor } from '@testing-library/react';

import {
  actorStep,
  confirmStep,
  mountRoomFor,
  openNightActionGroup,
  pressText,
  recordAlerts,
  RoomScreenTestHarness,
  tapSeat,
  type WerewolfRoomMockOptions,
} from '@/games/werewolf/room/__tests__/harness';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('./harness/testAuthContext'));

const BLOCKED_AT_SEAT_0 = { nightmareBlockedSeat: 0, currentNightResults: { blockedSeat: 0 } };

/** A nightmare-blocked actor at seat 0 (the engine hint follows from the blocked seat). */
const BLOCKED_SEER: WerewolfRoomMockOptions = {
  ...actorStep('seerCheck', 'seer', 0),
  gameStateOverrides: BLOCKED_AT_SEAT_0,
};

const BLOCKED_WITCH: WerewolfRoomMockOptions = {
  ...actorStep('witchAction', 'witch', 0),
  gameStateOverrides: {
    ...BLOCKED_AT_SEAT_0,
    witchContext: { killedSeat: 2, canSave: true, canPoison: true },
  },
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

  it('retains the locked action and requires confirmation to skip', async () => {
    const view = await mountRoomFor(BLOCKED_SEER);

    expect(view.getByTestId(TESTIDS.actionMessage)).toHaveTextContent(BLOCKED_UI_DEFAULTS.message);
    expect(harness.events()).toEqual([]);
    await openNightActionGroup(view);
    expect(view.getByTestId(TESTIDS.werewolfNightButton('startSeatSelection'))).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    harness.clear();
    await tapSeat(view, 1);

    // No confirm, no client-side "blocked" alert: the client never re-judges the block.
    expect(harness.events()).toEqual([]);
    await pressText(view, '确认跳过');
    expect(harness.getLastEvent()?.buttons).toEqual(['取消', '确定']);
  });

  it('does not expose the witch target or potions while Nightmare blocks the action', async () => {
    const view = await mountRoomFor(BLOCKED_WITCH);

    expect(view.getByTestId(TESTIDS.actionMessage)).toHaveTextContent(BLOCKED_UI_DEFAULTS.message);
    await openNightActionGroup(view);

    expect(view.queryByTestId(TESTIDS.werewolfNightButton('save'))).toBeNull();
    expect(view.queryByText(/对3号用解药|用毒药/)).toBeNull();
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
      await openNightActionGroup(view);
      const moreActionsButton = view.queryByTestId(TESTIDS.roomMoreActionsButton);
      if (moreActionsButton !== null) fireEvent.click(moreActionsButton);

      // When blocked, the actor sees the skip button instead of the status confirm.
      await waitFor(() => {
        expect(view.getByTestId(TESTIDS.actionMessage)).toHaveTextContent(
          BLOCKED_UI_DEFAULTS.message,
        );
        expect(view.getByTestId(TESTIDS.werewolfNightButton('confirm'))).toHaveAttribute(
          'aria-disabled',
          'true',
        );
      });
      await pressText(view, '确认跳过');
      expect(harness.getLastEvent()?.buttons).toEqual(['取消', '确定']);
    },
  );

  it.each(['hunter', 'darkWolfKing'] as const)(
    'confirm schema (%s) does NOT show the skip button when not blocked',
    async (role) => {
      const view = await mountRoomFor(confirmMockOptions(role, false));

      await waitFor(() =>
        expect(view.getByTestId(TESTIDS.actionMessage)).not.toHaveTextContent(
          BLOCKED_UI_DEFAULTS.message,
        ),
      );
    },
  );
});
