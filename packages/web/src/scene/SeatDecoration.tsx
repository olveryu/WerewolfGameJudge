import { type RefObject, use, useEffect } from 'react';

import type { DecorationSpec } from '@/scene/decoration';
import { sceneStagePromise } from '@/scene/sceneStagePromise';

interface SeatDecorationProps {
  decoration: DecorationSpec;
  /** The seat's square avatar tile; the decoration is drawn in its pixel space. */
  tileRef: RefObject<HTMLElement | null>;
  /** The element `SceneCanvas` covers. */
  hostRef: RefObject<HTMLElement | null>;
}

/**
 * Mounts one looping decoration on the scene stage and keeps it aligned with the seat tile.
 * Suspends until PixiJS has loaded. Callers skip it when reduced motion is requested.
 */
export function SeatDecoration({ decoration, tileRef, hostRef }: SeatDecorationProps) {
  const stage = use(sceneStagePromise());

  useEffect(() => {
    const tile = tileRef.current;
    const host = hostRef.current;
    if (!tile || !host) {
      throw new Error('SeatDecoration tile or host is not mounted');
    }
    const handle = stage.mount(decoration);
    const align = () => {
      const tileRect = tile.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      handle.setRect({
        x: tileRect.left - hostRect.left,
        y: tileRect.top - hostRect.top,
        size: tileRect.width,
      });
    };
    const observer = new ResizeObserver(align);
    observer.observe(tile);
    observer.observe(host);
    align();
    return () => {
      observer.disconnect();
      handle.destroy();
    };
  }, [stage, decoration, tileRef, hostRef]);

  return null;
}
