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

const scenarios = collectBoardNightScenarios('种狼骑士');
const roles: readonly RoleId[] = [
  'villager',
  'villager',
  'villager',
  'villager',
  'wolf',
  'wolf',
  'wolf',
  'seedWolf',
  'seer',
  'witch',
  'knight',
  'guard',
];
const roleAssignment = new Map(roles.map((role, seat) => [seat, role]));

describe('WerewolfRoomScreen UI: 种狼骑士', () => {
  it('covers the board’s night steps with engine-produced states', () => {
    expect(scenarios.map((scenario) => scenario.presentation.stepId)).toEqual(
      expect.arrayContaining([
        'wolfKill',
        'seedWolfInfect',
        'seedWolfInfectReveal',
        'seerCheck',
        'witchAction',
        'guardProtect',
      ]),
    );
  });

  it.each(scenarios)('$label submits through the real room screen', async (scenario) => {
    await assertBoardNightScenario(scenario);
  });

  it('explains unavailable infection after an empty wolf vote and permits skipping', async () => {
    const state = createBoardNightState(
      '种狼骑士',
      (candidate) => candidate.nightState?.slice.current?.stepId === 'seedWolfInfect',
      { wolfKill: { actionKey: 'wolfKillAbstain' } },
      roleAssignment,
    );
    const harness = new RoomScreenTestHarness();
    const detach = recordAlerts(harness);
    try {
      const mock = createWerewolfRoomMockFromState(state, 7);
      const view = await mountWerewolfRoom(mock);
      await pressStepAction(view, 'seedWolfInfect');
      expect(view.getByTestId(TESTIDS.stepInteractionButton('seedWolfInfect'))).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(view.getByTestId(TESTIDS.roomHandUnavailableReason)).toHaveTextContent(
        '本夜没有可感染的狼人袭击目标',
      );
      expect(mock.dispatch).not.toHaveBeenCalled();
      await pressStepAction(view, STEP_SKIP_ACTION_KEY);
      await harness.pressLastPrimary();
      await waitFor(() =>
        expect(mock.dispatch.mock.calls[0]?.[0]).toMatchObject({
          type: 'werewolf.step.submit',
          submission: { actionKey: STEP_SKIP_ACTION_KEY },
        }),
      );
      view.unmount();
    } finally {
      detach();
    }
  });

  it('lets the infected player cancel and then acknowledge their private result', async () => {
    const state = createBoardNightState(
      '种狼骑士',
      (candidate) => candidate.nightState?.slice.current?.stepId === 'seedWolfInfectReveal',
      {
        wolfKill: { actionKey: 'wolfKill', seats: [1] },
        guardProtect: { actionKey: STEP_SKIP_ACTION_KEY },
        witchAction: { actionKey: STEP_SKIP_ACTION_KEY },
      },
      roleAssignment,
    );
    const harness = new RoomScreenTestHarness();
    const detach = recordAlerts(harness);
    try {
      const mock = createWerewolfRoomMockFromState(state, 1);
      const view = await mountWerewolfRoom(mock);
      await pressStepAction(view, 'seedWolfInfectReveal');
      expect(harness.getLastEvent()?.buttons).toEqual(['取消', '查看']);
      await harness.pressButton('取消');
      expect(mock.dispatch).not.toHaveBeenCalled();
      await pressStepAction(view, 'seedWolfInfectReveal');
      await harness.pressLastPrimary();
      expect(harness.getLastEvent()?.message).toBe('你已被种狼感染并转化为普通狼人');
      await harness.pressLastPrimary();
      await waitFor(() =>
        expect(mock.dispatch.mock.calls[0]?.[0]).toMatchObject({
          type: 'werewolf.step.submit',
          submission: {
            stepId: 'seedWolfInfectReveal',
            actionKey: 'seedWolfInfectReveal',
          },
        }),
      );
      view.unmount();
    } finally {
      detach();
    }
  });
});
