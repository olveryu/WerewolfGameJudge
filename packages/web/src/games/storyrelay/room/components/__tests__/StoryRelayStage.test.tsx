/**
 * The Story Relay stage renders the viewer's task only: the passage number, the readiness roster
 * and the countdown live in the room information bar, and bot takeover lives in its roster sheet.
 * The previous passage opens by default and collapses to its last lines; the editor fills the
 * rest with its count inside; the dock is the full-width ready button.
 */

import {
  getStoryRelayTaskForSeat,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { playStoryRelayTestRound } from '@/test-utils/storyrelayState';

import { StoryRelayStage } from '../StoryRelayStage';
import { testStageSession } from './storyRelayStageFixtures';

function renderStage(state: StoryRelayState) {
  const { session, submit } = testStageSession(state);
  render(
    <StoryRelayStage
      state={state}
      effectiveSeat={0}
      controlledSeat={null}
      userId="host-1"
      isHost
      remainingSeconds={80}
      isOverdue={false}
      session={session}
      submit={submit}
      isSubmitting={false}
      openReview={vi.fn()}
    />,
  );
  return { submit };
}

function previousPassageOf(state: StoryRelayState): string {
  const previous = getStoryRelayTaskForSeat(state, 0)?.previousEntry;
  if (previous?.kind !== 'text') throw new Error('Seat 0 should continue a handed-in passage');
  return previous.text;
}

describe('StoryRelayStage', () => {
  it('shows the task without a heading, a step label, a countdown or a takeover button', () => {
    renderStage(playStoryRelayTestRound({ stopAt: { stepIndex: 1, phase: 'answering' } }));
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d{2}/)).not.toBeInTheDocument();
    expect(screen.queryByText(/第 ?\d+ ?\/ ?\d+ ?[段棒]/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /机器人接管/ })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '故事续写' })).toHaveAccessibleDescription(
      '0 / 512',
    );
    expect(screen.getByRole('button', { name: '准备好了' })).toBeEnabled();
  });

  it('opens the previous passage by default and collapses it to its last lines', async () => {
    const user = userEvent.setup();
    const state = playStoryRelayTestRound({ stopAt: { stepIndex: 1, phase: 'answering' } });
    renderStage(state);
    const passage = previousPassageOf(state);
    expect(screen.getByTestId('storyrelay-previous-entry')).toHaveTextContent(passage);
    expect(screen.getByText('收起')).toBeInTheDocument();

    await user.click(screen.getByText('上一段'));
    expect(screen.getByText('展开')).toBeInTheDocument();
    expect(screen.getAllByText(passage)).toHaveLength(2);
  });

  it('readies the passage from the dock', async () => {
    const user = userEvent.setup();
    const { submit } = renderStage(
      playStoryRelayTestRound({ stopAt: { stepIndex: 0, phase: 'answering' } }),
    );
    await user.type(screen.getByRole('textbox', { name: '故事开头' }), '从前有座山');
    expect(screen.getByRole('textbox', { name: '故事开头' })).toHaveAccessibleDescription(
      '5 / 512',
    );
    await user.click(screen.getByRole('button', { name: '准备好了' }));
    expect(submit).toHaveBeenCalledWith(
      '更新准备状态',
      expect.objectContaining({ type: 'storyrelay.task.ready.set', isReady: true }),
      { controlledSeat: null },
    );
  });

  it('replaces the ready button with the collection status while settling', () => {
    renderStage(playStoryRelayTestRound({ stopAt: { stepIndex: 1, phase: 'settling' } }));
    expect(screen.queryByRole('button', { name: /准备/ })).not.toBeInTheDocument();
    expect(screen.getByText('正在自动收稿')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '故事续写' })).toHaveAttribute('readonly');
  });
});
