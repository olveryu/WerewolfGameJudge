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

import { GameStatus, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
  mountRoomFor as mount,
  recordAlerts,
  requireBottomActionText,
  requireEmptyVoteText,
  RoomScreenTestHarness,
  tapSeat,
  type WerewolfRoomMockOptions,
  wolfKillStep,
} from '@/games/werewolf/room/__tests__/harness';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const WOLVES = new Map<number, RoleId>([
  [4, 'wolf'],
  [5, 'wolf'],
  [6, 'wolf'],
  [7, 'wolf'],
]);
const seerStep = (isAudioPlaying: boolean): WerewolfRoomMockOptions => ({
  ...actorStep('seerCheck', 'seer', 8),
  isAudioPlaying,
});
const WOLF_STEP_DURING_AUDIO: WerewolfRoomMockOptions = {
  ...wolfKillStep('wolf', 4, WOLVES),
  isAudioPlaying: true,
};

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

  describe('seat tap blocked during audio', () => {
    it('seer seat tap produces no dialog when isAudioPlaying=true', async () => {
      const view = await mount(seerStep(true));
      harness.clear();

      await tapSeat(view, 1);

      expect(harness.hasSeen('actionConfirm')).toBe(false);
      expect(harness.hasSeen('actionPrompt')).toBe(false);
    });

    it('wolf seat tap produces no dialog when isAudioPlaying=true', async () => {
      const view = await mount(WOLF_STEP_DURING_AUDIO);
      harness.clear();

      await tapSeat(view, 1);

      expect(harness.hasSeen('wolfVote')).toBe(false);
    });
  });

  describe('bottom action buttons hidden during audio', () => {
    it('seer skip button is not visible when isAudioPlaying=true', async () => {
      const view = await mount(seerStep(true));

      expect(view.queryByText(requireBottomActionText('seerCheck'))).not.toBeInTheDocument();
    });

    it('wolf empty knife button is not visible when isAudioPlaying=true', async () => {
      const view = await mount(WOLF_STEP_DURING_AUDIO);

      expect(view.queryByText(requireEmptyVoteText())).not.toBeInTheDocument();
    });
  });

  describe('audio off → interactions work normally', () => {
    it('seer seat tap works when isAudioPlaying=false (control test)', async () => {
      const view = await mount(seerStep(false));
      harness.clear();

      await tapSeat(view, 1);

      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });
});
