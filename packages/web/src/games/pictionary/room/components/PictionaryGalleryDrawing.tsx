/** Seek a gallery drawing to the shared timeline, then hand back to the existing PNG preview. */

import type { PictionaryDrawingEntry } from '@game-judge/game-engine/games/pictionary/public';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { Spinner } from '@/components/Spinner';
import { DrawingReplayCanvas } from '@/features/drawing/components/DrawingReplayCanvas';
import { type DrawingElement, isDrawingColor } from '@/features/drawing/model/drawing';
import { type RevealTiming, useRevealProgress } from '@/features/room/hooks/useRevealProgress';
import {
  pictionaryGalleryImageOptions,
  pictionaryReplayOptions,
} from '@/games/pictionary/services/pictionaryReplayTransport';
import { pictionaryDrawingPainter } from '@/games/pictionary/services/renderPictionaryDrawing';
import type { ServerClock } from '@/services/serverClock';
import { roomScreenLog } from '@/utils/logger';

import { PictionaryDrawingImage } from './PictionaryDrawingImage';

/** Legacy entries do not request replay; failures visibly fall back without blocking the room. */
export function PictionaryGalleryDrawing({
  roomCode,
  entry,
  label,
  timing,
  clock,
}: {
  readonly roomCode: string;
  readonly entry: PictionaryDrawingEntry;
  readonly label: string;
  readonly timing: RevealTiming | null;
  readonly clock: ServerClock | null;
}) {
  const progress = useRevealProgress(timing, clock);
  const [canvasUnavailable, setCanvasUnavailable] = useState(false);
  const shouldReplay = entry.media.replay !== null && timing !== null && progress < 1;
  const replay = useQuery({
    ...pictionaryReplayOptions(roomCode, entry.id),
    enabled: shouldReplay,
  });
  const png = useQuery({
    ...pictionaryGalleryImageOptions(roomCode, entry.id),
    enabled: false,
  });
  const elements = useMemo(
    (): readonly DrawingElement[] | null =>
      replay.data?.elements.map((element) => {
        const color = element.color;
        if (!isDrawingColor(color)) throw new Error('Invalid Pictionary replay color');
        return { ...element, color };
      }) ?? null,
    [replay.data],
  );
  const onUnavailable = useCallback(
    (error: unknown) => {
      roomScreenLog.warn('Pictionary replay canvas unavailable; displaying PNG', {
        entryId: entry.id,
        error,
      });
      setCanvasUnavailable(true);
    },
    [entry.id],
  );
  let overlay;
  if (shouldReplay && !canvasUnavailable && !replay.isError) {
    overlay =
      elements === null ? (
        <div className="pictionary-drawing-status">
          <Spinner label="正在加载笔画回放" />
        </div>
      ) : (
        <DrawingReplayCanvas
          elements={elements}
          painter={pictionaryDrawingPainter}
          progress={progress}
          label={`${label}，正在逐笔揭晓`}
          onUnavailable={onUnavailable}
        />
      );
  }
  return (
    <>
      <PictionaryDrawingImage
        roomCode={roomCode}
        entryId={entry.id}
        label={label}
        controlledSeat={null}
        revealOverlay={overlay}
        prefetchedUri={png.data}
      />
      {entry.media.replay !== null && (replay.isError || canvasUnavailable) && (
        <p className="pictionary-gallery-viewer-notice" role="status">
          笔画回放不可用，显示成品
        </p>
      )}
    </>
  );
}
