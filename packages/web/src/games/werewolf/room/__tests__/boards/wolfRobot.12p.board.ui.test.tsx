import { getWerewolfViewModel, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
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

const scenarios = collectBoardNightScenarios('机械狼人通灵师');
const roles: readonly RoleId[] = [
  'villager',
  'villager',
  'villager',
  'villager',
  'wolf',
  'wolf',
  'wolf',
  'wolfRobot',
  'psychic',
  'witch',
  'hunter',
  'guard',
];
const roleAssignment = new Map(roles.map((role, seat) => [seat, role]));

describe('WerewolfRoomScreen UI: 机械狼人通灵师', () => {
  it('covers the board’s night steps with engine-produced states', () => {
    expect(scenarios.map((scenario) => scenario.presentation.stepId)).toEqual(
      expect.arrayContaining([
        'wolfKill',
        'wolfRobotLearn',
        'psychicCheck',
        'witchAction',
        'hunterConfirm',
        'guardProtect',
      ]),
    );
  });

  it.each(scenarios)('$label submits through the real room screen', async (scenario) => {
    await assertBoardNightScenario(scenario);
  });

  it('requires the hunter status acknowledgement after learning hunter without reopening it', async () => {
    const state = createBoardNightState(
      '机械狼人通灵师',
      (candidate) =>
        getWerewolfViewModel(candidate, { seat: 7, isHost: false }).step?.actions.some(
          (action) =>
            action.key === 'wolfRobotHunterStatus' && action.availability.kind === 'available',
        ) === true,
      { wolfRobotLearn: { actionKey: 'wolfRobotLearn', seats: [10] } },
      roleAssignment,
    );
    const harness = new RoomScreenTestHarness();
    const detach = recordAlerts(harness);
    try {
      const mock = createWerewolfRoomMockFromState(state, 7);
      const view = await mountWerewolfRoom(mock);
      expect(view.queryByTestId(TESTIDS.stepInteractionButton('wolfRobotLearn'))).toBeNull();
      expect(view.queryByTestId(TESTIDS.stepInteractionButton('$skip'))).toBeNull();
      await pressStepAction(view, 'wolfRobotHunterStatus');
      expect(harness.getLastEvent()?.buttons).toEqual(['取消', '查看']);
      await harness.pressLastPrimary();
      expect(harness.getLastEvent()?.title).toBe('技能状态');
      expect(harness.getLastEvent()?.message).toContain('发动技能');
      await harness.pressLastPrimary();
      await waitFor(() =>
        expect(
          mock.dispatch.mock.calls.find(
            ([command]) => command.type === 'werewolf.step.submit',
          )?.[0],
        ).toMatchObject({
          type: 'werewolf.step.submit',
          submission: {
            stepId: 'wolfRobotLearn',
            actionKey: 'wolfRobotHunterStatus',
          },
        }),
      );
      await waitFor(() =>
        expect(
          view.queryByTestId(TESTIDS.stepInteractionButton('wolfRobotHunterStatus')),
        ).toBeNull(),
      );
      expect(harness.events().filter((event) => event.title === '技能状态')).toHaveLength(1);
      view.unmount();
    } finally {
      detach();
    }
  });
});
