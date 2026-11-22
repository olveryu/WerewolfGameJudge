/** Host sub-hand commands report their submission on the entry that opened them. */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act } from '@testing-library/react';

import type { WerewolfDispatchOutcome } from '@/games/werewolf/room/__tests__/harness';
import {
  click,
  createWerewolfRoomMock,
  mountWerewolfRoom,
  recordAlerts,
  RoomScreenTestHarness,
} from '@/games/werewolf/room/__tests__/harness';
import { TEST_USER_ID } from '@/games/werewolf/room/__tests__/harness/testAuthContext';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('./harness/testAuthContext'));

describe('Werewolf host entry submission', () => {
  it('spins the host entry while filling bots and restores it after a failed delivery', async () => {
    const harness = new RoomScreenTestHarness();
    const detachAlerts = recordAlerts(harness);
    let settle: ((outcome: WerewolfDispatchOutcome) => void) | null = null;
    try {
      const mock = createWerewolfRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'villager',
        mySeat: 0,
        numberOfPlayers: 4,
        isHost: true,
        gameStateOverrides: {
          status: GameStatus.Unseated,
          players: { 0: { seat: 0, role: null } },
          roster: { 0: { seat: 0, userId: TEST_USER_ID, profile: { displayName: 'P1' } } },
        },
        hookOverrides: {
          dispatchCommand: () =>
            new Promise((resolve) => {
              settle = resolve;
            }),
        },
      });
      const screen = await mountWerewolfRoom(mock);

      await click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
      await click(screen.getByTestId(TESTIDS.roomFillBotsButton));
      // The confirmation resolves only once the held delivery settles.
      const confirmation = harness.startPressingButton('确定');

      const entry = screen.getByTestId(TESTIDS.roomMoreActionsButton);
      expect(entry).toHaveAttribute('aria-busy', 'true');
      expect(mock.dispatch).toHaveBeenCalledWith({ type: 'room.seat.fillBots' }, expect.anything());
      expect(entry).toHaveAttribute('aria-disabled', 'true');
      expect(entry).toHaveFocus();
      await click(entry);
      expect(screen.queryByTestId(TESTIDS.roomFillBotsButton)).not.toBeInTheDocument();

      await act(async () => {
        settle?.({ kind: 'undelivered', commandId: 'fill-bots', cause: 'network' });
        await confirmation;
      });
      expect(entry).toHaveAttribute('aria-busy', 'false');
      expect(entry).not.toHaveAttribute('aria-disabled');
      await click(entry);
      expect(screen.getByTestId(TESTIDS.roomFillBotsButton)).toBeInTheDocument();
    } finally {
      detachAlerts();
    }
  });
});
