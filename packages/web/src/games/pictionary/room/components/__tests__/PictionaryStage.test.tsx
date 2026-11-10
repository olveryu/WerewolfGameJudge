/**
 * The Pictionary stage renders the viewer's task only: the step, the roster and the countdown
 * live in the room information bar. The text task keeps a one-line answer form in its footer
 * (Enter submits); the drawing task shows the text to draw as one compact card over the canvas.
 */

import {
  getPictionaryTaskForSeat,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { pictionaryTestText, playPictionaryTestRound } from '@/test-utils/pictionaryState';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { TESTIDS } from '@/testids';

import { PictionaryStage } from '../PictionaryStage';

type Submit = ReadyRoomSession<PictionaryState, PictionaryPublicCommand>['submit'];

function renderStage(state: PictionaryState, submit: Submit) {
  const session = createFakeRoomLink<PictionaryState, PictionaryPublicCommand>(
    readyLinkSnapshot(testIdentity('pictionary'), createRoomSnapshot(state, 1)),
    async () => successfulRoomCommand(state),
  );
  return render(
    <PictionaryStage
      state={state}
      effectiveSeat={0}
      controlledSeat={null}
      userId="host-1"
      isHost
      remainingSeconds={30}
      isOverdue={false}
      session={session}
      submit={submit}
      isSubmitting={false}
      openReview={vi.fn()}
    />,
  );
}

describe('PictionaryStage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the opening prompt task without a step label or countdown of its own', () => {
    const state = playPictionaryTestRound({ stopAt: { stepIndex: 0, phase: 'answering' } });
    renderStage(state, vi.fn<Submit>());
    expect(screen.getByRole('heading', { name: '写下一个题目' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '接龙题目' })).toHaveAttribute(
      'placeholder',
      expect.stringMatching(/^例如：/),
    );
    expect(screen.getByTestId(TESTIDS.pictionaryTextSubmitButton)).toBeDisabled();
    expect(screen.queryByText(/\d+:\d{2}/)).not.toBeInTheDocument();
    expect(screen.queryByText(/第 ?\d+ ?\/ ?\d+ ?棒/)).not.toBeInTheDocument();
  });

  it('marks the task done when Enter submits a valid text', async () => {
    const user = userEvent.setup();
    const state = playPictionaryTestRound({ stopAt: { stepIndex: 0, phase: 'answering' } });
    const submit = vi.fn<Submit>().mockResolvedValue(true);
    renderStage(state, submit);
    await user.type(screen.getByRole('textbox', { name: '接龙题目' }), '月球上的猫{Enter}');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(
      '完成编辑',
      expect.objectContaining({ type: 'pictionary.task.ready.set', isReady: true }),
      { controlledSeat: null, durable: true },
    );
  });

  it('shows the text to draw as one card above the canvas', () => {
    const state = playPictionaryTestRound({ stopAt: { stepIndex: 1, phase: 'answering' } });
    const previousEntry = getPictionaryTaskForSeat(state, 0)?.previousEntry;
    if (previousEntry?.kind !== 'text') throw new Error('Seat 0 should draw a handed-in text');
    expect(previousEntry.text).toBe(pictionaryTestText(0, previousEntry.authorSeat));
    renderStage(state, vi.fn<Submit>());
    expect(screen.getByText('把这句话画出来')).toBeInTheDocument();
    expect(screen.getByText(previousEntry.text)).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.pictionaryDrawingCanvas)).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
