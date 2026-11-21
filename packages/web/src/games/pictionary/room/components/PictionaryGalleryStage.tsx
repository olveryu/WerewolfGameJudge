/** Synchronized Pictionary gallery and the post-round local album browser. */

import {
  createPictionaryCommand,
  type PictionaryCommandInput,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { GalleryAlbumHeading } from '@/features/room/components/GalleryAlbumHeading';
import { GalleryAlbumStage } from '@/features/room/components/GalleryAlbumStage';
import { GalleryPlaybackControls } from '@/features/room/components/GalleryPlaybackControls';
import { GalleryPagerControls } from '@/features/room/components/RoomControls';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { useGalleryClock } from '@/features/room/hooks/useGalleryClock';
import { getPictionarySeatDisplayName } from '@/games/pictionary/model/pictionarySelectors';
import { pictionaryAlbumPageKey } from '@/games/pictionary/review/toPictionaryReviewDocument';
import {
  pictionaryGalleryImageOptions,
  pictionaryReplayOptions,
} from '@/games/pictionary/services/pictionaryReplayTransport';
import { TESTIDS } from '@/testids';
import { showConfirmAlert } from '@/utils/alertPresets';
import IconPeopleOutline from '~icons/ion/people-outline';
import IconShareOutline from '~icons/ion/share-outline';

import { PictionaryGalleryEntryView } from './PictionaryGalleryEntryView';

const EMPTY_ALBUM_CONTENT = <p className="pictionary-gallery-viewer-notice">这本画册还没有内容</p>;

/** Host-driven synchronized reveal of one album at a time. */
export function PictionaryGalleryStage({
  state,
  isHost,
  submit,
  isSubmitting,
  remainingSeconds,
  isOverdue,
}: {
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly submit: ReadyRoomSession<PictionaryState, PictionaryPublicCommand>['submit'];
  readonly isSubmitting: boolean;
  readonly remainingSeconds: number | null;
  readonly isOverdue: boolean;
}) {
  const clock = useGalleryClock(state.phase === 'gallery');
  const queryClient = useQueryClient();
  const activePosition =
    state.gallery === null
      ? -1
      : state.gallery.chainIndex * (state.stepIndex + 1) + state.gallery.entryIndex;
  const nextPosition = activePosition + 1;
  const nextEntry =
    state.chains[Math.floor(nextPosition / (state.stepIndex + 1))]?.entries[
      nextPosition % (state.stepIndex + 1)
    ];
  const nextDrawingId = nextEntry?.kind === 'drawing' ? nextEntry.id : null;
  const nextHasReplay = nextEntry?.kind === 'drawing' && nextEntry.media.replay !== null;
  useEffect(() => {
    if (nextDrawingId === null) return;
    void queryClient.prefetchQuery(pictionaryGalleryImageOptions(state.roomCode, nextDrawingId));
    if (nextHasReplay)
      void queryClient.prefetchQuery(pictionaryReplayOptions(state.roomCode, nextDrawingId));
  }, [nextDrawingId, nextHasReplay, queryClient, state.roomCode]);
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
  // 房主自救：画廊自动推进的结算逾期时，房主可重新推进。
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
  const isFinalEntry = gallery.chainIndex === state.chains.length - 1 && isAlbumEnd;
  const advanceLabel = isFinalEntry ? '结束揭晓' : isAlbumEnd ? '下一本' : '下一项';
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
        advanceLabel={advanceLabel}
        rewindLabel="上一项"
        playLabel="播放"
        pauseLabel="暂停"
        finishLabel="全部揭晓"
        onRewind={() => void galleryCommand('上一项', { type: 'pictionary.gallery.rewind' })}
        onAdvance={() => void galleryCommand(advanceLabel, { type: 'pictionary.gallery.advance' })}
        onTogglePlay={() =>
          void galleryCommand(gallery.isPlaying ? '暂停揭晓' : '继续揭晓', {
            type: gallery.isPlaying ? 'pictionary.gallery.pause' : 'pictionary.gallery.resume',
          })
        }
        onFinish={() =>
          showConfirmAlert('全部揭晓？', '立即公开全部画册并结束同步回放。', () => {
            void galleryCommand('全部揭晓', { type: 'pictionary.gallery.finish' });
          })
        }
        advanceTestId={TESTIDS.pictionaryGalleryAdvanceButton}
      />
      {rescue}
    </>
  ) : (
    <>
      <p
        className="pictionary-gallery-viewer-notice"
        data-testid={TESTIDS.pictionaryGalleryViewerNotice}
      >
        <IconPeopleOutline aria-hidden />
        {isAlbumEnd ? '本册已揭晓，等待房主继续' : '全员正在观看同一本画册'}
      </p>
      {rescue}
    </>
  );

  return (
    <GalleryAlbumStage
      key={chain.id}
      entries={visibleEntries}
      renderEntry={(entry, index) => (
        <PictionaryGalleryEntryView
          state={state}
          entry={entry}
          entryIndex={index}
          timing={
            activePosition === gallery.revealedPosition &&
            gallery.chainIndex * chain.entries.length + index === gallery.revealedPosition
              ? gallery
              : null
          }
          clock={clock}
        />
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
      testId={TESTIDS.pictionaryStageFrame}
      listTestId={TESTIDS.pictionaryGalleryAlbum}
      emptyContent={EMPTY_ALBUM_CONTENT}
    />
  );
}

/** Completed or aborted round: each player pages through albums locally and can share one. */
export function PictionaryEndedStage({
  state,
  openReview,
}: {
  readonly state: PictionaryState;
  /** Opens the shared review at one album's page. */
  readonly openReview: (pageKey: string) => void;
}) {
  const [chainIndex, setChainIndex] = useState(0);
  if (state.phase !== 'ended' && state.phase !== 'aborted') {
    throw new Error('[FAIL-FAST] Ended stage requires completed Pictionary state');
  }
  const chain = state.chains[chainIndex];
  if (chain === undefined) throw new Error('[FAIL-FAST] Completed Pictionary album is missing');
  const controls = (
    <div className="pictionary-ended-controls">
      <Button
        variant="secondary"
        onClick={() => openReview(pictionaryAlbumPageKey(chain))}
        data-testid={TESTIDS.pictionaryGalleryShareButton}
      >
        <IconShareOutline aria-hidden />
        分享本篇画册
      </Button>
      <GalleryPagerControls
        current={chainIndex}
        total={state.chains.length}
        prevLabel="上一本"
        nextLabel="下一本"
        onPrev={() => setChainIndex(Math.max(0, chainIndex - 1))}
        onNext={() => setChainIndex(Math.min(state.chains.length - 1, chainIndex + 1))}
        testIdScope={TESTIDS.pictionaryStageFrame}
      />
    </div>
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
          eyebrow={`第 ${chainIndex + 1} / ${state.chains.length} 本画册`}
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
      testId={TESTIDS.pictionaryStageFrame}
      listTestId={TESTIDS.pictionaryGalleryAlbum}
      emptyContent={EMPTY_ALBUM_CONTENT}
    />
  );
}
