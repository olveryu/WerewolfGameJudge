import { type RefObject, use, useEffect, useState } from 'react';

import {
  AVATAR_FRAME_OVERFLOW,
  type DecorationAnchor,
  type DecorationSpec,
} from '@/scene/decoration';
import { sceneStagePromise } from '@/scene/sceneStagePromise';
import type { SeatRect } from '@/scene/stage';

interface SeatDecorationProps {
  /** Resident decorations of one seat, back to front (e.g. frame, flair, pet). */
  decorations: readonly DecorationSpec[];
  /** The seat's square avatar tile; decorations are drawn in its pixel space. */
  tileRef: RefObject<HTMLElement | null>;
  /** The element `SceneCanvas` covers. */
  hostRef: RefObject<HTMLElement | null>;
}

/**
 * The tile's decoration square relative to the host's padding box, where the canvas sits: as in
 * the previous client, it starts at the tile's padding edge (inside its border) and spans the
 * tile's outer size. Offsets ignore CSS transforms, so a tile's press or selection animation
 * does not shift decorations.
 */
function measureTile(tile: HTMLElement, host: HTMLElement): SeatRect {
  let x = tile.clientLeft;
  let y = tile.clientTop;
  let element = tile;
  for (;;) {
    x += element.offsetLeft;
    y += element.offsetTop;
    const parent = element.offsetParent;
    if (!(parent instanceof HTMLElement)) {
      throw new Error('Seat tile is not laid out inside the scene host');
    }
    if (parent === host) return { x, y, size: tile.offsetWidth };
    if (parent === host.offsetParent) {
      return {
        x: x - host.offsetLeft - host.clientLeft,
        y: y - host.offsetTop - host.clientTop,
        size: tile.offsetWidth,
      };
    }
    x += parent.clientLeft;
    y += parent.clientTop;
    element = parent;
  }
}

/**
 * A decoration's square for its anchor, from the tile rect `measureTile` returns. The avatar frame
 * box is the tile's border box (outside the border) grown by the frame overflow.
 */
function anchorRect(anchor: DecorationAnchor, tileRect: SeatRect, tile: HTMLElement): SeatRect {
  if (anchor === 'tile') return tileRect;
  const overflow = tileRect.size * AVATAR_FRAME_OVERFLOW;
  return {
    x: tileRect.x - tile.clientLeft - overflow,
    y: tileRect.y - tile.clientTop - overflow,
    size: tileRect.size + overflow * 2,
  };
}

/**
 * Mounts a seat's looping decorations on the scene stage and keeps them aligned with the seat
 * tile. Suspends until PixiJS has loaded; throws (to the nearest error boundary) when artwork
 * fails to load. Callers skip it when reduced motion is requested or seat decorations are
 * switched off.
 */
export function SeatDecoration({ decorations, tileRef, hostRef }: SeatDecorationProps) {
  const stage = use(sceneStagePromise());
  const [failure, setFailure] = useState<Error | null>(null);
  if (failure) throw failure;

  useEffect(() => {
    const tile = tileRef.current;
    const host = hostRef.current;
    if (!tile || !host) {
      throw new Error('SeatDecoration tile or host is not mounted');
    }
    const mounted = decorations.map((decoration) => ({
      anchor: decoration.anchor ?? 'tile',
      handle: stage.mount(decoration, setFailure),
    }));
    const align = () => {
      const rect = measureTile(tile, host);
      for (const { anchor, handle } of mounted) handle.setRect(anchorRect(anchor, rect, tile));
    };
    const observer = new ResizeObserver(align);
    observer.observe(tile);
    observer.observe(host);
    align();
    return () => {
      observer.disconnect();
      for (const { handle } of mounted) handle.destroy();
    };
  }, [stage, decorations, tileRef, hostRef]);

  return null;
}
