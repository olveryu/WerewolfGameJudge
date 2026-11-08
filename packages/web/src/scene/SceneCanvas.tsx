import './scene.css';

import { type RefObject, use, useEffect } from 'react';

import { sceneStagePromise } from '@/scene/sceneStagePromise';
import type { SceneFrameRate } from '@/scene/stage';

interface SceneCanvasProps {
  /** Positioned element the canvas covers; seat decorations are laid out in its coordinates. */
  hostRef: RefObject<HTMLElement | null>;
  frameRate: SceneFrameRate;
}

/**
 * Puts the scene canvas over `hostRef` while mounted. Suspends until PixiJS has loaded, so wrap
 * it in `<Suspense>`; the DOM it overlays renders without waiting.
 */
export function SceneCanvas({ hostRef, frameRate }: SceneCanvasProps) {
  const stage = use(sceneStagePromise());

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      throw new Error('SceneCanvas host is not mounted');
    }
    stage.attach(host);
    return () => stage.detach(host);
  }, [stage, hostRef]);

  useEffect(() => {
    stage.setFrameRate(frameRate);
  }, [stage, frameRate]);

  return null;
}
