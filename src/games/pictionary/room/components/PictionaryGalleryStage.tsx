/** Synchronized Pictionary gallery and post-round local browser. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type {
  PictionaryEntry,
  PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, type ListRenderItemInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { roomSurfaceStyles } from '@/features/room/components/RoomSurface.styles';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { getPictionarySeatDisplayName } from '@/games/pictionary/model/pictionarySelectors';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

import { usePictionaryStageCommand } from '../hooks/usePictionaryStageCommand';
import { PictionaryAlbumExport } from './PictionaryAlbumExport';
import { PictionaryDrawingImage } from './PictionaryDrawingImage';
import { PICTIONARY_STAGE_MAX_WIDTH, PictionaryStageHeading } from './PictionaryStageFrame';

interface GalleryEntryViewProps {
  readonly state: PictionaryState;
  readonly entry: PictionaryEntry;
  readonly entryIndex: number;
}

const GalleryEntryView: React.FC<GalleryEntryViewProps> = ({ state, entry, entryIndex }) => (
  <View style={styles.revealSection} testID={TESTIDS.pictionaryGalleryEntry}>
    <View style={styles.revealMeta}>
      <Text style={styles.entryKind}>
        {entry.kind === 'drawing' ? '画作' : entry.kind === 'text' ? '文字' : '未完成'}
      </Text>
      <Text style={styles.entryPosition}>
        第 {entryIndex + 1} / {state.stepIndex + 1} 棒
      </Text>
    </View>
    {entry.kind === 'drawing' ? (
      <PictionaryDrawingImage
        roomCode={state.roomCode}
        entryId={entry.id}
        accessibilityLabel={`${getPictionarySeatDisplayName(state, entry.authorSeat)} 的画作`}
        controlledSeat={null}
      />
    ) : entry.kind === 'text' ? (
      <View style={styles.textReveal}>
        <Ionicons name="chatbox-ellipses-outline" size={30} color={colors.primary} />
        <Text style={styles.revealText}>{entry.text}</Text>
      </View>
    ) : (
      <View style={styles.missedReveal}>
        <Ionicons name="close-circle-outline" size={36} color={colors.textMuted} />
        <Text style={styles.missedTitle}>这一棒交了空白</Text>
        <Text style={styles.missedDescription}>
          原本需要{entry.expectedKind === 'drawing' ? '画一幅画' : '写下猜测'}
        </Text>
      </View>
    )}
    <View style={styles.authorRow}>
      <Ionicons
        name={entry.kind === 'drawing' ? 'brush-outline' : 'person-outline'}
        size={17}
        color={colors.textSecondary}
      />
      <Text style={styles.authorText}>{getPictionarySeatDisplayName(state, entry.authorSeat)}</Text>
    </View>
  </View>
);

interface PictionaryAlbumStageProps {
  readonly state: PictionaryState;
  readonly entries: readonly PictionaryEntry[];
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly remainingSeconds: number | null;
  readonly shouldFollowLatestEntry: boolean;
  readonly controls: React.ReactNode;
}

const PictionaryAlbumStage: React.FC<PictionaryAlbumStageProps> = ({
  state,
  entries,
  eyebrow,
  title,
  description,
  remainingSeconds,
  shouldFollowLatestEntry,
  controls,
}) => {
  const listRef = useRef<FlatList<PictionaryEntry>>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [entryHeights, setEntryHeights] = useState<Readonly<Record<string, number>>>({});
  const latestEntryId = entries.at(-1)?.id;
  const latestEntryHeight = latestEntryId === undefined ? undefined : entryHeights[latestEntryId];
  const footerHeight = shouldFollowLatestEntry
    ? Math.max(0, viewportHeight - (latestEntryHeight ?? 0))
    : 0;
  const renderEntry = useCallback(
    ({ item, index }: ListRenderItemInfo<PictionaryEntry>) => (
      <View
        onLayout={({ nativeEvent }) => {
          const height = nativeEvent.layout.height;
          setEntryHeights((current) =>
            current[item.id] === height ? current : { ...current, [item.id]: height },
          );
        }}
      >
        <GalleryEntryView state={state} entry={item} entryIndex={index} />
      </View>
    ),
    [state],
  );
  const getEntryKey = useCallback((entry: PictionaryEntry) => entry.id, []);

  useEffect(() => {
    if (!shouldFollowLatestEntry || latestEntryHeight === undefined || contentHeight === 0) return;
    const offset =
      entries.length === 1
        ? 0
        : contentHeight - footerHeight - spacing.large - spacing.medium - latestEntryHeight;
    listRef.current?.scrollToOffset({ offset: Math.max(0, offset), animated: true });
  }, [contentHeight, entries.length, footerHeight, latestEntryHeight, shouldFollowLatestEntry]);

  return (
    <View style={styles.albumStage} testID={TESTIDS.pictionaryStageFrame}>
      <FlatList
        ref={listRef}
        testID={TESTIDS.pictionaryGalleryAlbum}
        data={entries}
        renderItem={renderEntry}
        keyExtractor={getEntryKey}
        initialNumToRender={state.stepIndex + 1}
        onLayout={({ nativeEvent }) => setViewportHeight(nativeEvent.layout.height)}
        onContentSizeChange={(_width, height) => setContentHeight(height)}
        contentContainerStyle={styles.albumContent}
        ListFooterComponent={
          shouldFollowLatestEntry ? <View style={{ height: footerHeight }} /> : null
        }
        ListHeaderComponent={
          <PictionaryStageHeading
            eyebrow={eyebrow}
            title={title}
            description={description}
            remainingSeconds={remainingSeconds}
          />
        }
      />
      <View style={styles.controlsDock}>{controls}</View>
    </View>
  );
};

interface PictionaryGalleryStageProps {
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly session: PictionaryRoomSession;
  readonly remainingSeconds: number | null;
}

export const PictionaryGalleryStage: React.FC<PictionaryGalleryStageProps> = ({
  state,
  isHost,
  session,
  remainingSeconds,
}) => {
  if (state.phase !== 'gallery' || state.gallery === null) {
    throw new Error('[FAIL-FAST] Gallery stage requires active Pictionary gallery state');
  }
  const gallery = state.gallery;
  const chain = state.chains[gallery.chainIndex];
  if (chain === undefined) throw new Error('[FAIL-FAST] Pictionary gallery chain is missing');
  if (chain.entries[gallery.entryIndex] === undefined) {
    throw new Error('[FAIL-FAST] Pictionary gallery entry is missing');
  }
  const command = usePictionaryStageCommand(session, null, state);
  const isFirstEntry = gallery.chainIndex === 0 && gallery.entryIndex === 0;
  const isAlbumEnd = gallery.entryIndex === chain.entries.length - 1;
  const isFinalEntry =
    gallery.chainIndex === state.chains.length - 1 &&
    gallery.entryIndex === chain.entries.length - 1;
  const visibleEntries = chain.entries.slice(
    0,
    Math.min(
      chain.entries.length,
      gallery.revealedPosition - gallery.chainIndex * chain.entries.length + 1,
    ),
  );
  const controls = isHost ? (
    <View style={styles.galleryControls}>
      <Button
        variant="ghost"
        size="sm"
        onPress={() =>
          showConfirmAlert('全部揭晓？', '立即公开全部画册并结束同步回放。', async () => {
            await command.submit('全部揭晓', { type: 'pictionary.gallery.finish' });
          })
        }
      >
        全部揭晓
      </Button>
      <Button
        variant="icon"
        size="md"
        disabled={isFirstEntry || command.isSubmitting}
        onPress={() => void command.submit('上一项', { type: 'pictionary.gallery.rewind' })}
        accessibilityLabel="上一项"
      >
        <Ionicons name="play-skip-back" size={20} color={colors.text} />
      </Button>
      {!isAlbumEnd && state.config.galleryItemDurationSeconds !== null && (
        <Button
          variant="secondary"
          accessibilityLabel={gallery.isPlaying ? '暂停' : '播放'}
          size="md"
          disabled={command.isSubmitting}
          onPress={() =>
            void command.submit(gallery.isPlaying ? '暂停揭晓' : '继续揭晓', {
              type: gallery.isPlaying ? 'pictionary.gallery.pause' : 'pictionary.gallery.resume',
            })
          }
          icon={
            <Ionicons
              name={gallery.isPlaying ? 'pause' : 'play'}
              size={20}
              color={colors.primary}
            />
          }
        >
          {gallery.isPlaying ? '暂停' : '播放'}
        </Button>
      )}
      <Button
        variant={isAlbumEnd ? 'primary' : 'icon'}
        size="md"
        disabled={command.isSubmitting}
        onPress={() =>
          void command.submit(isFinalEntry ? '结束揭晓' : isAlbumEnd ? '下一本' : '下一项', {
            type: 'pictionary.gallery.advance',
          })
        }
        accessibilityLabel={isFinalEntry ? '结束揭晓' : isAlbumEnd ? '下一本' : '下一项'}
        testID={TESTIDS.pictionaryGalleryAdvanceButton}
      >
        {isAlbumEnd ? (
          isFinalEntry ? (
            '结束揭晓'
          ) : (
            '下一本'
          )
        ) : (
          <Ionicons name="play-skip-forward" size={20} color={colors.text} />
        )}
      </Button>
    </View>
  ) : (
    <View style={styles.viewerNotice}>
      <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
      <Text style={styles.viewerNoticeText}>
        {isAlbumEnd ? '本册已揭晓，等待房主继续' : '全员正在观看同一本画册'}
      </Text>
    </View>
  );

  return (
    <PictionaryAlbumStage
      key={chain.id}
      state={state}
      entries={visibleEntries}
      eyebrow={`第 ${gallery.chainIndex + 1} / ${state.config.numberOfPlayers} 本画册`}
      title={`${getPictionarySeatDisplayName(state, chain.originSeat)} 的接龙`}
      description={isHost ? '你的播放操作会同步给房间内所有玩家。' : '由房主控制播放进度。'}
      remainingSeconds={remainingSeconds}
      shouldFollowLatestEntry
      controls={controls}
    />
  );
};

interface PictionaryEndedStageProps {
  readonly state: PictionaryState;
}

export const PictionaryEndedStage: React.FC<PictionaryEndedStageProps> = ({ state }) => {
  if (state.phase !== 'ended' && state.phase !== 'aborted') {
    throw new Error('[FAIL-FAST] Ended stage requires completed Pictionary state');
  }
  const [localChainIndex, setLocalChainIndex] = useState(0);
  const chain = state.chains[localChainIndex];
  if (chain === undefined) throw new Error('[FAIL-FAST] Completed Pictionary album is missing');
  const controls = (
    <View style={styles.endedControls}>
      <PictionaryAlbumExport key={chain.id} state={state} chain={chain} />
      <View style={styles.localBrowserControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="上一本"
          disabled={localChainIndex === 0}
          onPress={() => setLocalChainIndex((index) => Math.max(0, index - 1))}
          style={({ pressed }) => [
            styles.localBrowserButton,
            localChainIndex === 0 && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.localPosition}>
          {localChainIndex + 1} / {state.chains.length}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="下一本"
          disabled={localChainIndex === state.chains.length - 1}
          onPress={() =>
            setLocalChainIndex((index) => Math.min(state.chains.length - 1, index + 1))
          }
          style={({ pressed }) => [
            styles.localBrowserButton,
            localChainIndex === state.chains.length - 1 && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <PictionaryAlbumStage
      key={chain.id}
      state={state}
      entries={chain.entries}
      eyebrow={`第 ${localChainIndex + 1} / ${state.chains.length} 本画册`}
      title={`${getPictionarySeatDisplayName(state, chain.originSeat)} 的接龙`}
      description={
        state.phase === 'aborted'
          ? `第 ${state.roundNumber} 轮未完成，房主已中止。`
          : `第 ${state.roundNumber} 轮完成，现在可以按自己的节奏回看。`
      }
      remainingSeconds={null}
      shouldFollowLatestEntry={false}
      controls={controls}
    />
  );
};

const styles = StyleSheet.create({
  albumStage: {
    width: '100%',
    maxWidth: PICTIONARY_STAGE_MAX_WIDTH,
    minHeight: 0,
    flex: 1,
    alignSelf: 'center',
  },
  albumContent: {
    flexGrow: 1,
    gap: spacing.large,
    padding: spacing.medium,
  },
  controlsDock: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  revealSection: {
    gap: spacing.small,
    paddingTop: spacing.medium,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.borderLight,
  },
  revealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  entryKind: { ...textStyles.bodySemibold, flex: 1, color: colors.primary },
  entryPosition: { ...textStyles.caption, color: colors.textSecondary },
  textReveal: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.medium,
    padding: spacing.large,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
  },
  revealText: { ...textStyles.titleBold, color: colors.text, textAlign: 'center' },
  missedReveal: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
  },
  missedTitle: roomSurfaceStyles.title,
  missedDescription: { ...textStyles.secondary, color: colors.textSecondary },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.tight },
  authorText: { ...textStyles.secondary, color: colors.textSecondary, flex: 1, minWidth: 0 },
  galleryControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
  },
  viewerNotice: {
    minHeight: fixed.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
  },
  viewerNoticeText: { ...textStyles.secondary, color: colors.textSecondary, flexShrink: 1 },
  endedControls: { gap: spacing.small },
  localBrowserControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.medium,
  },
  localBrowserButton: {
    width: fixed.minTouchTarget,
    height: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.small,
    backgroundColor: colors.surface,
  },
  localPosition: {
    ...textStyles.bodySemibold,
    minWidth: 72,
    color: colors.text,
    textAlign: 'center',
  },
  disabled: { opacity: fixed.disabledOpacity },
  pressed: { opacity: fixed.activeOpacity },
});
