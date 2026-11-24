import {
  assertBoardNightScenario,
  collectBoardNightScenarios,
  mountBoardNightState,
  pressStepAction,
  requireBoardNightScenario,
} from '@/games/werewolf/room/__tests__/harness/boardNightScenarios';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const scenarios = collectBoardNightScenarios('预女猎白野');

describe('WerewolfRoomScreen UI: 预女猎白野', () => {
  it('covers the board’s night steps with engine-produced states', () => {
    expect(scenarios.map((scenario) => scenario.presentation.stepId)).toEqual(
      expect.arrayContaining([
        'wolfKill',
        'wildChildChooseIdol',
        'seerCheck',
        'witchAction',
        'hunterConfirm',
      ]),
    );
  });

  it.each(scenarios)('$label submits through the real room screen', async (scenario) => {
    await assertBoardNightScenario(scenario);
  });

  it('marks the required idol choice pending until seat selection begins', async () => {
    const scenario = requireBoardNightScenario(
      scenarios,
      'wildChildChooseIdol',
      'wildChildChooseIdol',
    );
    const { view } = await mountBoardNightState(scenario.state, scenario.viewerSeat);
    const actionId = TESTIDS.stepInteractionButton('wildChildChooseIdol');
    expect(view.getByTestId(actionId)).toHaveAccessibleDescription('有待处理操作');
    await pressStepAction(view, 'wildChildChooseIdol');
    expect(
      view.getByTestId(TESTIDS.stepInteractionButton('cancelSeatSelection')),
    ).not.toHaveAccessibleDescription('有待处理操作');
    await pressStepAction(view, 'cancelSeatSelection');
    expect(view.getByTestId(actionId)).toHaveAccessibleDescription('有待处理操作');
  });
});
