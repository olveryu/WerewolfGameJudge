/**
 * Pixi layers on the reveal overlay root. Only effect chunks import this module, so PixiJS
 * reaches the reveal through the effects' lazy chunks, never through the animator.
 */
import { Container, Graphics } from 'pixi.js';
import { useEffect } from 'react';

import type { ViewRect } from './common/useAnchorRect';
import { useRevealScene } from './runtime';

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

/** Where a piece of art sits on the overlay root, in viewport CSS pixels. */
export interface ArtPlacement {
  /** Stacking among the overlay's layers; mount order breaks ties. */
  readonly zIndex: number;
  /** The art draws in this rect's own coordinates, clipped to it; the whole viewport if absent. */
  readonly rect?: ViewRect;
}

/**
 * Builds Pixi art in a layer of its own on the overlay root and redraws it every frame. The
 * effect owns the layer: it creates it, and destroys it with every resource passed through `own`
 * on unmount or when the placement or `build` changes.
 */
export function useFrameArt({ zIndex, rect }: ArtPlacement, build: ArtBuilder): void {
  const scene = useRevealScene();
  useEffect(() => {
    const layer = new Container({ zIndex });
    if (rect) {
      layer.position.set(rect.x, rect.y);
      const clip = new Graphics().rect(0, 0, rect.width, rect.height).fill(0xffffff);
      layer.addChild(clip);
      layer.mask = clip;
    }
    const root = new Container();
    layer.addChild(root);
    scene.root.addChild(layer);
    const resources: Disposable[] = [];
    const draw = build(root, (resource) => {
      resources.push(resource);
      return resource;
    });
    draw(scene.now());
    const stop = scene.subscribe(draw);
    return () => {
      stop();
      scene.root.removeChild(layer);
      layer.destroy({ children: true });
      for (const resource of resources) resource.destroy();
    };
  }, [scene, zIndex, rect, build]);
}
