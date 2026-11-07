/** Displays the server-revealed story prefix; terminal rounds permit rereading and image sharing. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type {
  StoryRelayCommand,
  StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { GalleryPagerControls } from '@/features/room/components/GalleryPagerControls';
import { GalleryPlaybackControls } from '@/features/room/components/GalleryPlaybackControls';
import { colors, componentSizes } from '@/theme';
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
}: {
  readonly state: StoryRelayState;
  readonly isHost: boolean;
  readonly submit: (label: string, command: StoryRelayCommand) => Promise<boolean>;
  readonly isSubmitting: boolean;
  /** Opens the shared review at one story's page. */
  readonly openReview: (pageKey: string) => void;
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
  return (
    <View style={styles.container} testID="storyrelay-gallery">
      <View style={styles.content}>
        <Text style={styles.title}>
          {state.phase === 'aborted' ? '未完成的故事' : '故事揭晓'}
          {isPlayback && ` · ${chainIndex + 1} / ${stories.length}`}
        </Text>
        {!isPlayback && (
          <GalleryPagerControls
            current={selectedStory}
            total={stories.length}
            prevLabel="上一篇故事"
            nextLabel="下一篇故事"
            onPrev={() => setSelectedStory(selectedStory - 1)}
            onNext={() => setSelectedStory(selectedStory + 1)}
          />
        )}
      </View>
      <FlatList
        data={chain.entries}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={<Text style={styles.muted}>{STORY_RELAY_EMPTY_STORY_TEXT}</Text>}
        renderItem={({ item, index }) => (
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
      />
      {isHost && isPlayback && state.gallery !== null && (
        <GalleryPlaybackControls
          style={[styles.controls, styles.row]}
          isPlaying={state.gallery.isPlaying}
          canTogglePlay={state.config.galleryItemDurationSeconds !== null}
          isFirst={state.gallery.position === 0}
          isSubmitting={isSubmitting}
          advanceForm="icon"
          advanceLabel="下一段"
          rewindLabel="上一段"
          playLabel="继续回放"
          pauseLabel="暂停回放"
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
      )}
      {!isHost && isPlayback && state.gallery !== null && (
        // 非房主在播放期没有控制权：与 Pictionary 同阶段同形态，在
        // 房主控制条的位置给一行观看提示，说明播放由房主控制。
        <View style={[styles.controls, styles.row]}>
          <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.muted}>由房主控制播放进度。</Text>
        </View>
      )}
      {!isPlayback && (
        <View style={[styles.controls, styles.row]}>
          <Button
            variant="secondary"
            style={styles.shareButton}
            accessibilityLabel="分享本篇故事"
            onPress={() => openReview(storyRelayStoryPageKey(chain))}
            icon={
              <Ionicons name="image-outline" size={componentSizes.icon.sm} color={colors.text} />
            }
          >
            分享本篇故事
          </Button>
        </View>
      )}
    </View>
  );
}
