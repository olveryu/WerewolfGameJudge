/**
 * Pixi layers on the reveal overlay root. Only effect chunks import this module, so PixiJS
 * reaches the reveal through the effects' lazy chunks, never through the animator.
 */
import { Container } from 'pixi.js';
import { useEffect, useState } from 'react';

import { useRevealScene } from './runtime';

/**
 * A Pixi container on the overlay root at `zIndex` (mount order breaks ties), removed on unmount
 * and destroyed unless remounted in the same task (StrictMode replays effects). Layers sit in
 * viewport CSS pixels.
 */
export function usePixiLayer(zIndex: number): Container {
  const scene = useRevealScene();
  const [layer] = useState(() => new Container({ zIndex }));
  useEffect(() => {
    scene.root.addChild(layer);
    return () => {
      scene.root.removeChild(layer);
      queueMicrotask(() => {
        if (!layer.parent && !layer.destroyed) layer.destroy({ children: true });
      });
    };
  }, [scene, layer]);
  return layer;
}

interface Disposable {
  destroy(): void;
}

/** Draws one frame of Pixi art at the frame's ticker time. */
type FrameDraw = (nowMs: number) => void;

/** Builds art under `root`; resources passed through `own` (gradients) are destroyed with it. */
export type ArtBuilder = (
  root: Container,
  own: <T extends Disposable>(resource: T) => T,
) => FrameDraw;

/**
 * Builds Pixi art into `parent` and redraws it every frame until unmount or until `build`
 * changes, then destroys it. A null `parent` draws nothing.
 */
export function useFrameArt(parent: Container | null, build: ArtBuilder): void {
  const scene = useRevealScene();
  useEffect(() => {
    if (!parent) return;
    const root = new Container();
    parent.addChild(root);
    const resources: Disposable[] = [];
    const draw = build(root, (resource) => {
      resources.push(resource);
      return resource;
    });
    draw(scene.now());
    const stop = scene.subscribe(draw);
    return () => {
      stop();
      parent.removeChild(root);
      root.destroy({ children: true });
      for (const resource of resources) resource.destroy();
    };
  }, [scene, parent, build]);
}
