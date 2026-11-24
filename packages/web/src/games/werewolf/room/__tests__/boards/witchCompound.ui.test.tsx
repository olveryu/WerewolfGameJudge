import type { GameState, RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { STEP_SKIP_ACTION_KEY } from '@game-judge/game-engine/platform/steps';
import { waitFor } from '@testing-library/react';

import {
  click,
  recordAlerts,
  RoomScreenTestHarness,
  tapSeat,
} from '@/games/werewolf/room/__tests__/harness';
import {
  createBoardNightState,
  mountBoardNightState,
  pressStepAction,
} from '@/games/werewolf/room/__tests__/harness/boardNightScenarios';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

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

function witchState(wolfTarget: number | null): GameState {
  return createBoardNightState(
    '预女猎白',
    (candidate) => candidate.nightState?.slice.current?.stepId === 'witchAction',
    {
      wolfKill:
        wolfTarget === null
          ? { actionKey: 'wolfKillAbstain' }
          : { actionKey: 'wolfKill', seats: [wolfTarget] },
    },
    roleAssignment,
  );
}

describe('Werewolf witch shared actions', () => {
  let harness: RoomScreenTestHarness;
  let detach: () => void;

  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detach = recordAlerts(harness);
  });
  afterEach(() => detach());

  it('groups the pending choices and restores focus after cancelling seat selection', async () => {
    const { view } = await mountBoardNightState(witchState(1), 9);
    const entry = view.getByTestId(TESTIDS.werewolfNightButton('openActionGroup'));
    expect(entry).toHaveAccessibleDescription('有待处理操作');
    expect(view.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('2号被狼人袭击');
    await click(entry);
    expect(view.getByTestId(TESTIDS.werewolfNightButton('closeActionGroup'))).toHaveFocus();
    expect(view.getByTestId(TESTIDS.stepInteractionButton('antidote'))).toHaveTextContent(
      '对2号用解药',
    );
    await pressStepAction(view, 'poison');
    expect(view.getByTestId(TESTIDS.stepInteractionButton('cancelSeatSelection'))).toHaveFocus();
    await pressStepAction(view, 'cancelSeatSelection');
    expect(view.getByTestId(TESTIDS.werewolfNightButton('openActionGroup'))).toHaveFocus();
  });

  it('explains why self-save is unavailable while allowing poison', async () => {
    const { mock, view } = await mountBoardNightState(witchState(9), 9);
    await pressStepAction(view, 'antidote');
    expect(view.getByTestId(TESTIDS.stepInteractionButton('antidote'))).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(view.getByTestId(TESTIDS.roomHandUnavailableReason)).toHaveTextContent(
      '本局规则不允许自救',
    );
    expect(mock.dispatch).not.toHaveBeenCalled();
    await pressStepAction(view, 'poison');
    await tapSeat(view, 2);
    await harness.pressLastPrimary();
    await waitFor(() =>
      expect(mock.dispatch.mock.calls[0]?.[0]).toMatchObject({
        type: 'werewolf.step.submit',
        submission: { actionKey: 'poison', seats: [2] },
      }),
    );
  });

  it('can cancel a poison confirmation and then submit the selected target', async () => {
    const { mock, view } = await mountBoardNightState(witchState(1), 9);
    await pressStepAction(view, 'poison');
    await tapSeat(view, 2);
    await harness.pressButton('取消');
    expect(mock.dispatch).not.toHaveBeenCalled();
    await tapSeat(view, 2);
    await harness.pressLastPrimary();
    expect(mock.dispatch).toHaveBeenCalledOnce();
    expect(mock.dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: 'werewolf.step.submit',
      submission: { actionKey: 'poison', seats: [2] },
    });
  });

  it('shows a peaceful night and confirms skipping without using a potion', async () => {
    const { mock, view } = await mountBoardNightState(witchState(null), 9);
    expect(view.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('昨夜平安夜');
    await pressStepAction(view, STEP_SKIP_ACTION_KEY);
    await harness.pressLastPrimary();
    expect(mock.dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: 'werewolf.step.submit',
      submission: { actionKey: STEP_SKIP_ACTION_KEY },
    });
  });

  it('still permits skipping when both potions have been used', async () => {
    const state = witchState(null);
    const night = state.nightState;
    if (night === null) throw new Error('[TEST] Missing night state');
    const exhausted: GameState = {
      ...state,
      nightState: {
        ...night,
        roles: {
          ...night.roles,
          usedResources: [
            { roleId: 'witch', seat: 9, resource: 'antidote' },
            { roleId: 'witch', seat: 9, resource: 'poison' },
          ],
        },
      },
    };
    const { mock, view } = await mountBoardNightState(exhausted, 9);
    await pressStepAction(view, 'poison');
    expect(view.getByTestId(TESTIDS.roomHandUnavailableReason)).toHaveTextContent('毒药已用完');
    await pressStepAction(view, STEP_SKIP_ACTION_KEY);
    await harness.pressLastPrimary();
    expect(mock.dispatch).toHaveBeenCalledOnce();
  });
});
