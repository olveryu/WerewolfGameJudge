import type { GameState, RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { REASON_STEP_STALE, STEP_SKIP_ACTION_KEY } from '@game-judge/game-engine/platform/steps';
import { waitFor } from '@testing-library/react';

import {
  recordAlerts,
  RoomScreenTestHarness,
  tapSeat,
} from '@/games/werewolf/room/__tests__/harness';
import {
  createBoardNightState,
  mountBoardNightState,
  pressStepAction,
} from '@/games/werewolf/room/__tests__/harness/boardNightScenarios';
import { rejectedRoomCommand } from '@/test-utils/roomCommand';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('./harness/testAuthContext'));

const roles: readonly RoleId[] = [
  'villager',
  'villager',
  'villager',
  'villager',
  'wolf',
  'wolf',
  'nightmare',
  'darkWolfKing',
  'hunter',
  'wolfRobot',
  'seer',
  'witch',
];
const roleAssignment = new Map(roles.map((role, seat) => [seat, role]));

describe('Werewolf fear and stale-step feedback', () => {
  let harness: RoomScreenTestHarness;
  let detach: () => void;

  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detach = recordAlerts(harness);
  });
  afterEach(() => detach());

  it.each([
    { stepId: 'hunterConfirm', seat: 8, actionKey: 'hunterConfirm' },
    { stepId: 'darkWolfKingConfirm', seat: 7, actionKey: 'darkWolfKingConfirm' },
    { stepId: 'wolfRobotLearn', seat: 9, actionKey: 'wolfRobotLearn' },
  ])(
    'blocks $stepId when its actor is feared and allows skipping',
    async ({ stepId, seat, actionKey }) => {
      const state = createBoardNightState(
        roles,
        (candidate) => candidate.nightState?.slice.current?.stepId === stepId,
        {
          nightmareBlock: { actionKey: 'nightmareBlock', seats: [seat] },
          wolfKill: { actionKey: 'wolfKillAbstain' },
        },
        roleAssignment,
      );
      const { mock, view } = await mountBoardNightState(state, seat);
      await pressStepAction(view, actionKey);
      expect(view.getByTestId(TESTIDS.stepInteractionButton(actionKey))).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(view.getByTestId(TESTIDS.roomHandUnavailableReason)).toHaveTextContent(
        '被噩梦之影恐惧，本夜无法使用技能',
      );
      expect(mock.dispatch).not.toHaveBeenCalled();
      await pressStepAction(view, STEP_SKIP_ACTION_KEY);
      await harness.pressLastPrimary();
      expect(mock.dispatch.mock.calls[0]?.[0]).toMatchObject({
        type: 'werewolf.step.submit',
        submission: { stepId, actionKey: STEP_SKIP_ACTION_KEY },
      });
    },
  );

  it('shows the common stale-step message when an action is rejected', async () => {
    const state = createBoardNightState(
      roles,
      (candidate) => candidate.nightState?.slice.current?.stepId === 'seerCheck',
      {
        nightmareBlock: { actionKey: STEP_SKIP_ACTION_KEY },
        wolfKill: { actionKey: 'wolfKillAbstain' },
      },
      roleAssignment,
    );
    const { mock, view } = await mountBoardNightState(state, 10);
    mock.dispatch.mockResolvedValueOnce(rejectedRoomCommand<GameState>(REASON_STEP_STALE));
    await pressStepAction(view, 'seerCheck');
    await tapSeat(view, 0);
    await harness.pressLastPrimary();
    await waitFor(() => {
      expect(harness.getLastEvent()?.title).toBe('操作失败');
      expect(harness.getLastEvent()?.message).toBe('当前行动步骤已变化，请重新选择');
    });
  });
});
