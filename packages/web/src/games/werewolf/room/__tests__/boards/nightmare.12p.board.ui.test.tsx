import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { STEP_SKIP_ACTION_KEY } from '@game-judge/game-engine/platform/steps';
import { waitFor } from '@testing-library/react';

import {
  createWerewolfRoomMockFromState,
  mountWerewolfRoom,
  recordAlerts,
  RoomScreenTestHarness,
} from '@/games/werewolf/room/__tests__/harness';
import {
  assertBoardNightScenario,
  collectBoardNightScenarios,
  createBoardNightState,
  pressStepAction,
} from '@/games/werewolf/room/__tests__/harness/boardNightScenarios';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const scenarios = collectBoardNightScenarios('噩梦之影守卫');
const roles: readonly RoleId[] = [
  'villager',
  'villager',
  'villager',
  'villager',
  'wolf',
  'wolf',
  'wolf',
  'nightmare',
  'seer',
  'witch',
  'hunter',
  'guard',
];
const roleAssignment = new Map(roles.map((role, seat) => [seat, role]));

describe('WerewolfRoomScreen UI: 噩梦之影守卫', () => {
  it('covers the board’s night steps with engine-produced states', () => {
    expect(scenarios.map((scenario) => scenario.presentation.stepId)).toEqual(
      expect.arrayContaining([
        'wolfKill',
        'nightmareBlock',
        'seerCheck',
        'witchAction',
        'hunterConfirm',
        'guardProtect',
      ]),
    );
  });

  it.each(scenarios)('$label submits through the real room screen', async (scenario) => {
    await assertBoardNightScenario(scenario);
  });

  it.each([
    { stepId: 'seerCheck', seat: 8, actionKey: 'seerCheck' },
    { stepId: 'witchAction', seat: 9, actionKey: 'poison' },
  ])(
    'shows the fear reason and lets the blocked $stepId actor skip',
    async ({ stepId, seat, actionKey }) => {
      const state = createBoardNightState(
        '噩梦之影守卫',
        (candidate) => candidate.nightState?.slice.current?.stepId === stepId,
        {
          nightmareBlock: { actionKey: 'nightmareBlock', seats: [seat] },
          wolfKill: { actionKey: 'wolfKillAbstain' },
        },
        roleAssignment,
      );
      const harness = new RoomScreenTestHarness();
      const detach = recordAlerts(harness);
      try {
        const mock = createWerewolfRoomMockFromState(state, seat);
        const view = await mountWerewolfRoom(mock);
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
        await waitFor(() =>
          expect(mock.dispatch.mock.calls[0]?.[0]).toMatchObject({
            type: 'werewolf.step.submit',
            submission: { stepId, actionKey: STEP_SKIP_ACTION_KEY },
          }),
        );
        view.unmount();
      } finally {
        detach();
      }
    },
  );

  it('disables the wolf attack with a visible reason when a wolf is feared', async () => {
    const state = createBoardNightState(
      '噩梦之影守卫',
      (candidate) => candidate.nightState?.slice.current?.stepId === 'wolfKill',
      { nightmareBlock: { actionKey: 'nightmareBlock', seats: [4] } },
      roleAssignment,
    );
    const mock = createWerewolfRoomMockFromState(state, 5);
    const view = await mountWerewolfRoom(mock);
    await pressStepAction(view, 'wolfKill');
    expect(view.getByTestId(TESTIDS.stepInteractionButton('wolfKill'))).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(view.getByTestId(TESTIDS.roomHandUnavailableReason)).toHaveTextContent(
      '被噩梦之影恐惧，本夜无法袭击',
    );
    expect(mock.dispatch).not.toHaveBeenCalled();
    view.unmount();
  });
});
