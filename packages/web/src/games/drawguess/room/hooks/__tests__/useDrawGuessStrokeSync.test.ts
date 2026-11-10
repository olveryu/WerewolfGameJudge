import type {
  DrawGuessCommand,
  DrawGuessState,
  DrawGuessStroke,
} from '@game-judge/game-engine/games/drawguess/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, renderHook } from '@testing-library/react';

import type { DrawingElement } from '@/features/drawing/model/drawing';
import type { DispatchOutcome } from '@/platform/realtime/types';
import { buildDrawGuessTestState } from '@/test-utils/drawguessState';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import {
  rejectedRoomCommand,
  successfulRoomCommand,
  undeliveredRoomCommand,
} from '@/test-utils/roomCommand';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';

import { useDrawGuessStrokeSync } from '../useDrawGuessStrokeSync';

vi.mock('@/utils/alertPresets', () => ({ showErrorAlert: vi.fn() }));
vi.mock('@/utils/errorPipeline', () => ({ handleError: vi.fn() }));

const STROKE_FLUSH_MS = 300;
const STATE = buildDrawGuessTestState();

function brush(id: string): DrawingElement {
  return { id, kind: 'brush', color: '#000000', width: 5, points: [{ x: 1, y: 2 }] };
}

function authoritativeStroke(id: string): DrawGuessStroke {
  return {
    id,
    kind: 'brush',
    color: '#000000',
    width: 5,
    points: [{ x: 1, y: 2 }],
    authorSeat: 0,
  };
}

type Dispatch = (command: DrawGuessCommand) => Promise<DispatchOutcome<DrawGuessState>>;

function renderSync(dispatch: Dispatch, authoritativeStrokes: readonly DrawGuessStroke[] = []) {
  const link = createFakeRoomLink<DrawGuessState, DrawGuessCommand>(
    readyLinkSnapshot(testIdentity('drawguess'), createRoomSnapshot(STATE, 1)),
    dispatch,
  );
  const hook = renderHook(() =>
    useDrawGuessStrokeSync({
      session: link,
      authoritativeStrokes,
      phaseRevision: 1,
      turnIndex: 0,
      effectiveSeat: 0,
      controlledSeat: null,
      canDraw: true,
    }),
  );
  return { link, hook };
}

async function tick(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(STROKE_FLUSH_MS);
  });
}

describe('useDrawGuessStrokeSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(showErrorAlert).mockClear();
    vi.mocked(handleError).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps an undelivered stroke queued and resends it on the next flush', async () => {
    const outcomes = [undeliveredRoomCommand<DrawGuessState>(), successfulRoomCommand(STATE)];
    const { link, hook } = renderSync(async () => {
      const next = outcomes.shift();
      if (next === undefined) throw new Error('unexpected dispatch');
      return next;
    });

    act(() => hook.result.current.onElementComplete(brush('s1')));
    await tick();
    expect(hook.result.current.pendingCount).toBe(1);

    await tick();
    expect(link.dispatch).toHaveBeenCalledTimes(2);
    expect(hook.result.current.pendingCount).toBe(0);
  });

  it('drops a stroke the server rejected without retrying it', async () => {
    const { link, hook } = renderSync(async () => rejectedRoomCommand('invalid_stroke'));

    act(() => hook.result.current.onElementComplete(brush('s1')));
    await tick();
    await tick();

    expect(link.dispatch).toHaveBeenCalledTimes(1);
    expect(hook.result.current.pendingCount).toBe(0);
  });

  it('drops and reports a stroke whose request threw instead of retrying it forever', async () => {
    const failure = new Error('HTTP 403');
    const { link, hook } = renderSync(async () => {
      throw failure;
    });

    act(() => hook.result.current.onElementComplete(brush('s1')));
    await tick();
    await tick();

    expect(link.dispatch).toHaveBeenCalledTimes(1);
    expect(hook.result.current.pendingCount).toBe(0);
    expect(handleError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ label: '同步笔画' }),
    );
  });

  it('restores an optimistically undone stroke when the undo is not committed', async () => {
    const { hook } = renderSync(async () => undeliveredRoomCommand(), [authoritativeStroke('s1')]);

    await act(async () => {
      hook.result.current.undo();
      await vi.runOnlyPendingTimersAsync();
    });

    expect(hook.result.current.elements.map((element) => element.id)).toEqual(['s1']);
    expect(hook.result.current.canRedo).toBe(false);
    expect(showErrorAlert).toHaveBeenCalledWith('撤销失败', expect.any(String));
  });

  it('keeps the canvas and alerts when the clear is not committed', async () => {
    const { hook } = renderSync(
      async () => rejectedRoomCommand('phase'),
      [authoritativeStroke('s1')],
    );

    await act(async () => {
      hook.result.current.clear();
      await vi.runOnlyPendingTimersAsync();
    });

    expect(hook.result.current.elements.map((element) => element.id)).toEqual(['s1']);
    expect(showErrorAlert).toHaveBeenCalledWith('清空失败', expect.any(String));
  });
});
