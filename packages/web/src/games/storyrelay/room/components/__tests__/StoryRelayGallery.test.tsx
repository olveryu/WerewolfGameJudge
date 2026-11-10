/**
 * Story Relay gallery renders through the shared album shell: the heading,
 * the bottom-follow text flow, the unified playback copy, and the ended
 * pager + share — driven by a real engine session to the gallery phase.
 */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';
import { render, screen } from '@testing-library/react';

import { StoryRelayGallery } from '../StoryRelayGallery';
import { createStoryRelayDriver } from './storyRelayStageFixtures';

/** Four humans play four turns; the state lands in the gallery phase. */
function playToGallery() {
  const driver = createStoryRelayDriver({
    writingDurationSeconds: null,
    transitionDurationSeconds: 0,
    galleryItemDurationSeconds: 5,
  });
  driver.beginWithHumans();
  for (let stepIndex = 0; stepIndex < 4; stepIndex += 1) driver.playStep(stepIndex);
  const state = driver.read();
  if (state.phase !== 'gallery') throw new Error(`expected gallery, got ${state.phase}`);
  return driver;
}

function galleryState(): StoryRelayState {
  return playToGallery().read();
}

function endedState(): StoryRelayState {
  const driver = playToGallery();
  driver.asSeat(
    { type: 'storyrelay.gallery.finish', phaseRevision: driver.read().phaseRevision },
    0,
  );
  const ended = driver.read();
  if (ended.phase !== 'ended') throw new Error(`expected ended, got ${ended.phase}`);
  return ended;
}

const renderGallery = (state: StoryRelayState, isHost: boolean, remainingSeconds: number | null) =>
  render(
    <StoryRelayGallery
      state={state}
      isHost={isHost}
      submit={vi.fn(async () => true)}
      isSubmitting={false}
      openReview={vi.fn()}
      remainingSeconds={remainingSeconds}
      isOverdue={false}
      onRetrySettle={vi.fn()}
    />,
  );

describe('StoryRelayGallery', () => {
  it('shows the first revealed segment under the shared heading with the countdown', () => {
    renderGallery(galleryState(), true, 82);
    expect(screen.getByText('故事揭晓')).toBeInTheDocument();
    expect(screen.getByText('第 1 / 4 篇')).toBeInTheDocument();
    expect(screen.getByText('1:22')).toBeInTheDocument();
    expect(screen.getByText('第1棒')).toBeInTheDocument();
  });

  it('uses the unified playback copy for the host', () => {
    renderGallery(galleryState(), true, 82);
    expect(screen.getByRole('button', { name: '上一项' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一项' })).toBeInTheDocument();
    expect(screen.getByText('暂停')).toBeInTheDocument();
    expect(screen.getByText('全部揭晓')).toBeInTheDocument();
    expect(screen.queryByLabelText('上一段')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('下一段')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('继续回放')).not.toBeInTheDocument();
  });

  it('tells non-host players everyone is watching the same story', () => {
    renderGallery(galleryState(), false, 82);
    expect(screen.getByText('全员正在观看同一篇故事')).toBeInTheDocument();
  });

  it('offers the pager and share once the gallery ends', () => {
    renderGallery(endedState(), true, null);
    expect(screen.getByRole('button', { name: '上一篇故事' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一篇故事' })).toBeInTheDocument();
    expect(screen.getByText('分享本篇故事')).toBeInTheDocument();
    expect(screen.getByText('不限时')).toBeInTheDocument();
  });
});
