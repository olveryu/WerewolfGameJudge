/** Synchronized Story Relay gallery: every player watches one story together, then browses freely. */

import type {
  StoryRelayCommand,
  StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { GalleryAlbumHeading } from '@/features/room/components/GalleryAlbumHeading';
import { GalleryAlbumStage } from '@/features/room/components/GalleryAlbumStage';
import { GalleryPlaybackControls } from '@/features/room/components/GalleryPlaybackControls';
import { GalleryPagerControls } from '@/features/room/components/RoomControls';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import { showConfirmAlert } from '@/utils/alertPresets';
import IconImageOutline from '~icons/ion/image-outline';
import IconPeopleOutline from '~icons/ion/people-outline';

import { storyRelayStoryPageKey } from '../../review/toStoryRelayReviewDocument';
import {
  getStoryRelayAuthorName,
  getStoryRelayVisibleStories,
  STORY_RELAY_BLANK_ENTRY_TEXT,
  STORY_RELAY_EMPTY_STORY_TEXT,
} from '../storyRelayPresentation';

type StoryRelayGalleryCommandType = Extract<
  StoryRelayCommand['type'],
  | 'storyrelay.gallery.advance'
  | 'storyrelay.gallery.rewind'
  | 'storyrelay.gallery.pause'
  | 'storyrelay.gallery.resume'
  | 'storyrelay.gallery.finish'
>;

/** Keeps local rereading separate from the server's shared playback position. */
export function StoryRelayGallery({
  state,
  isHost,
  submit,
  isSubmitting,
  openReview,
  remainingSeconds,
  isOverdue,
  onRetrySettle,
}: {
  readonly state: StoryRelayState;
  readonly isHost: boolean;
  readonly submit: (label: string, command: StoryRelayCommand) => Promise<boolean>;
  readonly isSubmitting: boolean;
  /** Opens the shared review at one story's page. */
  readonly openReview: (pageKey: string) => void;
  /** From the stage's useStageDeadline tick; null without a deadline. */
  readonly remainingSeconds: number | null;
  /** From the stage's useStageDeadline: the gallery settle is overdue. */
  readonly isOverdue: boolean;
  /** Submits the storyrelay.phase.retrySettle command. */
  readonly onRetrySettle: () => void;
}) {
  const [selectedStory, setSelectedStory] = useState(0);
  const isPlayback = state.phase === 'gallery';
  const playback = isPlayback ? state.gallery : null;
  if (isPlayback && playback === null) throw new Error('Story Relay gallery playback missing');
  const storyLength = state.config.numberOfPlayers;
  const chainIndex =
    playback === null ? selectedStory : Math.floor(playback.position / storyLength);
  const stories = getStoryRelayVisibleStories(state);
  const chain = stories[chainIndex];
  if (chain === undefined) throw new Error('Story Relay gallery chain missing');
  const control = (type: StoryRelayGalleryCommandType) =>
    void submit('控制故事回放', { type, phaseRevision: state.phaseRevision });
  // The current story is fully revealed once the last segment is showing.
  const isStoryEnd = playback !== null && playback.position % storyLength === storyLength - 1;
  // 房主自救（D3 follow-up）：画廊自动推进的结算逾期时，房主可重新推进。
  const rescue = (
    <StageSettleRescue
      remainingSeconds={remainingSeconds}
      isOverdue={isOverdue}
      isHost={isHost}
      isRetrying={isSubmitting}
      onRetry={onRetrySettle}
      waitingLabel="等待推进…"
    />
  );
  let controls;
  if (playback === null) {
    controls = (
      <div className="storyrelay-ended-controls">
        <Button variant="secondary" onClick={() => openReview(storyRelayStoryPageKey(chain))}>
          <IconImageOutline aria-hidden />
          分享本篇故事
        </Button>
        <GalleryPagerControls
          current={selectedStory}
          total={stories.length}
          prevLabel="上一篇故事"
          nextLabel="下一篇故事"
          onPrev={() => setSelectedStory(selectedStory - 1)}
          onNext={() => setSelectedStory(selectedStory + 1)}
        />
      </div>
    );
  } else if (isHost) {
    controls = (
      <>
        <GalleryPlaybackControls
          isPlaying={playback.isPlaying}
          canTogglePlay={state.config.galleryItemDurationSeconds !== null}
          isFirst={playback.position === 0}
          isSubmitting={isSubmitting}
          advanceForm="icon"
          advanceLabel="下一项"
          rewindLabel="上一项"
          playLabel="播放"
          pauseLabel="暂停"
          finishLabel="全部揭晓"
          onRewind={() => control('storyrelay.gallery.rewind')}
          onAdvance={() => control('storyrelay.gallery.advance')}
          onTogglePlay={() =>
            control(playback.isPlaying ? 'storyrelay.gallery.pause' : 'storyrelay.gallery.resume')
          }
          onFinish={() =>
            showConfirmAlert('全部揭晓', '立即公开剩余故事并结束回放？', () => {
              control('storyrelay.gallery.finish');
            })
          }
        />
        {rescue}
      </>
    );
  } else {
    controls = (
      <>
        <p className="storyrelay-viewer-notice">
          <IconPeopleOutline aria-hidden />
          {isStoryEnd ? '本篇已揭晓，等待房主继续' : '全员正在观看同一篇故事'}
        </p>
        {rescue}
      </>
    );
  }
  return (
    <GalleryAlbumStage
      key={chain.id}
      entries={chain.entries}
      renderEntry={(item, index) => (
        <article
          className="storyrelay-entry"
          data-selected={
            (playback !== null && playback.position % storyLength === index) || undefined
          }
        >
          <p className="storyrelay-muted">
            第 {index + 1} 棒 · {getStoryRelayAuthorName(state, item.authorSeat)}
          </p>
          <p className="storyrelay-text" data-testid={`storyrelay-entry-${index}`}>
            {item.kind === 'text' ? item.text : STORY_RELAY_BLANK_ENTRY_TEXT}
          </p>
        </article>
      )}
      heading={
        <GalleryAlbumHeading
          eyebrow={state.phase === 'aborted' ? '未完成的故事' : '故事揭晓'}
          title={`第 ${chainIndex + 1} / ${stories.length} 篇`}
          description={isHost ? '你的播放操作会同步给房间内所有玩家。' : '由房主控制播放进度。'}
          remainingSeconds={playback === null ? null : remainingSeconds}
        />
      }
      follow={playback === null ? 'none' : 'bottom'}
      controls={controls}
      testId="storyrelay-gallery"
      listTestId="storyrelay-gallery-list"
      emptyContent={<p className="storyrelay-muted">{STORY_RELAY_EMPTY_STORY_TEXT}</p>}
    />
  );
}
