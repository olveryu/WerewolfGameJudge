import { getWerewolfViewModel } from '@game-judge/game-engine/games/werewolf/public';

import {
  recordAlerts,
  RoomScreenTestHarness,
  tapSeat,
} from '@/games/werewolf/room/__tests__/harness';
import {
  collectBoardNightScenarios,
  mountBoardNightState,
  requireBoardNightScenario,
} from '@/games/werewolf/room/__tests__/harness/boardNightScenarios';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const scenarios = collectBoardNightScenarios('预女猎白');

describe('Werewolf shared-step non-actor perspective', () => {
  let harness: RoomScreenTestHarness;
  let detach: () => void;

  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detach = recordAlerts(harness);
  });
  afterEach(() => detach());

  it.each([
    { stepId: 'wolfKill', actionKey: 'wolfKill' },
    { stepId: 'witchAction', actionKey: 'poison' },
    { stepId: 'hunterConfirm', actionKey: 'hunterConfirm' },
    { stepId: 'seerCheck', actionKey: 'seerCheck' },
  ])('does not expose $stepId actions or private information', async ({ stepId, actionKey }) => {
    const scenario = requireBoardNightScenario(scenarios, stepId, actionKey);
    const night = scenario.state.nightState;
    if (night === null) throw new Error('[TEST] Missing active night');
    const viewerSeat = night.roles.seatedSeats.find(
      (seat) =>
        seat !== 0 &&
        getWerewolfViewModel(scenario.state, { seat, isHost: false }).step?.isActor === false,
    );
    if (viewerSeat === undefined) throw new Error(`[TEST] No non-actor for ${stepId}`);
    const { mock, view } = await mountBoardNightState(scenario.state, viewerSeat);
    expect(view.queryByTestId(TESTIDS.stepInteractionButton(actionKey))).not.toBeInTheDocument();
    expect(
      view.queryByTestId(TESTIDS.werewolfNightButton('openActionGroup')),
    ).not.toBeInTheDocument();
    expect(harness.events()).toEqual([]);
    await tapSeat(view, scenario.viewerSeat);
    expect(view.getByTestId(TESTIDS.seatTilePressable(scenario.viewerSeat))).not.toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(mock.dispatch).not.toHaveBeenCalled();
    if (stepId === 'witchAction') {
      expect(view.getByTestId(TESTIDS.actionMessage)).not.toHaveTextContent('被狼人袭击');
    }
  });
});
