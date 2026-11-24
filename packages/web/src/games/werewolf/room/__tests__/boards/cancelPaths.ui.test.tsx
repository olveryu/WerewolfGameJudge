import { STEP_SKIP_ACTION_KEY } from '@game-judge/game-engine/platform/steps';

import {
  click,
  recordAlerts,
  RoomScreenTestHarness,
  tapSeat,
} from '@/games/werewolf/room/__tests__/harness';
import {
  collectBoardNightScenarios,
  mountBoardNightState,
  pressStepAction,
  requireBoardNightScenario,
} from '@/games/werewolf/room/__tests__/harness/boardNightScenarios';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const standard = collectBoardNightScenarios('预女猎白');
const magician = collectBoardNightScenarios('狼王魔术师');
const thief = collectBoardNightScenarios('盗贼丘比特');

describe('Werewolf shared-step cancellation', () => {
  let harness: RoomScreenTestHarness;
  let detach: () => void;

  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detach = recordAlerts(harness);
  });
  afterEach(() => detach());

  it.each([
    { stepId: 'wolfKill', actionKey: 'wolfKill' },
    { stepId: 'seerCheck', actionKey: 'seerCheck' },
    { stepId: 'witchAction', actionKey: 'poison' },
  ])('cancels the $stepId seat confirmation without submitting', async ({ stepId, actionKey }) => {
    const scenario = requireBoardNightScenario(standard, stepId, actionKey);
    const { mock, view } = await mountBoardNightState(scenario.state, scenario.viewerSeat);
    await pressStepAction(view, actionKey);
    const seat = scenario.submission.seats?.[0];
    if (seat === undefined) throw new Error('[TEST] Missing seat choice');
    await tapSeat(view, seat);
    await harness.pressButton('取消');
    expect(view.getByTestId(TESTIDS.seatTilePressable(seat))).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(mock.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    { stepId: 'wolfKill', actionKey: 'wolfKillAbstain' },
    { stepId: 'seerCheck', actionKey: STEP_SKIP_ACTION_KEY },
  ])(
    'cancels the $stepId direct confirmation without submitting',
    async ({ stepId, actionKey }) => {
      const scenario = requireBoardNightScenario(standard, stepId, actionKey);
      const { mock, view } = await mountBoardNightState(scenario.state, scenario.viewerSeat);
      await pressStepAction(view, actionKey);
      await harness.pressButton('取消');
      expect(mock.dispatch).not.toHaveBeenCalled();
    },
  );

  it('clears both magician picks on cancel and keeps a single new pick unsubmitted', async () => {
    const scenario = requireBoardNightScenario(magician, 'magicianSwap', 'magicianSwap');
    const { mock, view } = await mountBoardNightState(scenario.state, scenario.viewerSeat);
    await pressStepAction(view, 'magicianSwap');
    const [first, second] = scenario.submission.seats ?? [];
    if (first === undefined || second === undefined) throw new Error('[TEST] Missing swap seats');
    await tapSeat(view, first);
    expect(harness.getLastEvent()).toBeNull();
    expect(mock.dispatch).not.toHaveBeenCalled();
    await tapSeat(view, second);
    await harness.pressButton('取消');
    expect(view.getByTestId(TESTIDS.seatTilePressable(first))).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(view.getByTestId(TESTIDS.seatTilePressable(second))).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await tapSeat(view, first);
    expect(harness.events()).toHaveLength(1);
    expect(mock.dispatch).not.toHaveBeenCalled();
  });

  it('cancels a private status prompt without acknowledging it', async () => {
    const scenario = requireBoardNightScenario(standard, 'hunterConfirm', 'hunterConfirm');
    const { mock, view } = await mountBoardNightState(scenario.state, scenario.viewerSeat);
    await pressStepAction(view, 'hunterConfirm');
    expect(harness.getLastEvent()?.buttons).toEqual(['取消', '查看']);
    await harness.pressButton('取消');
    expect(mock.dispatch).not.toHaveBeenCalled();
  });

  it('closes the bottom-card picker without submitting a choice', async () => {
    const scenario = requireBoardNightScenario(thief, 'thiefChoose', 'thiefChoose');
    const { mock, view } = await mountBoardNightState(scenario.state, scenario.viewerSeat);
    await pressStepAction(view, 'thiefChoose');
    expect(view.getByTestId(TESTIDS.stepCardPicker)).toBeVisible();
    await click(view.getByRole('button', { name: '取消' }));
    expect(view.queryByTestId(TESTIDS.stepCardPicker)).not.toBeInTheDocument();
    expect(mock.dispatch).not.toHaveBeenCalled();
  });
});
