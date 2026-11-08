/** Synchronized Pictionary gallery and post-round local browser. */

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  createPictionaryCommand,
  type PictionaryCommandInput,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import type React from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { GalleryAlbumHeading } from '@/features/room/components/GalleryAlbumHeading';
import { GalleryAlbumStage } from '@/features/room/components/GalleryAlbumStage';
import { GalleryPagerControls } from '@/features/room/components/GalleryPagerControls';
import { GalleryPlaybackControls } from '@/features/room/components/GalleryPlaybackControls';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { getPictionarySeatDisplayName } from '@/games/pictionary/model/pictionarySelectors';
import { pictionaryAlbumPageKey } from '@/games/pictionary/review/toPictionaryReviewDocument';
import { TESTIDS } from '@/testids';
import { colors, fixed, spacing, textStyles } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

import { PictionaryGalleryEntryView } from './PictionaryGalleryEntryView';

interface PictionaryGalleryStageProps {
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly submit: ReadyRoomSession<PictionaryState, PictionaryPublicCommand>['submit'];
  readonly isSubmitting: boolean;
  readonly remainingSeconds: number | null;
  readonly isOverdue: boolean;
}

export const PictionaryGalleryStage: React.FC<PictionaryGalleryStageProps> = ({
  state,
  isHost,
  submit,
  isSubmitting,
  remainingSeconds,
  isOverdue,
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
  // 画廊导航是房主命令：不带接管座位、durable（跨重连重放到服务端裁决）。
  const galleryCommand = (label: string, input: PictionaryCommandInput) =>
    submit(label, createPictionaryCommand(state, input, null), { durable: true });
  // 房主自救（D3 follow-up）：画廊自动推进的结算逾期时，房主可重新推进。
  const rescue = (
    <StageSettleRescue
      remainingSeconds={remainingSeconds}
      isOverdue={isOverdue}
      isHost={isHost}
      isRetrying={isSubmitting}
      onRetry={() => void galleryCommand('重新推进', { type: 'pictionary.phase.retrySettle' })}
      waitingLabel="等待推进…"
    />
  );
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
    <>
      <GalleryPlaybackControls
        isPlaying={gallery.isPlaying}
        canTogglePlay={!isAlbumEnd && state.config.galleryItemDurationSeconds !== null}
        isFirst={isFirstEntry}
        isSubmitting={isSubmitting}
        advanceForm={isAlbumEnd ? 'primary' : 'icon'}
        advanceLabel={isFinalEntry ? '结束揭晓' : isAlbumEnd ? '下一本' : '下一项'}
        rewindLabel="上一项"
        playLabel="播放"
        pauseLabel="暂停"
        finishLabel="全部揭晓"
        onRewind={() => void galleryCommand('上一项', { type: 'pictionary.gallery.rewind' })}
        onAdvance={() =>
          void galleryCommand(isFinalEntry ? '结束揭晓' : isAlbumEnd ? '下一本' : '下一项', {
            type: 'pictionary.gallery.advance',
          })
        }
        onTogglePlay={() =>
          void galleryCommand(gallery.isPlaying ? '暂停揭晓' : '继续揭晓', {
            type: gallery.isPlaying ? 'pictionary.gallery.pause' : 'pictionary.gallery.resume',
          })
        }
        onFinish={() =>
          showConfirmAlert('全部揭晓？', '立即公开全部画册并结束同步回放。', async () => {
            await galleryCommand('全部揭晓', { type: 'pictionary.gallery.finish' });
          })
        }
        advanceTestID={TESTIDS.pictionaryGalleryAdvanceButton}
      />
      {rescue}
    </>
  ) : (
    <>
      <View style={styles.viewerNotice}>
        <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.viewerNoticeText}>
          {isAlbumEnd ? '本册已揭晓，等待房主继续' : '全员正在观看同一本画册'}
        </Text>
      </View>
      {rescue}
    </>
  );

  return (
    <GalleryAlbumStage
      key={chain.id}
      entries={visibleEntries}
      renderEntry={(entry, index) => (
        <PictionaryGalleryEntryView state={state} entry={entry} entryIndex={index} />
      )}
      heading={
        <GalleryAlbumHeading
          eyebrow={`第 ${gallery.chainIndex + 1} / ${state.config.numberOfPlayers} 本画册`}
          title={`${getPictionarySeatDisplayName(state, chain.originSeat)} 的接龙`}
          description={isHost ? '你的播放操作会同步给房间内所有玩家。' : '由房主控制播放进度。'}
          remainingSeconds={remainingSeconds}
        />
      }
      follow="top"
      controls={controls}
      testID={TESTIDS.pictionaryStageFrame}
      listTestID={TESTIDS.pictionaryGalleryAlbum}
    />
  );
};

interface PictionaryEndedStageProps {
  readonly state: PictionaryState;
  /** Opens the shared review at one album's page. */
  readonly openReview: (pageKey: string) => void;
}

export const PictionaryEndedStage: React.FC<PictionaryEndedStageProps> = ({
  state,
  openReview,
}) => {
  if (state.phase !== 'ended' && state.phase !== 'aborted') {
    throw new Error('[FAIL-FAST] Ended stage requires completed Pictionary state');
  }
  const [localChainIndex, setLocalChainIndex] = useState(0);
  const chain = state.chains[localChainIndex];
  if (chain === undefined) throw new Error('[FAIL-FAST] Completed Pictionary album is missing');
  const controls = (
    <View style={styles.endedControls}>
      <Button
        variant="secondary"
        onPress={() => openReview(pictionaryAlbumPageKey(chain))}
        icon={<Ionicons name="share-outline" size={20} color={colors.text} />}
      >
        分享本篇画册
      </Button>
      <GalleryPagerControls
        current={localChainIndex}
        total={state.chains.length}
        prevLabel="上一本"
        nextLabel="下一本"
        onPrev={() => setLocalChainIndex((index) => Math.max(0, index - 1))}
        onNext={() => setLocalChainIndex((index) => Math.min(state.chains.length - 1, index + 1))}
      />
    </View>
  );

  return (
    <GalleryAlbumStage
      key={chain.id}
      entries={chain.entries}
      renderEntry={(entry, index) => (
        <PictionaryGalleryEntryView state={state} entry={entry} entryIndex={index} />
      )}
      heading={
        <GalleryAlbumHeading
          eyebrow={`第 ${localChainIndex + 1} / ${state.chains.length} 本画册`}
          title={`${getPictionarySeatDisplayName(state, chain.originSeat)} 的接龙`}
          description={
            state.phase === 'aborted'
              ? `第 ${state.roundNumber} 轮未完成，房主已中止。`
              : `第 ${state.roundNumber} 轮完成，现在可以按自己的节奏回看。`
          }
          remainingSeconds={null}
        />
      }
      follow="none"
      controls={controls}
      testID={TESTIDS.pictionaryStageFrame}
      listTestID={TESTIDS.pictionaryGalleryAlbum}
    />
  );
};

const styles = StyleSheet.create({
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
