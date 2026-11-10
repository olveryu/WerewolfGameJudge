/**
 * Bot drafts stay independent per seat through the real room stage: taking
 * over another bot (from the room roster sheet, which hands the stage a new
 * controlled seat) remounts the task editor (StoryRelayStage keys it by
 * authorSeat), and each seat reads/writes only its own entry in the shared
 * inputs map.
 */

import {
  getStoryRelayTaskForSeat,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { fireEvent, render, screen } from '@testing-library/react';

import { StoryRelayStage } from '../StoryRelayStage';
import { StoryRelayTaskEditor } from '../StoryRelayTaskEditor';
import {
  botAnsweringState,
  createStoryRelayDriver,
  testStageSession,
} from './storyRelayStageFixtures';

const editor = () => screen.getByTestId('storyrelay-editor');

describe('StoryRelayStage bot drafts', () => {
  it('keeps each taken-over bot seat on its own draft', () => {
    const state = botAnsweringState(null);
    const { session, submit } = testStageSession(state);
    const stageElement = (controlledSeat: number) => (
      <StoryRelayStage
        state={state}
        effectiveSeat={controlledSeat}
        controlledSeat={controlledSeat}
        userId="host"
        isHost
        remainingSeconds={null}
        isOverdue={false}
        session={session}
        submit={submit}
        isSubmitting={false}
        openReview={vi.fn()}
      />
    );
    const view = render(stageElement(0));
    fireEvent.change(editor(), { target: { value: '机器人0的独立稿件' } });

    // Take over bot seat 1: the stage remounts the editor keyed by the new
    // authorSeat, so seat 0's manuscript must not leak into seat 1's editor.
    view.rerender(stageElement(1));
    expect(editor()).toHaveValue('');
    fireEvent.change(editor(), { target: { value: '机器人1的独立稿件' } });

    // Take over seat 0 again: its own draft is restored, not seat 1's.
    view.rerender(stageElement(0));
    expect(editor()).toHaveValue('机器人0的独立稿件');
  });
});

/** Plays a 4-seat human round through the real engine to the answering phase of `targetStep`. */
function answeringStateAtStep(targetStep: number): StoryRelayState {
  const driver = createStoryRelayDriver({});
  driver.beginWithHumans();
  for (let stepIndex = 0; stepIndex < targetStep; stepIndex += 1) driver.playStep(stepIndex);
  const state = driver.read();
  if (state.phase !== 'answering' || state.stepIndex !== targetStep) {
    throw new Error(
      `expected answering step ${targetStep}, got ${state.phase} step ${state.stepIndex}`,
    );
  }
  return state;
}

describe('StoryRelayTaskEditor final step', () => {
  it.each([
    [0, '故事从这里开始', '故事开头'],
    [2, '写下接下来的故事', '故事续写'],
    [3, '写下故事的结局', '故事结局'],
  ])('at step %s shows placeholder %s and label %s', (stepIndex, placeholder, label) => {
    const state = answeringStateAtStep(stepIndex);
    const task = getStoryRelayTaskForSeat(state, 0);
    if (task === null) throw new Error('seat 0 has no task');
    render(
      <StoryRelayTaskEditor
        state={state}
        task={task}
        inputs={new Map()}
        controlledSeat={null}
        submit={vi.fn(async () => true)}
        isSubmitting={false}
        finalization="idle"
        isExpired={false}
      />,
    );
    expect(editor()).toHaveAttribute('placeholder', placeholder);
    expect(editor()).toHaveAccessibleName(label);
  });
});
