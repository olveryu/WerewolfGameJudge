/** Synchronized Pictionary gallery and post-round local browser. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type {
  PictionaryChain,
  PictionaryEntry,
  PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import type React from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { getPictionarySeatDisplayName } from '@/games/pictionary/model/pictionarySelectors';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';

import { usePictionaryStageCommand } from '../hooks/usePictionaryStageCommand';
import { PictionaryDrawingImage } from './PictionaryDrawingImage';
import { PictionaryStageFrame } from './PictionaryStageFrame';

interface GalleryEntryViewProps {
  readonly state: PictionaryState;
  readonly chain: PictionaryChain;
  readonly entry: PictionaryEntry;
  readonly entryIndex: number;
}

const GalleryEntryView: React.FC<GalleryEntryViewProps> = ({ state, chain, entry, entryIndex }) => (
  <View style={styles.revealSection} testID={TESTIDS.pictionaryGalleryEntry}>
    <View style={styles.revealMeta}>
      <Text style={styles.chainName}>
        {getPictionarySeatDisplayName(state, chain.originSeat)} 发起的接龙
      </Text>
      <Text style={styles.entryPosition}>
        第 {entryIndex + 1} / {state.config.numberOfPlayers} 棒
      </Text>
    </View>
    {entry.kind === 'drawing' ? (
      <PictionaryDrawingImage
        roomCode={state.roomCode}
        entryId={entry.id}
        accessibilityLabel={`${getPictionarySeatDisplayName(state, entry.authorSeat)} 的画作`}
      />
    ) : entry.kind === 'text' ? (
      <View style={styles.textReveal}>
        <Ionicons name="chatbox-ellipses-outline" size={30} color={colors.primary} />
        <Text style={styles.revealText}>{entry.text}</Text>
      </View>
    ) : (
      <View style={styles.missedReveal}>
        <Ionicons name="close-circle-outline" size={36} color={colors.textMuted} />
        <Text style={styles.missedTitle}>这一棒没有完成</Text>
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
    <View style={styles.entryTrack}>
      {chain.entries.map((candidate, index) => (
        <View
          key={candidate.id}
          style={[styles.entryTrackItem, index === entryIndex && styles.activeEntryTrackItem]}
        />
      ))}
    </View>
  </View>
);

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
  const entry = chain.entries[gallery.entryIndex];
  if (entry === undefined) throw new Error('[FAIL-FAST] Pictionary gallery entry is missing');
  const command = usePictionaryStageCommand(session);
  const isFirstEntry = gallery.chainIndex === 0 && gallery.entryIndex === 0;
  const isFinalEntry =
    gallery.chainIndex === state.chains.length - 1 &&
    gallery.entryIndex === chain.entries.length - 1;

  return (
    <PictionaryStageFrame
      eyebrow={`第 ${gallery.chainIndex + 1} / ${state.config.numberOfPlayers} 条接龙`}
      title="接龙揭晓"
      description={isHost ? '你的播放操作会同步给房间内所有玩家。' : '由房主控制播放进度。'}
      remainingSeconds={remainingSeconds}
    >
      <GalleryEntryView state={state} chain={chain} entry={entry} entryIndex={gallery.entryIndex} />
      {isHost ? (
        <View style={styles.galleryControls}>
          <Button
            variant="icon"
            size="md"
            disabled={isFirstEntry || command.isSubmitting}
            onPress={() => void command.submit('上一项', { type: 'pictionary.gallery.rewind' })}
            accessibilityLabel="上一项"
          >
            <Ionicons name="play-skip-back" size={20} color={colors.text} />
          </Button>
          <Button
            variant="secondary"
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
          <Button
            variant="icon"
            size="md"
            disabled={command.isSubmitting}
            onPress={() =>
              void command.submit(isFinalEntry ? '结束揭晓' : '下一项', {
                type: 'pictionary.gallery.advance',
              })
            }
            accessibilityLabel={isFinalEntry ? '结束揭晓' : '下一项'}
            testID={TESTIDS.pictionaryGalleryAdvanceButton}
          >
            <Ionicons name="play-skip-forward" size={20} color={colors.text} />
          </Button>
        </View>
      ) : (
        <View style={styles.viewerNotice}>
          <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.viewerNoticeText}>全员正在观看同一项</Text>
        </View>
      )}
    </PictionaryStageFrame>
  );
};

interface FlattenedGalleryEntry {
  readonly chain: PictionaryChain;
  readonly entry: PictionaryEntry;
  readonly entryIndex: number;
}

function flattenGallery(state: PictionaryState): readonly FlattenedGalleryEntry[] {
  return state.chains.flatMap((chain) =>
    chain.entries.map((entry, entryIndex) => ({ chain, entry, entryIndex })),
  );
}

interface PictionaryEndedStageProps {
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly session: PictionaryRoomSession;
}

export const PictionaryEndedStage: React.FC<PictionaryEndedStageProps> = ({
  state,
  isHost,
  session,
}) => {
  if (state.phase !== 'ended') {
    throw new Error('[FAIL-FAST] Ended stage requires completed Pictionary state');
  }
  const entries = flattenGallery(state);
  const [localIndex, setLocalIndex] = useState(0);
  const current = entries[localIndex];
  if (current === undefined) {
    throw new Error('[FAIL-FAST] Completed Pictionary round has no gallery entries');
  }
  const command = usePictionaryStageCommand(session);

  return (
    <PictionaryStageFrame
      eyebrow={`第 ${state.roundNumber} 轮完成`}
      title="自由回看"
      description="现在每个人都可以按自己的节奏翻看整场接龙。"
      remainingSeconds={null}
    >
      <GalleryEntryView
        state={state}
        chain={current.chain}
        entry={current.entry}
        entryIndex={current.entryIndex}
      />
      <View style={styles.localBrowserControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="上一项"
          disabled={localIndex === 0}
          onPress={() => setLocalIndex((index) => Math.max(0, index - 1))}
          style={({ pressed }) => [
            styles.localBrowserButton,
            localIndex === 0 && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.localPosition}>
          {localIndex + 1} / {entries.length}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="下一项"
          disabled={localIndex === entries.length - 1}
          onPress={() => setLocalIndex((index) => Math.min(entries.length - 1, index + 1))}
          style={({ pressed }) => [
            styles.localBrowserButton,
            localIndex === entries.length - 1 && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>
      {isHost && (
        <View style={styles.roundActions}>
          <Button
            variant="secondary"
            disabled={command.isSubmitting}
            onPress={() =>
              void command.submit('返回房间', { type: 'pictionary.game.returnToLobby' })
            }
          >
            返回房间
          </Button>
          <Button
            loading={command.isSubmitting}
            onPress={() => void command.submit('再来一轮', { type: 'pictionary.round.next' })}
          >
            再来一轮
          </Button>
        </View>
      )}
    </PictionaryStageFrame>
  );
};

const styles = StyleSheet.create({
  revealSection: { gap: spacing.small },
  revealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  chainName: { ...textStyles.bodySemibold, flex: 1, color: colors.text },
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
  revealText: { ...textStyles.headingBold, color: colors.text, textAlign: 'center' },
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
  missedTitle: { ...textStyles.titleBold, color: colors.text },
  missedDescription: { ...textStyles.secondary, color: colors.textSecondary },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.tight },
  authorText: { ...textStyles.secondary, color: colors.textSecondary },
  entryTrack: { height: 4, flexDirection: 'row', gap: spacing.tight },
  entryTrackItem: { flex: 1, backgroundColor: colors.border },
  activeEntryTrackItem: { backgroundColor: colors.primary },
  galleryControls: {
    flexDirection: 'row',
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
  viewerNoticeText: { ...textStyles.secondary, color: colors.textSecondary },
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
  roundActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.small },
  disabled: { opacity: fixed.disabledOpacity },
  pressed: { opacity: fixed.activeOpacity },
});
