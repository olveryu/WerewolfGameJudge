/** Displays the server-revealed story prefix; terminal rounds permit rereading and image sharing. */

import type {
  StoryRelayCommand,
  StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { GalleryPagerControls } from '@/features/room/components/GalleryPagerControls';
import { GalleryPlaybackControls } from '@/features/room/components/GalleryPlaybackControls';
import { showConfirmAlert } from '@/utils/alertPresets';

import { getStoryRelayVisibleStories } from '../storyRelayPresentation';
import { StoryRelayImageShare } from './StoryRelayImageShare';
import { storyRelayStyles as styles } from './StoryRelayStage.styles';

/** Keeps local rereading separate from the server's shared playback position. */
export function StoryRelayGallery({
  state,
  isHost,
  submit,
  isSubmitting,
}: {
  readonly state: StoryRelayState;
  readonly isHost: boolean;
  readonly submit: (label: string, command: StoryRelayCommand) => Promise<boolean>;
  readonly isSubmitting: boolean;
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
        ListEmptyComponent={<Text style={styles.muted}>这篇故事尚未收录稿件</Text>}
        renderItem={({ item, index }) => {
          const author = state.participants.find(
            (participant) => participant.seat === item.authorSeat,
          );
          if (author === undefined) throw new Error('Story author missing');
          return (
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
                第 {index + 1} 棒 · {author.displayName}
              </Text>
              <Text selectable style={styles.text} testID={`storyrelay-entry-${index}`}>
                {item.kind === 'text' ? item.text : '（空白）'}
              </Text>
            </View>
          );
        }}
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
      {!isPlayback && (
        <View style={[styles.controls, styles.row]}>
          <StoryRelayImageShare state={state} chainIndex={chainIndex} />
        </View>
      )}
    </View>
  );
}
