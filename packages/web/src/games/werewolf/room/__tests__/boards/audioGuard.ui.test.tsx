/**
 * Audio Guard UI Test
 *
 * Tests that UI interactions are properly blocked when isAudioPlaying=true.
 * All existing board tests use isAudioPlaying=false — this file covers the guard.
 *
 * Verifies:
 * - Seat taps do NOT trigger dialogs when audio is playing
 * - Bottom action buttons are NOT rendered when audio is playing
 */

import {
  type GameState,
  GameStatus,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { STEP_SKIP_ACTION_KEY } from '@game-judge/game-engine/platform/steps';
import { act, waitFor } from '@testing-library/react';

import {
  actorStep,
  click,
  createWerewolfRoomMock,
  createWerewolfRoomMockFromState,
  mountRoomFor as mount,
  mountWerewolfRoom,
  recordAlerts,
  RoomScreenTestHarness,
  tapSeat,
  type WerewolfRoomMockOptions,
} from '@/games/werewolf/room/__tests__/harness';
import {
  createBoardNightState,
  mountBoardNightState,
  pressStepAction,
} from '@/games/werewolf/room/__tests__/harness/boardNightScenarios';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const seerStep = (isAudioPlaying: boolean): WerewolfRoomMockOptions => ({
  ...actorStep('seerCheck', 'seer', 8),
  isAudioPlaying,
});
const roles: readonly RoleId[] = [
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
const roleAssignment = new Map(roles.map((role, seat) => [seat, role]));
const wolfState = createBoardNightState(
  '预女猎白',
  (state) => state.nightState?.slice.current?.stepId === 'wolfKill',
  {},
  roleAssignment,
);
const seerState = createBoardNightState(
  '预女猎白',
  (state) => state.nightState?.slice.current?.stepId === 'seerCheck',
  { wolfKill: { actionKey: 'wolfKillAbstain' } },
  roleAssignment,
);

function withAudio(state: GameState, isAudioPlaying: boolean): GameState {
  return {
    ...state,
    isAudioPlaying,
    pendingAudioEffects: isAudioPlaying ? [{ audioKey: 'seer' }] : [],
  };
}

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe('Audio Guard (isAudioPlaying=true)', () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });

  describe('host music toggle visibility', () => {
    it.each(Object.values(GameStatus))(
      'only shows during the night, not %s otherwise',
      async (status) => {
        const view = await mount({
          ...seerStep(false),
          isHost: true,
          gameStateOverrides: { status },
        });

        expect(view.queryByTestId(TESTIDS.bgmToggleButton) !== null).toBe(
          status === GameStatus.Ongoing,
        );
      },
    );

    it('does not show for a non-host at night', async () => {
      const view = await mount(seerStep(false));
      expect(view.queryByTestId(TESTIDS.bgmToggleButton)).not.toBeInTheDocument();
    });
  });
  afterEach(() => detachAlerts());

  describe('night re-entry', () => {
    it('asks the host to continue and restarts music even when no narration is pending', async () => {
      const mock = createWerewolfRoomMock({ ...seerStep(false), isHost: true });
      const view = await mountWerewolfRoom(mock);

      expect(view.getByRole('alertdialog', { name: '游戏已恢复' })).toBeVisible();
      expect(mock.audio.isBgmPlaying()).toBe(false);
      await click(view.getByRole('button', { name: '继续游戏' }));
      expect(mock.audio.isBgmPlaying()).toBe(true);
      await waitFor(() => {
        expect(view.queryByRole('alertdialog', { name: '游戏已恢复' })).not.toBeInTheDocument();
      });
    });
  });

  describe('daytime narration recovery', () => {
    it('shows the existing continue dialog and replays the daytime batch before acknowledging', async () => {
      const mock = createWerewolfRoomMock({
        ...seerStep(true),
        isHost: true,
        gameStateOverrides: {
          status: GameStatus.Day,
          pendingAudioEffects: [{ audioKey: 'sheriff_signup' }],
          audioBatchId: 3,
        },
      });
      const playEffect = vi.spyOn(mock.audio, 'playEffect');
      const view = await mountWerewolfRoom(mock);

      expect(view.getByRole('alertdialog', { name: '游戏已恢复' })).toBeInTheDocument();
      expect(playEffect).not.toHaveBeenCalled();
      expect(mock.dispatch).not.toHaveBeenCalled();

      await click(view.getByRole('button', { name: '继续游戏' }));

      await waitFor(() => {
        expect(playEffect).toHaveBeenCalledExactlyOnceWith('sheriff_signup', undefined);
        expect(mock.dispatch).toHaveBeenCalledWith(
          { type: 'werewolf.audio.ack', audioBatchId: 3 },
          { controlledSeat: null, label: '播报确认', durable: true },
        );
      });
      await waitFor(() => {
        expect(view.queryByRole('alertdialog', { name: '游戏已恢复' })).not.toBeInTheDocument();
      });
    });

    it.each([
      { isHost: true, isAudioPlaying: false },
      { isHost: false, isAudioPlaying: true },
    ])(
      'does not prompt for $isHost host and $isAudioPlaying pending narration',
      async (options) => {
        const view = await mount({
          ...seerStep(options.isAudioPlaying),
          isHost: options.isHost,
          gameStateOverrides: { status: GameStatus.Day },
        });

        expect(view.queryByRole('alertdialog', { name: '游戏已恢复' })).not.toBeInTheDocument();
      },
    );
  });

  describe('seat tap blocked during audio', () => {
    it('seer cannot draft a seat while audio plays', async () => {
      const { view } = await mountBoardNightState(withAudio(seerState, true), 8);
      harness.clear();

      await tapSeat(view, 1);

      expect(view.queryByTestId(TESTIDS.stepInteractionButton('seerCheck'))).toBeNull();
      expect(view.getByTestId(TESTIDS.seatTilePressable(1))).not.toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(harness.hasSeen('actionPrompt')).toBe(false);
    });

    it('wolf cannot draft a seat while audio plays', async () => {
      const { view } = await mountBoardNightState(withAudio(wolfState, true), 4);
      harness.clear();

      await tapSeat(view, 1);

      expect(view.queryByTestId(TESTIDS.stepInteractionButton('wolfKill'))).toBeNull();
      expect(view.getByTestId(TESTIDS.seatTilePressable(1))).not.toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  describe('bottom action buttons hidden during audio', () => {
    it('hides the entire hand, including host and resource cards, while narration plays', async () => {
      const view = await mount({ ...seerStep(true), isHost: true });

      expect(view.queryByTestId(TESTIDS.bottomActionPanel)).not.toBeInTheDocument();
      expect(view.queryByTestId(TESTIDS.roomMoreActionsButton)).not.toBeInTheDocument();
    });

    it('closes the host hand on narration and restores the player hand afterward', async () => {
      const { mock, view } = await mountBoardNightState(seerState, 0);
      await click(view.getByTestId(TESTIDS.roomMoreActionsButton));
      expect(view.getByTestId(TESTIDS.roomHostManagementPanel)).toBeInTheDocument();

      act(() => mock.session.publishRoom(createRoomSnapshot(withAudio(mock.state, true), 2)));
      expect(view.queryByTestId(TESTIDS.bottomActionPanel)).not.toBeInTheDocument();
      expect(view.queryByTestId(TESTIDS.roomHostManagementPanel)).not.toBeInTheDocument();

      act(() => mock.session.publishRoom(createRoomSnapshot(withAudio(mock.state, false), 3)));
      expect(view.getByTestId(TESTIDS.roomMoreActionsButton)).toBeInTheDocument();
      expect(view.queryByTestId(TESTIDS.roomHostManagementPanel)).not.toBeInTheDocument();
    });

    it('restores an open role hand after narration without losing its selection context', async () => {
      const mock = createWerewolfRoomMockFromState(seerState, 8);
      const view = await mountWerewolfRoom(mock);
      await click(view.getByTestId(TESTIDS.werewolfNightButton('openActionGroup')));
      expect(view.getByTestId(TESTIDS.werewolfNightButton('closeActionGroup'))).toBeVisible();

      act(() => mock.session.publishRoom(createRoomSnapshot(withAudio(mock.state, true), 2)));
      expect(view.queryByTestId(TESTIDS.bottomActionPanel)).not.toBeInTheDocument();

      act(() => mock.session.publishRoom(createRoomSnapshot(withAudio(mock.state, false), 3)));
      expect(view.getByTestId(TESTIDS.werewolfNightButton('closeActionGroup'))).toBeVisible();
    });

    it('seer skip button is not visible when isAudioPlaying=true', async () => {
      const { view } = await mountBoardNightState(withAudio(seerState, true), 8);

      expect(
        view.queryByTestId(TESTIDS.stepInteractionButton(STEP_SKIP_ACTION_KEY)),
      ).not.toBeInTheDocument();
    });

    it('wolf empty knife button is not visible when isAudioPlaying=true', async () => {
      const { view } = await mountBoardNightState(withAudio(wolfState, true), 4);

      expect(
        view.queryByTestId(TESTIDS.stepInteractionButton('wolfKillAbstain')),
      ).not.toBeInTheDocument();
    });
  });

  describe('audio off → interactions work normally', () => {
    it('seer seat tap works when isAudioPlaying=false (control test)', async () => {
      const { view } = await mountBoardNightState(seerState, 8);
      await pressStepAction(view, 'seerCheck');
      await tapSeat(view, 1);
      expect(view.getByTestId(TESTIDS.seatTilePressable(1))).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });
});
