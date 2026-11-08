/** Synchronized Story Relay gallery: every player watches one story together, then browses freely. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type {
  StoryRelayCommand,
  StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { GalleryAlbumHeading } from '@/features/room/components/GalleryAlbumHeading';
import { GalleryAlbumStage } from '@/features/room/components/GalleryAlbumStage';
import { GalleryPagerControls } from '@/features/room/components/GalleryPagerControls';
import { GalleryPlaybackControls } from '@/features/room/components/GalleryPlaybackControls';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import { colors, componentSizes, fixed, spacing, textStyles } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

import { storyRelayStoryPageKey } from '../../review/toStoryRelayReviewDocument';
import {
  getStoryRelayAuthorName,
  getStoryRelayVisibleStories,
  STORY_RELAY_BLANK_ENTRY_TEXT,
  STORY_RELAY_EMPTY_STORY_TEXT,
} from '../storyRelayPresentation';
import { storyRelayStyles as styles } from './StoryRelayStage.styles';

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
  const chainIndex =
    isPlayback && state.gallery !== null
      ? Math.floor(state.gallery.position / state.config.numberOfPlayers)
      : selectedStory;
  const stories = getStoryRelayVisibleStories(state);
  const chain = stories[chainIndex];
  if (chain === undefined) throw new Error('Story Relay gallery chain missing');
  const control = (
    type:
      | 'storyrelay.gallery.advance'
      | 'storyrelay.gallery.rewind'
      | 'storyrelay.gallery.pause'
      | 'storyrelay.gallery.resume'
      | 'storyrelay.gallery.finish',
  ) => void submit('控制故事回放', { type, phaseRevision: state.phaseRevision });
  // The current story is fully revealed once the last segment is showing.
  const isStoryEnd =
    isPlayback &&
    state.gallery !== null &&
    state.gallery.position % state.config.numberOfPlayers === state.config.numberOfPlayers - 1;
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
  const controls = isPlayback ? (
    isHost ? (
      <>
        <GalleryPlaybackControls
          isPlaying={state.gallery!.isPlaying}
          canTogglePlay={state.config.galleryItemDurationSeconds !== null}
          isFirst={state.gallery!.position === 0}
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
            control(
              state.gallery!.isPlaying ? 'storyrelay.gallery.pause' : 'storyrelay.gallery.resume',
            )
          }
          onFinish={() =>
            showConfirmAlert('全部揭晓', '立即公开剩余故事并结束回放？', () => {
              control('storyrelay.gallery.finish');
            })
          }
        />
        {rescue}
      </>
    ) : (
      <>
        <View style={localStyles.viewerNotice}>
          <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
          <Text style={localStyles.viewerNoticeText}>
            {isStoryEnd ? '本篇已揭晓，等待房主继续' : '全员正在观看同一篇故事'}
          </Text>
        </View>
        {rescue}
      </>
    )
  ) : (
    <View style={localStyles.endedControls}>
      <Button
        variant="secondary"
        style={styles.shareButton}
        accessibilityLabel="分享本篇故事"
        onPress={() => openReview(storyRelayStoryPageKey(chain))}
        icon={<Ionicons name="image-outline" size={componentSizes.icon.sm} color={colors.text} />}
      >
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
    </View>
  );

  return (
    <GalleryAlbumStage
      key={chain.id}
      entries={chain.entries}
      renderEntry={(item, index) => (
        <View
          style={[
            styles.entry,
            isPlayback &&
              state.gallery !== null &&
              state.gallery.position % state.config.numberOfPlayers === index &&
              styles.selected,
          ]}
        >
          <Text style={styles.muted}>
            第 {index + 1} 棒 · {getStoryRelayAuthorName(state, item.authorSeat)}
          </Text>
          <Text selectable style={styles.text} testID={`storyrelay-entry-${index}`}>
            {item.kind === 'text' ? item.text : STORY_RELAY_BLANK_ENTRY_TEXT}
          </Text>
        </View>
      )}
      heading={
        <GalleryAlbumHeading
          eyebrow={state.phase === 'aborted' ? '未完成的故事' : '故事揭晓'}
          title={`第 ${chainIndex + 1} / ${stories.length} 篇`}
          description={isHost ? '你的播放操作会同步给房间内所有玩家。' : '由房主控制播放进度。'}
          remainingSeconds={isPlayback ? remainingSeconds : null}
        />
      }
      follow={isPlayback ? 'bottom' : 'none'}
      controls={controls}
      testID="storyrelay-gallery"
      listTestID="storyrelay-gallery-list"
      listEmptyComponent={<Text style={styles.muted}>{STORY_RELAY_EMPTY_STORY_TEXT}</Text>}
    />
  );
}

const localStyles = StyleSheet.create({
  viewerNotice: {
    minHeight: fixed.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
  },
  viewerNoticeText: { ...textStyles.secondary, color: colors.textSecondary, flexShrink: 1 },
  endedControls: { gap: spacing.small },
});
