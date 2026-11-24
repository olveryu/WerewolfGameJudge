import type { GameState, RoleId } from '@game-judge/game-engine/games/werewolf/public';

import {
  getDispatchOutcome,
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

vi.mock('@/contexts/AuthContext', () => import('./harness/testAuthContext'));

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

function witchState(wolfTarget: number, witchCanSelfHeal = false): GameState {
  return createBoardNightState(
    '预女猎白',
    (candidate) => candidate.nightState?.slice.current?.stepId === 'witchAction',
    { wolfKill: { actionKey: 'wolfKill', seats: [wolfTarget] } },
    roleAssignment,
    { witchCanSelfHeal },
  );
}

describe('Werewolf witch antidote', () => {
  let harness: RoomScreenTestHarness;
  let detach: () => void;

  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detach = recordAlerts(harness);
  });
  afterEach(() => detach());

  it('uses the authoritative attack target rather than a tapped seat', async () => {
    const state = witchState(2);
    const { mock, view } = await mountBoardNightState(state, 9);
    expect(view.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('3号被狼人袭击');
    await tapSeat(view, 5);
    expect(mock.dispatch).not.toHaveBeenCalled();
    await pressStepAction(view, 'antidote');
    expect(harness.getLastEvent()?.title).toBe('对3号用解药？');
    await harness.pressLastPrimary();
    expect(mock.dispatch.mock.calls[0]?.[0]).toEqual({
      type: 'werewolf.step.submit',
      gameSequence: state.gameSequence,
      submission: {
        stepId: 'witchAction',
        serial: state.nightState?.slice.current?.serial,
        actionKey: 'antidote',
      },
    });
    const result = await getDispatchOutcome(mock, 0);
    expect(result.kind).toBe('committed');
    if (result.kind === 'committed') {
      expect(result.outcome.kind).toBe('success');
      expect(result.snapshot.state.nightState?.facts.deathEffects).toContainEqual(
        expect.objectContaining({ kind: 'protect', target: 2 }),
      );
    }
  });

  it.each([false, true])(
    'shows the self-attack and applies the self-save rule when enabled=%s',
    async (witchCanSelfHeal) => {
      const { mock, view } = await mountBoardNightState(witchState(9, witchCanSelfHeal), 9);
      expect(harness.events()).toEqual([]);
      expect(view.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('你被狼人袭击');
      await pressStepAction(view, 'antidote');
      if (!witchCanSelfHeal) {
        const save = view.getByTestId(TESTIDS.stepInteractionButton('antidote'));
        expect(save).toHaveAttribute('aria-disabled', 'true');
        expect(view.getByTestId(TESTIDS.roomHandUnavailableReason)).toHaveTextContent(
          '本局规则不允许自救',
        );
        expect(mock.dispatch).not.toHaveBeenCalled();
      } else {
        expect(harness.getLastEvent()?.title).toBe('对10号用解药？');
        await harness.pressLastPrimary();
        const result = await getDispatchOutcome(mock, 0);
        expect(result.kind).toBe('committed');
        if (result.kind === 'committed') expect(result.outcome.kind).toBe('success');
      }
    },
  );
});
