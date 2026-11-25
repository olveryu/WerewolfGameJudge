import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { STEP_RESULT_ACK_ACTION_KEY } from '@game-judge/game-engine/platform/steps';
import { act, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import {
  getDispatchOutcome,
  openNightActionGroup,
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
import { rejectedRoomCommand, undeliveredRoomCommand } from '@/test-utils/roomCommand';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const scenarios = collectBoardNightScenarios('预女猎白');

describe('shared-step retry on transport failure', () => {
  let harness: RoomScreenTestHarness;
  let detach: () => void;

  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detach = recordAlerts(harness);
    vi.spyOn(toast, 'error');
  });
  afterEach(() => {
    detach();
    vi.restoreAllMocks();
  });

  it('retries a private-result acknowledgement from the same dialog', async () => {
    const scenario = requireBoardNightScenario(scenarios, 'seerCheck', STEP_RESULT_ACK_ACTION_KEY);
    const { mock } = await mountBoardNightState(scenario.state, scenario.viewerSeat);
    mock.dispatch.mockResolvedValueOnce(undeliveredRoomCommand<GameState>('network', 'result-ack'));
    await waitFor(() =>
      expect(harness.getLastEvent()?.title).toBe(scenario.presentation.pendingResult?.title),
    );
    const eventsBefore = harness.events().length;

    await expect(harness.pressLastPrimary()).rejects.toMatchObject({
      name: 'RoomCommandUndeliveredError',
    });
    expect(toast.error).toHaveBeenCalledOnce();
    expect(harness.events()).toHaveLength(eventsBefore);
    await harness.pressLastPrimary();
    expect(mock.dispatch).toHaveBeenCalledTimes(2);
    expect(mock.dispatch.mock.calls[0]?.[0]).toEqual(mock.dispatch.mock.calls[1]?.[0]);
    expect(mock.dispatch.mock.calls[1]?.[0]).toEqual({
      type: 'werewolf.step.submit',
      gameSequence: scenario.state.gameSequence,
      submission: scenario.submission,
    });
    const retry = await getDispatchOutcome(mock, 1);
    expect(retry.kind).toBe('committed');
    if (retry.kind === 'committed') expect(retry.outcome.kind).toBe('success');
  });

  it('keeps a seat confirmation for retry and reports a rejected retry', async () => {
    const scenario = requireBoardNightScenario(scenarios, 'seerCheck', 'seerCheck');
    const { mock, view } = await mountBoardNightState(scenario.state, scenario.viewerSeat);
    mock.dispatch
      .mockResolvedValueOnce(undeliveredRoomCommand<GameState>('network', 'first'))
      .mockResolvedValueOnce(rejectedRoomCommand<GameState>('invalid_status', 'retry'));
    await pressStepAction(view, 'seerCheck');
    const seat = scenario.submission.seats?.[0];
    if (seat === undefined) throw new Error('[TEST] Missing seer target');
    await tapSeat(view, seat);
    const eventsBefore = harness.events().length;
    await expect(harness.pressLastPrimary()).rejects.toMatchObject({
      name: 'RoomCommandUndeliveredError',
    });
    expect(toast.error).toHaveBeenCalledOnce();
    expect(harness.events()).toHaveLength(eventsBefore);
    await harness.pressLastPrimary();
    await waitFor(() => expect(harness.getLastEvent()?.title).toBe('操作失败'));
    expect(mock.dispatch).toHaveBeenCalledTimes(2);
    expect(mock.dispatch.mock.calls[0]?.[0]).toEqual(mock.dispatch.mock.calls[1]?.[0]);
    expect(mock.dispatch.mock.calls[0]?.[0]).toEqual({
      type: 'werewolf.step.submit',
      gameSequence: scenario.state.gameSequence,
      submission: scenario.submission,
    });
  });

  it('returns to the hand after an in-flight seat submission fails and is cancelled', async () => {
    const scenario = requireBoardNightScenario(scenarios, 'seerCheck', 'seerCheck');
    const { mock, view } = await mountBoardNightState(scenario.state, scenario.viewerSeat);
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    mock.dispatch.mockImplementationOnce(async () => {
      await held;
      return undeliveredRoomCommand<GameState>('network', 'pending');
    });
    await pressStepAction(view, 'seerCheck');
    const seat = scenario.submission.seats?.[0];
    if (seat === undefined) throw new Error('[TEST] Missing seer target');
    await tapSeat(view, seat);
    const pending = harness.pressLastPrimary();
    await waitFor(() => expect(mock.dispatch).toHaveBeenCalledOnce());
    await act(async () => {
      if (release === undefined) throw new Error('[TEST] No pending submission to release');
      release();
      await held;
    });
    await expect(pending).rejects.toMatchObject({ name: 'RoomCommandUndeliveredError' });
    await harness.pressButton('取消');
    await pressStepAction(view, 'cancelSeatSelection');
    expect(view.getByTestId(TESTIDS.werewolfNightButton('openActionGroup'))).toBeVisible();
    await openNightActionGroup(view);
    expect(view.getByTestId(TESTIDS.stepInteractionButton('seerCheck'))).toBeVisible();
  });
});
