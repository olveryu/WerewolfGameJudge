/**
 * The global scene stage's canvas mounted as an overlay and the equipped effect. All effect
 * code is statically imported; the WebGL application is initialized only when a scene mounts.
 */
import { type CSSProperties, use, useLayoutEffect, useRef, useState } from 'react';

import { sceneStagePromise } from '@/scene/sceneStagePromise';

import { REVEAL_DOM_LAYER } from './common/layers';
import { loadRevealEffect } from './registry';
import { RevealScene, RevealSceneContext } from './runtime';
import type { RevealEffectProps, RevealEffectType } from './types';

const CANVAS_HOST_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: REVEAL_DOM_LAYER.canvas,
  pointerEvents: 'none',
};

/** Prepares effect `id` ahead of its reveal; the reveal reads the same cached promise. */
export function prefetchRevealEffect(id: RevealEffectType): void {
  void loadRevealEffect(id);
}

/** Mounts the stage overlay for one reveal and renders `effectType` on it. */
export default function RevealEffectStage({
  effectType,
  effectProps,
}: {
  readonly effectType: RevealEffectType;
  readonly effectProps: RevealEffectProps;
}) {
  const stage = use(sceneStagePromise());
  const { Effect } = use(loadRevealEffect(effectType));
  const [scene] = useState(() => new RevealScene(stage.createOverlayRoot()));
  const canvasHostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = canvasHostRef.current;
    if (!host) {
      throw new Error('Reveal canvas host is not mounted');
    }
    return stage.mountOverlay(host, scene.root, (nowMs) => scene.frame(nowMs));
  }, [stage, scene]);

  return (
    <RevealSceneContext value={scene}>
      <div ref={canvasHostRef} style={CANVAS_HOST_STYLE} />
      <Effect {...effectProps} />
    </RevealSceneContext>
  );
}
