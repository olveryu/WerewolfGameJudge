import { type RefObject, use, useEffect, useRef, useState } from 'react';

import {
  AVATAR_FRAME_OVERFLOW,
  type DecorationAnchor,
  type DecorationSpec,
  PET_CELL_FRACTION,
  PET_CELL_OFFSET,
} from '@/scene/decoration';
import { sceneStagePromise } from '@/scene/sceneStagePromise';
import type { DecorationHandle, SeatRect } from '@/scene/stage';

interface SeatDecorationProps {
  /** Resident decorations of one seat, back to front (e.g. frame, flair, pet). */
  decorations: readonly DecorationSpec[];
  /** Decorations hidden for now (flair and pet while an entrance plays); they restart when shown. */
  suspended: ReadonlySet<DecorationSpec>;
  /** The seat's square avatar tile; decorations are drawn in its pixel space. */
  tileRef: RefObject<HTMLElement | null>;
  /** The element `SceneCanvas` covers. */
  hostRef: RefObject<HTMLElement | null>;
}

/**
 * The offset of `element`'s border box from the host's padding box, where the canvas sits.
 * Offsets ignore CSS transforms, so a tile's press or selection animation does not shift
 * decorations.
 */
export function offsetInHost(element: HTMLElement, host: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let current = element;
  for (;;) {
    x += current.offsetLeft;
    y += current.offsetTop;
    const parent = current.offsetParent;
    if (!(parent instanceof HTMLElement)) {
      throw new Error('Seat element is not laid out inside the scene host');
    }
    if (parent === host) return { x, y };
    if (parent === host.offsetParent) {
      return { x: x - host.offsetLeft - host.clientLeft, y: y - host.offsetTop - host.clientTop };
    }
    x += parent.clientLeft;
    y += parent.clientTop;
    current = parent;
  }
}

/**
 * The tile's decoration square relative to the host: as in the previous client, it starts at
 * the tile's padding edge (inside its border) and spans the tile's outer size.
 */
function measureTile(tile: HTMLElement, host: HTMLElement): SeatRect {
  const origin = offsetInHost(tile, host);
  return { x: origin.x + tile.clientLeft, y: origin.y + tile.clientTop, size: tile.offsetWidth };
}

/**
 * A decoration's square for its anchor, from the tile rect `measureTile` returns. The avatar frame
 * box is the tile's border box grown by the frame overflow; the pet box hangs over the padding
 * box's top-right corner, sized from the grid cell (the tile's parent).
 */
function anchorRect(anchor: DecorationAnchor, tileRect: SeatRect, tile: HTMLElement): SeatRect {
  switch (anchor) {
    case 'tile':
      return tileRect;
    case 'avatarFrame': {
      const overflow = tileRect.size * AVATAR_FRAME_OVERFLOW;
      return {
        x: tileRect.x - tile.clientLeft - overflow,
        y: tileRect.y - tile.clientTop - overflow,
        size: tileRect.size + overflow * 2,
      };
    }
    case 'pet': {
      const cell = tile.parentElement?.offsetWidth;
      if (cell === undefined) {
        throw new Error('Seat tile has no grid cell to size its pet from');
      }
      const size = Math.round(cell * PET_CELL_FRACTION);
      const offset = Math.round(cell * PET_CELL_OFFSET);
      const paddingWidth = tileRect.size - tile.clientLeft * 2;
      return { x: tileRect.x + paddingWidth + offset - size, y: tileRect.y - offset, size };
    }
  }
}

/**
 * Mounts a seat's looping decorations on the scene stage and keeps them aligned with the seat
 * tile. Suspends until PixiJS has loaded; throws (to the nearest error boundary) when artwork
 * fails to load. Callers skip it when reduced motion is requested or seat decorations are
 * switched off.
 */
export function SeatDecoration({ decorations, suspended, tileRef, hostRef }: SeatDecorationProps) {
  const stage = use(sceneStagePromise());
  const [failure, setFailure] = useState<Error | null>(null);
  const handles = useRef(new Map<DecorationSpec, DecorationHandle>());
  if (failure) throw failure;

  useEffect(() => {
    const tile = tileRef.current;
    const host = hostRef.current;
    if (!tile || !host) {
      throw new Error('SeatDecoration tile or host is not mounted');
    }
    const mounted = decorations.map((decoration) => ({
      decoration,
      anchor: decoration.anchor ?? 'tile',
      handle: stage.mount(decoration, setFailure),
    }));
    const byDecoration = handles.current;
    for (const { decoration, handle } of mounted) byDecoration.set(decoration, handle);
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
      byDecoration.clear();
      for (const { handle } of mounted) handle.destroy();
    };
  }, [stage, decorations, tileRef, hostRef]);

  useEffect(() => {
    for (const [decoration, handle] of handles.current) {
      handle.setSuspended(suspended.has(decoration));
    }
  }, [decorations, suspended]);

  return null;
}
